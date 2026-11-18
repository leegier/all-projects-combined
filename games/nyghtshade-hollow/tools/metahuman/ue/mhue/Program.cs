// mhue - read Unreal assets without Unreal Engine.  `mhue list` / `mhue export`.  See ../README.md.
//
// Input kinds (auto-detected):
//   a folder        loose .uasset/.umap (+ .uexp/.ubulk next to them), and/or .pak / .utoc+.ucas containers
//   a .pak / .utoc  one container (a sibling or parent global.utoc is registered too)
//   a zip           e.g. a MetaHuman .mhpkg: extracted (safely, size-capped) into --work, then read as a folder
//
// Everything read here is untrusted data: zip entries and package paths are sanitised, nothing is executed,
// and output only ever goes below --out.

using System.Diagnostics;
using System.IO.Compression;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using CUE4Parse.Compression;
using CUE4Parse.Encryption.Aes;
using CUE4Parse.FileProvider;
using CUE4Parse.FileProvider.Objects;
using CUE4Parse.MappingsProvider.Usmap;
using CUE4Parse.UE4.Assets;
using CUE4Parse.UE4.Assets.Exports;
using CUE4Parse.UE4.Assets.Exports.Engine;
using CUE4Parse.UE4.Assets.Exports.Material;
using CUE4Parse.UE4.Assets.Exports.Rig;
using CUE4Parse.UE4.Assets.Exports.SkeletalMesh;
using CUE4Parse.UE4.Assets.Exports.StaticMesh;
using CUE4Parse.UE4.Assets.Exports.Texture;
using CUE4Parse.UE4.Objects.Core.Misc;
using CUE4Parse.UE4.Objects.UObject;
using CUE4Parse.UE4.Versions;
using CUE4Parse_Conversion;
using CUE4Parse_Conversion.Dto;
using CUE4Parse_Conversion.Formats.Meshes;
using CUE4Parse_Conversion.Options;
using CUE4Parse_Conversion.Textures;
using Serilog;
using Serilog.Events;

namespace Mhue;

internal static class Program
{
    /// <summary>Collects the library's error log events so they can be summarised in one line instead of stack traces.</summary>
    private sealed class ProblemSink : Serilog.Core.ILogEventSink
    {
        public static readonly List<string> Problems = [];
        public void Emit(LogEvent e)
        {
            if (e.Level < LogEventLevel.Error) return;
            var msg = e.RenderMessage();
            if (e.Exception != null) msg += " :: " + e.Exception.GetType().Name + ": " + (e.Exception.Message.Split('\n')[0] is { Length: > 160 } m ? m[..160] + "..." : e.Exception.Message.Split('\n')[0]);
            lock (Problems) Problems.Add(msg);
        }
    }

    private static readonly JsonSerializerOptions Json = new() { WriteIndented = true, DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull };

    private const string Usage = """
        mhue - read Unreal assets (no Unreal Engine) and export skeletal meshes to GLB, textures to PNG

        usage:
          mhue list   <input> [options]            what is in it: files, package kind (cooked / editor), asset classes, details
          mhue export <input> --out <dir> [options]  skeletal/static meshes -> .glb (with skin), textures -> .png, DNA -> .dna

        <input>   folder | .pak | .utoc | zip (.mhpkg / .zip)

        common options:
          --game <UE5_6|UE5_8|UE4_27|...>   engine version for the parser (default UE5_LATEST). Cooked + 'unversioned' packages need the right one.
          --usmap <file>                    type mappings (.usmap), required for cooked packages saved with unversioned properties
          --aes <hex>                       AES-256 key for encrypted paks / IoStore (0x... or plain hex)
          --fetch-oodle [path]              download the Oodle decompressor (GitHub release, OodleUE) so Oodle-compressed containers can be read
          --oodle <path>                    use an Oodle library you already have
          --work <dir>                      where a zip is extracted (must be new or empty; default: <out>/_extracted, or a temp dir for `list`)
          --match <regex>                   only packages whose path matches (case-insensitive)
          --class <A,B,..>                  only these asset classes (e.g. SkeletalMesh,Texture2D)
          --verbose                         library log output
        list options:
          --fast                            file table only, do not open packages
          --files                           print every file the container/folder exposes (also .uexp/.ubulk/.dna/..., not only packages)
          --json                            machine-readable output
        export options:
          --out <dir>                       output folder (required)
          --lods first|all                  LOD0 only (default) or every LOD as its own .glb
          --morphs                          also write morph targets (blend shapes) into the .glb (MetaHuman faces carry hundreds)
          --max-tex <px>                    cap texture size (picks the largest stored mip <= px); default: largest
          --no-meshes | --no-textures       skip a kind
          --no-materials                    do not resolve/export the textures a mesh's materials reference
        """;

    private sealed class Opts
    {
        public string Cmd = "";
        public string Input = "";
        public string? Out;
        public string? Work;
        public string Game = "UE5_LATEST";
        public string? Usmap, Aes, OodlePath;
        public bool FetchOodle, Fast, Files, JsonOut, Verbose, Morphs, NoMeshes, NoTextures, NoMaterials, AllLods;
        public Regex? Match;
        public HashSet<string>? Classes;
        public int MaxTex;
        public string? LooseRoot;   // folder name the provider prefixes onto loose files; stripped from output paths
    }

    private static int Main(string[] args)
    {
        Opts o;
        try { o = Parse(args); }
        catch (ArgumentException e) { Console.Error.WriteLine("error: " + e.Message + "\n\n" + Usage); return 2; }
        if (o.Cmd is "" or "help") { Console.WriteLine(Usage); return 0; }

        var logCfg = new LoggerConfiguration().MinimumLevel.Is(o.Verbose ? LogEventLevel.Debug : LogEventLevel.Error).WriteTo.Sink(new ProblemSink());
        if (o.Verbose) logCfg = logCfg.WriteTo.Console(standardErrorFromLevel: LogEventLevel.Verbose);
        Log.Logger = logCfg.CreateLogger();

        string? tempWork = null;
        try
        {
            var (providerDir, singleFile, zipNote) = ResolveInput(o, out tempWork);
            if (zipNote != null && !o.JsonOut) Console.Error.WriteLine(zipNote);
            SetupNatives(o);
            if (singleFile == null) o.LooseRoot = new DirectoryInfo(providerDir).Name;
            using var provider = OpenProvider(o, providerDir, singleFile);
            var rc = o.Cmd == "list" ? List(o, provider) : Export(o, provider);
            lock (ProblemSink.Problems)
                if (ProblemSink.Problems.Count > 0 && !o.JsonOut)
                {
                    Console.Error.WriteLine($"\nparse problems: {ProblemSink.Problems.Count} (the library could not fully read these; partial data is shown as-is). First ones:");
                    foreach (var p in ProblemSink.Problems.Take(5)) Console.Error.WriteLine("  - " + p);
                    if (ProblemSink.Problems.Count > 5) Console.Error.WriteLine("  ... re-run with --verbose for all with stack traces");
                }
            return rc;
        }
        catch (Exception e) when (e is IOException or InvalidDataException or ArgumentException or FileNotFoundException or DirectoryNotFoundException)
        {
            Console.Error.WriteLine("error: " + e.Message);
            return 1;
        }
        finally
        {
            if (tempWork != null) { try { Directory.Delete(tempWork, true); } catch { /* best effort */ } }
        }
    }

    // ---------------------------------------------------------------- argument parsing
    private static Opts Parse(string[] a)
    {
        var o = new Opts();
        if (a.Length == 0) return o;
        o.Cmd = a[0].ToLowerInvariant();
        if (o.Cmd is "help" or "-h" or "--help") { o.Cmd = "help"; return o; }
        if (o.Cmd is not ("list" or "export")) throw new ArgumentException($"unknown command '{a[0]}'");
        for (var i = 1; i < a.Length; i++)
        {
            string Next() => i + 1 < a.Length ? a[++i] : throw new ArgumentException($"{a[i]} needs a value");
            switch (a[i])
            {
                case "--out": o.Out = Next(); break;
                case "--work": o.Work = Next(); break;
                case "--game": o.Game = Next(); break;
                case "--usmap": o.Usmap = Next(); break;
                case "--aes": o.Aes = Next(); break;
                case "--oodle": o.OodlePath = Next(); break;
                case "--fetch-oodle": o.FetchOodle = true; break;
                case "--match": o.Match = new Regex(Next(), RegexOptions.IgnoreCase | RegexOptions.CultureInvariant, TimeSpan.FromSeconds(2)); break;
                case "--class": o.Classes = Next().Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToHashSet(StringComparer.OrdinalIgnoreCase); break;
                case "--fast": o.Fast = true; break;
                case "--files": o.Files = true; break;
                case "--json": o.JsonOut = true; break;
                case "--verbose": o.Verbose = true; break;
                case "--morphs": o.Morphs = true; break;
                case "--no-meshes": o.NoMeshes = true; break;
                case "--no-textures": o.NoTextures = true; break;
                case "--no-materials": o.NoMaterials = true; break;
                case "--lods": o.AllLods = Next() switch { "all" => true, "first" => false, var v => throw new ArgumentException($"--lods first|all, got '{v}'") }; break;
                case "--max-tex": o.MaxTex = int.Parse(Next()); break;
                default:
                    if (a[i].StartsWith("--")) throw new ArgumentException($"unknown option {a[i]}");
                    if (o.Input != "") throw new ArgumentException($"unexpected extra argument '{a[i]}'");
                    o.Input = a[i];
                    break;
            }
        }
        if (o.Input == "") throw new ArgumentException("missing <input>");
        if (o.Cmd == "export" && o.Out == null) throw new ArgumentException("export needs --out <dir>");
        return o;
    }

    // ---------------------------------------------------------------- input handling
    private static (string dir, string? file, string? note) ResolveInput(Opts o, out string? tempWork)
    {
        tempWork = null;
        var input = Path.GetFullPath(o.Input);
        if (Directory.Exists(input)) return (input, null, null);
        if (!File.Exists(input)) throw new FileNotFoundException($"input not found: {input}");

        var ext = Path.GetExtension(input).ToLowerInvariant();
        if (ext is ".pak" or ".utoc")
        {
            var empty = Path.Combine(Path.GetTempPath(), "mhue-empty-" + Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(empty);
            tempWork = empty;
            return (empty, input, null);
        }
        if (!IsZip(input)) throw new ArgumentException($"{input}: not a folder, .pak, .utoc or zip (first bytes are not PK)");

        string work;
        if (o.Work != null) work = Path.GetFullPath(o.Work);
        else if (o.Out != null) work = Path.Combine(Path.GetFullPath(o.Out), "_extracted");
        else { work = Path.Combine(Path.GetTempPath(), "mhue-zip-" + Guid.NewGuid().ToString("N")); tempWork = work; }
        var note = ExtractZip(input, work, maxBytes: 24L << 30, maxEntries: 400_000);
        return (work, null, note);
    }

    private static bool IsZip(string path)
    {
        using var fs = File.OpenRead(path);
        Span<byte> b = stackalloc byte[4];
        return fs.Read(b) == 4 && b[0] == 'P' && b[1] == 'K' && (b[2], b[3]) is (3, 4) or (5, 6);
    }

    /// <summary>Zip -> folder. Rejects absolute paths, '..', drive letters; caps entries and bytes (also against lying headers).</summary>
    private static string ExtractZip(string zipPath, string dest, long maxBytes, int maxEntries)
    {
        if (Directory.Exists(dest) && Directory.EnumerateFileSystemEntries(dest).Any())
            throw new IOException($"--work/extract folder {dest} is not empty; give a new or empty folder");
        Directory.CreateDirectory(dest);
        var destFull = Path.GetFullPath(dest).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;

        using var zip = ZipFile.OpenRead(zipPath);
        if (zip.Entries.Count > maxEntries) throw new InvalidDataException($"zip has {zip.Entries.Count} entries (limit {maxEntries})");
        long declared = 0;
        foreach (var e in zip.Entries) declared += e.Length;
        if (declared > maxBytes) throw new InvalidDataException($"zip expands to {declared >> 20} MB (limit {maxBytes >> 20} MB)");

        var byExt = new SortedDictionary<string, (int n, long bytes)>(StringComparer.OrdinalIgnoreCase);
        long written = 0; var files = 0;
        var buf = new byte[1 << 20];
        foreach (var e in zip.Entries)
        {
            var name = e.FullName.Replace('\\', '/');
            if (name.EndsWith('/')) continue;
            var parts = name.Split('/', StringSplitOptions.RemoveEmptyEntries);
            if (name.StartsWith('/') || name.Contains(':') || parts.Any(p => p == ".." || p == "."))
                throw new InvalidDataException($"unsafe zip entry name refused: '{e.FullName}'");
            var target = Path.GetFullPath(Path.Combine(dest, string.Join('/', parts)));
            if (!target.StartsWith(destFull, StringComparison.Ordinal)) throw new InvalidDataException($"zip entry escapes the target folder: '{e.FullName}'");
            Directory.CreateDirectory(Path.GetDirectoryName(target)!);

            using var src = e.Open();
            using var dst = new FileStream(target, FileMode.CreateNew, FileAccess.Write, FileShare.None);
            long n = 0; int r;
            while ((r = src.Read(buf, 0, buf.Length)) > 0)
            {
                n += r; written += r;
                if (n > e.Length || written > maxBytes) throw new InvalidDataException($"zip entry '{e.FullName}' is larger than its header says (zip bomb?)");
                dst.Write(buf, 0, r);
            }
            files++;
            var x = Path.GetExtension(name).ToLowerInvariant();
            byExt[x] = byExt.TryGetValue(x, out var c) ? (c.n + 1, c.bytes + n) : (1, n);
        }
        var sb = new StringBuilder($"zip: {files} files, {written >> 20} MB extracted to {dest}\n  by extension: ");
        sb.Append(string.Join(", ", byExt.Select(kv => $"{(kv.Key == "" ? "(none)" : kv.Key)} x{kv.Value.n} ({kv.Value.bytes >> 10} KB)")));
        return sb.ToString();
    }

    // ---------------------------------------------------------------- natives (Oodle) and provider
    private static void SetupNatives(Opts o)
    {
        if (o.OodlePath != null) { OodleHelper.Initialize(Path.GetFullPath(o.OodlePath)); return; }
        if (!o.FetchOodle) return;
        var cache = Environment.GetEnvironmentVariable("MHUE_CACHE") ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".cache", "mhue");
        Directory.CreateDirectory(cache);
        var path = Path.Combine(cache, OodleHelper.OodleFileName);
        Console.Error.WriteLine($"oodle: using {path} (downloaded from the OodleUE GitHub release if missing)");
        OodleHelper.Initialize(path);
        if (OodleHelper.Instance == null) throw new IOException("could not initialise Oodle (download failed?); pass --oodle <path> instead");
    }

    private static DefaultFileProvider OpenProvider(Opts o, string dir, string? singleFile)
    {
        if (!Enum.TryParse<EGame>("GAME_" + o.Game.Replace("-", "_"), true, out var game))
            throw new ArgumentException($"unknown --game '{o.Game}' (examples: UE4_27, UE5_3, UE5_6, UE5_LATEST)");
        var provider = new DefaultFileProvider(dir, SearchOption.AllDirectories, new VersionContainer(game, ETexturePlatform.DesktopMobile), StringComparer.OrdinalIgnoreCase);
        if (o.Usmap != null) provider.MappingsContainer = new FileUsmapTypeMappingsProvider(Path.GetFullPath(o.Usmap));
        provider.Initialize();

        if (singleFile != null)
        {
            provider.RegisterVfs(singleFile);
            if (singleFile.EndsWith(".utoc", StringComparison.OrdinalIgnoreCase))
            {
                var d = Path.GetDirectoryName(singleFile)!;
                foreach (var g in new[] { Path.Combine(d, "global.utoc"), Path.Combine(Path.GetDirectoryName(d) ?? d, "global.utoc") })
                    if (File.Exists(g) && !g.Equals(singleFile, StringComparison.OrdinalIgnoreCase)) { provider.RegisterVfs(g); break; }
            }
        }
        else if (!Directory.EnumerateFiles(dir, "global.utoc", SearchOption.AllDirectories).Any())
        {
            var parentGlobal = Path.Combine(Path.GetDirectoryName(dir.TrimEnd('/')) ?? dir, "global.utoc");
            if (File.Exists(parentGlobal) && Directory.EnumerateFiles(dir, "*.utoc", SearchOption.AllDirectories).Any()) provider.RegisterVfs(parentGlobal);
        }

        var mounted = provider.Mount();
        if (o.Aes != null) provider.SubmitKey(new FGuid(), new FAesKey(o.Aes.StartsWith("0x") ? o.Aes : "0x" + o.Aes));
        provider.PostMount();
        if (!o.JsonOut) Console.Error.WriteLine($"opened: {provider.Files.Count} files ({mounted} unencrypted container(s) mounted), game={game}");
        if (provider.UnloadedVfs.Count > 0)
            Console.Error.WriteLine($"WARNING: {provider.UnloadedVfs.Count} encrypted container(s) NOT mounted (key GUID(s): {string.Join(", ", provider.RequiredKeys)}); " +
                (o.Aes == null ? "pass the AES key with --aes <hex>." : "the --aes key does not fit them."));
        return provider;
    }

    // ---------------------------------------------------------------- list
    private sealed record AssetRow(string Path, long Size, string Kind, string? Version, List<ExportRow>? Exports, string? Error);
    private sealed record ExportRow(string Name, string Class, string? Detail, string? Problem);

    private static IEnumerable<GameFile> Packages(Opts o, DefaultFileProvider p) =>
        p.Files.Values.Where(f => f.IsUePackage).OrderBy(f => f.Path, StringComparer.OrdinalIgnoreCase)
            .Where(f => o.Match == null || o.Match.IsMatch(f.Path));

    private static int List(Opts o, DefaultFileProvider provider)
    {
        if (o.Files)
        {
            foreach (var f in provider.Files.Values.OrderBy(x => x.Path, StringComparer.OrdinalIgnoreCase).Where(x => o.Match == null || o.Match.IsMatch(x.Path)))
                Console.WriteLine($"{f.Size,12}  {f.Path}");
            return 0;
        }
        var rows = new List<AssetRow>();
        var counts = new SortedDictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        foreach (var f in Packages(o, provider))
        {
            if (o.Fast) { rows.Add(new AssetRow(f.Path, f.Size, "?", null, null, null)); continue; }
            var (kind, ver, exports, err) = Inspect(provider, f);
            if (o.Classes != null && (exports == null || !exports.Any(x => o.Classes.Contains(x.Class)))) continue;
            rows.Add(new AssetRow(f.Path, f.Size, kind, ver, exports, err));
            if (exports != null) foreach (var x in exports) counts[x.Class] = counts.GetValueOrDefault(x.Class) + 1;
        }

        if (o.JsonOut)
        {
            Console.WriteLine(JsonSerializer.Serialize(new { input = o.Input, game = o.Game, packages = rows.Count, classes = counts, assets = rows }, Json));
            return 0;
        }
        foreach (var r in rows)
        {
            Console.WriteLine($"{r.Path}  [{r.Kind}{(r.Version != null ? ", " + r.Version : "")}, {r.Size / 1024.0:0.#} KB]");
            if (r.Error != null) Console.WriteLine($"    ERROR: {r.Error}");
            if (r.Exports != null)
                foreach (var x in r.Exports)
                    Console.WriteLine($"    {x.Class,-22} {x.Name}{(x.Detail != null ? "  " + x.Detail : "")}{(x.Problem != null ? "  !! " + x.Problem : "")}");
        }
        Console.WriteLine($"\n{rows.Count} package(s)" + (counts.Count > 0 ? "; classes: " + string.Join(", ", counts.Select(kv => $"{kv.Key} x{kv.Value}")) : ""));
        var kinds = rows.GroupBy(r => r.Kind).Select(g => $"{g.Key} x{g.Count()}");
        if (!o.Fast) Console.WriteLine("kinds: " + string.Join(", ", kinds) + "   (cooked = runtime data incl. render buffers; editor = uncooked authoring data)");
        return 0;
    }

    private static (string kind, string? version, List<ExportRow>? exports, string? error) Inspect(DefaultFileProvider provider, GameFile f)
    {
        IPackage pkg;
        try { pkg = provider.LoadPackage(f); }
        catch (Exception e) { return ("unreadable", null, null, Short(e)); }

        string kind;
        try
        {
            var fl = pkg.Summary.PackageFlags;
            kind = fl.HasFlag(EPackageFlags.PKG_Cooked) ? "cooked" : "editor";
        }
        catch { kind = "unknown"; }
        string? ver = null;
        try { ver = $"UE{pkg.Summary.FileVersionUE.FileVersionUE4}/{pkg.Summary.FileVersionUE.FileVersionUE5}"; } catch { /* optional */ }

        var rows = new List<ExportRow>();
        for (var i = 0; i < pkg.ExportsLazy.Length; i++)
        {
            try
            {
                var obj = pkg.ExportsLazy[i].Value;
                rows.Add(Describe(obj));
            }
            catch (Exception e) { rows.Add(new ExportRow($"export[{i}]", "?", null, Short(e))); }
        }
        return (kind, ver, rows, null);
    }

    private static string Short(Exception e) => (e.GetType().Name + ": " + e.Message).Split('\n')[0] is { Length: > 220 } s ? s[..220] + "..." : (e.GetType().Name + ": " + e.Message).Split('\n')[0];

    private static ExportRow Describe(UObject obj)
    {
        var cls = obj.ExportType;
        try
        {
            switch (obj)
            {
                case USkinnedAsset sk:
                {
                    var bones = sk.ReferenceSkeleton?.FinalRefBoneInfo.Length ?? 0;
                    var lods = sk.LODModels;
                    string detail;
                    string? problem = null;
                    if (lods is { Length: > 0 })
                    {
                        var l0 = lods[0];
                        detail = $"bones={bones} lods={lods.Length} lod0: verts={l0.NumVertices} tris={(l0.Indices?.Buffer?.Length ?? 0) / 3} morphTargets={sk.MorphTargets.Length}";
                        if (l0.NumVertices == 0) problem = "LOD0 has no renderable vertices";
                    }
                    else
                    {
                        detail = $"bones={bones} lods=0 morphTargets={sk.MorphTargets.Length}";
                        problem = "no renderable LOD data in this package (editor/uncooked mesh: geometry lives in bulk/DDC data, not in render buffers)";
                    }
                    return new ExportRow(obj.Name, cls, detail, problem);
                }
                case UStaticMesh sm:
                {
                    var l = sm.RenderData?.LODs;
                    return new ExportRow(obj.Name, cls, l is { Length: > 0 } ? $"lods={l.Length} lod0: verts={l[0].PositionVertexBuffer?.Verts.Length ?? 0}" : "lods=0",
                        l is { Length: > 0 } ? null : "no renderable LOD data in this package");
                }
                case UTexture2D t:
                    return new ExportRow(obj.Name, cls, $"{t.PlatformData.SizeX}x{t.PlatformData.SizeY} {t.Format} mips={t.PlatformData.Mips.Length}", null);
                case UTexture t2:
                    return new ExportRow(obj.Name, cls, $"{t2.PlatformData.SizeX}x{t2.PlatformData.SizeY} {t2.Format}", null);
                case UDNAAsset dna:
                    return new ExportRow(obj.Name, cls, $"dna {dna.Version?.FileVersion} bytes={dna.DNAData?.Value.Length ?? 0}", null);
                default:
                    return new ExportRow(obj.Name, cls, null, null);
            }
        }
        catch (Exception e) { return new ExportRow(obj.Name, cls, null, Short(e)); }
    }

    // ---------------------------------------------------------------- export
    private sealed record Item(string Package, string Object, string Class, string Status, List<string>? Files, string? Error, string? Warning = null);

    private static string SafeSegment(string s)
    {
        var t = Regex.Replace(s, @"[^A-Za-z0-9._+\-]", "_");
        if (t is "" or "." or "..") t = "_";
        return t.Length > 120 ? t[..120] : t;
    }

    /// <summary>out/&lt;package dir&gt;/&lt;name&gt;&lt;suffix&gt;.&lt;ext&gt; - every path segment sanitised, result verified to stay below out.</summary>
    private static string OutPath(string? looseRoot, string outDir, string packagePath, string objectName, string? suffix, string ext)
    {
        if (looseRoot != null && packagePath.StartsWith(looseRoot + "/", StringComparison.OrdinalIgnoreCase)) packagePath = packagePath[(looseRoot.Length + 1)..];
        var dirParts = packagePath.Replace('\\', '/').Split('/', StringSplitOptions.RemoveEmptyEntries);
        var dirs = dirParts.Length > 1 ? dirParts[..^1].Select(SafeSegment) : [];
        var full = Path.GetFullPath(Path.Combine([outDir, .. dirs, SafeSegment(objectName) + (string.IsNullOrEmpty(suffix) ? "" : SafeSegment(suffix)) + "." + ext]));
        var root = Path.GetFullPath(outDir).TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
        if (!full.StartsWith(root, StringComparison.Ordinal)) throw new InvalidDataException("output path escapes --out: " + full);
        Directory.CreateDirectory(Path.GetDirectoryName(full)!);
        return full;
    }

    private static int Export(Opts o, DefaultFileProvider provider)
    {
        var outDir = Path.GetFullPath(o.Out!);
        Directory.CreateDirectory(outDir);
        var options = new ExportOptions(
            meshFormat: EMeshFormat.Gltf2,
            meshQuality: o.AllLods ? EMeshQuality.All : EMeshQuality.Highest,
            textureFormat: ETextureFormat.Png,
            exportHdrTexturesAsHdr: false,
            exportMaterials: !o.NoMaterials,
            exportMorphTargets: o.Morphs);
        var gltf = new GltfMeshFormat();
        var items = new List<Item>();
        var written = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var sw = Stopwatch.StartNew();

        foreach (var f in Packages(o, provider))
        {
            IPackage pkg;
            try { pkg = provider.LoadPackage(f); }
            catch (Exception e) { items.Add(new Item(f.Path, "", "?", "failed", null, Short(e))); continue; }

            for (var i = 0; i < pkg.ExportsLazy.Length; i++)
            {
                UObject obj;
                try { obj = pkg.ExportsLazy[i].Value; }
                catch (Exception e) { items.Add(new Item(f.Path, $"export[{i}]", "?", "failed", null, Short(e))); continue; }
                var cls = obj.ExportType;
                if (o.Classes != null && !o.Classes.Contains(cls)) continue;
                var pkgPath = f.PathWithoutExtension;
                try
                {
                    switch (obj)
                    {
                        case USkinnedAsset sk when !o.NoMeshes:
                        {
                            if (sk.LODModels is not { Length: > 0 })
                                throw new NotSupportedException("no renderable LOD data: this looks like an editor (uncooked) mesh - Unreal Engine has to export it (see README, 'hard limits')");
                            if (o.Morphs) sk.PopulateMorphTargetVerticesData();
                            using var dto = new SkeletalMeshDto(sk, options.MeshQuality, options.NaniteMeshFormat, options.ExportMorphTargets);
                            if (dto.LODs.Count == 0) throw new NotSupportedException("skeletal mesh converted to 0 LODs");
                            var files = new List<string>();
                            foreach (var file in gltf.BuildSkeletalMesh(obj.Name, pkgPath + "." + obj.Name, options, dto))
                            {
                                var path = OutPath(o.LooseRoot, outDir, pkgPath, obj.Name, file.NameSuffix, file.Extension);
                                File.WriteAllBytes(path, file.Data); files.Add(Path.GetRelativePath(outDir, path)); written.Add(path);
                            }
                            foreach (var ud in dto.AssetUserData ?? [])
                                if (ud.TryLoad<UDNAAsset>(out var dna) && dna.DNAData?.Value is { Length: > 0 } bytes)
                                {
                                    var path = OutPath(o.LooseRoot, outDir, pkgPath, obj.Name + "_" + (dna.DnaFileName is { Length: > 0 } n ? Path.GetFileNameWithoutExtension(n) : dna.Name), null, "dna");
                                    File.WriteAllBytes(path, bytes); files.Add(Path.GetRelativePath(outDir, path));
                                }
                            items.Add(new Item(f.Path, obj.Name, cls, "ok", files, null));
                            break;
                        }
                        case UStaticMesh sm when !o.NoMeshes:
                        {
                            using var dto = new StaticMeshDto(sm, options.MeshQuality, options.NaniteMeshFormat);
                            if (dto.LODs.Count == 0) throw new NotSupportedException("static mesh has no renderable LODs");
                            var files = new List<string>();
                            foreach (var file in gltf.BuildStaticMesh(obj.Name, pkgPath + "." + obj.Name, options, dto))
                            {
                                var path = OutPath(o.LooseRoot, outDir, pkgPath, obj.Name, file.NameSuffix, file.Extension);
                                File.WriteAllBytes(path, file.Data); files.Add(Path.GetRelativePath(outDir, path));
                            }
                            items.Add(new Item(f.Path, obj.Name, cls, "ok", files, null));
                            break;
                        }
                        case UTexture2D tex when !o.NoTextures:
                        {
                            var ct = o.MaxTex > 0 ? tex.Decode(o.MaxTex, ETexturePlatform.DesktopMobile) : tex.Decode(ETexturePlatform.DesktopMobile);
                            if (ct == null) throw new NotSupportedException($"could not decode {tex.Format} texture");
                            var data = ct.Encode(ETextureFormat.Png, false, out var ext);
                            var path = OutPath(o.LooseRoot, outDir, pkgPath, obj.Name, null, ext);
                            File.WriteAllBytes(path, data);
                            string? warn = null;
                            if (o.MaxTex <= 0 && ct.Width < tex.PlatformData.SizeX)
                                warn = $"exported {ct.Width}x{ct.Height} but the texture is {tex.PlatformData.SizeX}x{tex.PlatformData.SizeY}: the large mips are in bulk data (.ubulk / container) that was not found";
                            items.Add(new Item(f.Path, obj.Name, cls, "ok", [Path.GetRelativePath(outDir, path)], null, warn));
                            break;
                        }
                        case UDNAAsset dna when !o.NoMeshes:
                        {
                            var bytes = dna.DNAData?.Value ?? [];
                            if (bytes.Length == 0) throw new NotSupportedException("DNA asset holds no data");
                            var path = OutPath(o.LooseRoot, outDir, pkgPath, obj.Name, null, "dna");
                            File.WriteAllBytes(path, bytes);
                            items.Add(new Item(f.Path, obj.Name, cls, "ok", [Path.GetRelativePath(outDir, path)], null));
                            break;
                        }
                        case UMaterialInterface when !o.NoMaterials && !o.NoTextures:
                        {
                            var json = MaterialTextureSidecar(obj);
                            if (json != null)
                            {
                                var path = OutPath(o.LooseRoot, outDir, pkgPath, obj.Name, null, "material.json");
                                File.WriteAllText(path, json);
                                items.Add(new Item(f.Path, obj.Name, cls, "ok", [Path.GetRelativePath(outDir, path)], null));
                            }
                            break;
                        }
                    }
                }
                catch (Exception e) { items.Add(new Item(f.Path, obj.Name, cls, "failed", null, Short(e))); }
            }
        }

        var ok = items.Count(i => i.Status == "ok");
        var failed = items.Where(i => i.Status == "failed").ToList();
        File.WriteAllText(Path.Combine(outDir, "mhue-report.json"), JsonSerializer.Serialize(new { input = o.Input, game = o.Game, seconds = sw.Elapsed.TotalSeconds, ok, failed = failed.Count, items }, Json));
        foreach (var it in items.Where(i => i.Status == "ok")) Console.WriteLine($"ok      {it.Class,-18} {it.Object,-32} -> {string.Join(", ", it.Files!)}");
        foreach (var it in items.Where(i => i.Warning != null)) Console.WriteLine($"WARNING {it.Class,-18} {it.Object}: {it.Warning}");
        foreach (var it in failed) Console.WriteLine($"FAILED  {it.Class,-18} {it.Package}:{it.Object}  {it.Error}");
        Console.WriteLine($"\n{ok} exported, {failed.Count} failed, {sw.Elapsed.TotalSeconds:0.0}s; report: {Path.Combine(outDir, "mhue-report.json")}");
        return failed.Count == 0 ? 0 : (ok > 0 ? 3 : 1);
    }

    /// <summary>The glTF writer gives every material a plain white base colour; this sidecar keeps which texture belongs to which slot.</summary>
    private static string? MaterialTextureSidecar(UObject mat)
    {
        if (mat is not UMaterialInterface mi) return null;
        var p = new CMaterialParams2();
        mi.GetParams(p, EMaterialDepth.TopLayerOnly);
        var textures = p.Textures.Select(kv =>
        {
            kv.Value.TryLoad(out var t);
            return new { slot = kv.Key, texture = (t as UObject)?.Name, path = (t as UObject)?.GetPathName() };
        }).ToList();
        var parameters = p.Scalars.Select(kv => new { name = kv.Key, value = (object)kv.Value }).ToList();
        return JsonSerializer.Serialize(new { material = mat.Name, textures, scalars = parameters }, Json);
    }
}
