# `mhue` — read Unreal assets without Unreal Engine

Reads Unreal packages on Linux (no Unreal Engine) and exports **skeletal meshes → GLB (with skin weights)**, **textures → PNG**,
**MetaHuman DNA → `.dna`**. Input: a folder of loose `.uasset/.uexp/.ubulk`, a `.pak`, an IoStore `.utoc/.ucas`, or a **zip such as a
`.mhpkg`** (extracted safely first). Built on [CUE4Parse](https://github.com/FabianFG/CUE4Parse) (Apache-2.0), pinned to NuGet `1.2.2.202610`.

> **Read this first.** The tool is proven on *cooked* packages (UE 5.8 / 6.0 public test fixtures). Whether it can read the owner's
> real MetaHuman packages depends on one thing nobody can know yet: **are the assets in them cooked or editor (uncooked)?**
> `mhue list` answers that in a second, per package. If they are uncooked, **Unreal Engine on the owner's PC must do the final export**
> (see [Hard limits](#hard-limits)). The MetaHuman packages themselves have **not** been read: the Drive token is still pending and nothing here touched Drive.

## Use

```bash
sudo apt install dotnet-sdk-10.0          # Ubuntu 24.04: the SDK comes from the Ubuntu archive (see "What installs here")
./mhue.sh list   Metahuman_Maria.mhpkg                       # what is inside: kind (cooked/editor), classes, bones, LODs, texture sizes
./mhue.sh export Metahuman_Maria.mhpkg --out out/maria      # meshes -> .glb, textures -> .png, DNA -> .dna, mhue-report.json
node check-glb.mjs out/maria/Content/.../SK_Face.glb --expect-skin   # joints, inverse bind, weights sum to 1, ranges
node ../optimize.mjs --inspect out/maria/.../SK_Body.glb      # the game's own inspector, then optimize.mjs as in ../README.md
```

`list` options: `--fast` (file table only) `--files` (every file incl. `.uexp/.ubulk`) `--json` `--class SkeletalMesh,Texture2D` `--match <regex>`.
`export` options: `--out <dir>` `--lods first|all` `--morphs` (blend shapes into the GLB; off by default, a MetaHuman face has hundreds)
`--max-tex <px>` `--no-meshes` `--no-textures` `--no-materials`. Common: `--game UE5_6` (engine version, default `UE5_LATEST`),
`--usmap <file>` (needed for cooked packages with *unversioned* properties), `--aes <hex>`, `--work <dir>` (zip extraction folder, must be new/empty),
`--fetch-oodle` (optional native Oodle, see below), `--verbose`.

What it does that the library alone does not: a loud **WARNING** when an exported texture is smaller than declared (large mips live in a missing `.ubulk`);
a **"parse problems"** summary instead of stack traces; a warning when encrypted containers could not be mounted; **zip-slip / zip-bomb defences**
(absolute paths, `..`, drive letters, entry count and size caps, lying headers); every output path sanitised and confined below `--out`.

## Tests (public data only)

`./test.sh [dir]` fetches a sparse shallow clone of the CUE4Parse and UAssetAPI **test fixtures** (about 37 MB, git-ignored) and runs 21 checks.
Result on this machine: **21/21 pass** (12 s after the build).

| What | Result |
|---|---|
| UE 5.8 IoStore (tagged, zlib): `list` | 97 packages, 1 SkeletalMesh, 2 StaticMesh, 17 Texture2D, all `cooked` |
| `export` of `SK_Fixture` | GLB with skin: 3 joints, inverse bind matrices, **6 vertices / 2 triangles (= the source mesh)**, weights sum 1.0, morph target; the repo's own `optimize.mjs --inspect` reads it |
| 9 textures (BC1, BC3, BC4, BC5, BC7, BGRA8, G8, mips, 512² streaming) vs the fixture's source images | BGRA8 and G8 **bit-exact**; block-compressed within lossy tolerance (mean abs diff 0.0–0.7 of 255) |
| Oodle-compressed IoStore (2.5× smaller than the uncompressed one) | decodes with **no native library** (CUE4Parse ships a managed Oodle decoder) |
| unversioned properties | reads with the fixture `.usmap`; **without it the packages open but every class is lost** (0 classes) |
| AES-encrypted IoStore and legacy pak | right key reads; no key or a wrong key prints `NOT mounted` and the key GUID |
| UE 6.0 fixtures | `list` finds the same 97 packages; `export` writes 7 items, the skinned GLB passes `check-glb` (the PNG comparison was not repeated for 6.0) |
| loose cooked UE 5.5 files (`.uasset/.uexp/.ubulk`) in a zip (the `.mhpkg` shape) | StaticMesh cube (24 verts / 12 tris) and a 2048×2048 texture exported; the texture whose `.ubulk` was absent is flagged |
| 5 hostile zips (`../`, absolute, `..\`, `a/../../`, `C:/`) | all refused, nothing written outside the folder |
| editor-saved (uncooked) packages: UE 5.x material, UE 5.7 Blueprint | classified `editor`; structure readable, graph nodes partly unparseable (reported) |

**Not tested, because no public sample exists:** an uncooked SkeletalMesh, any MetaHuman, any `UDNAAsset`. I searched all four candidate repos
(CUE4Parse, UAssetAPI, unreal_asset/unrealmodding, UEViewer): the only SkeletalMesh asset anywhere is the cooked 3-bone `SK_Fixture`;
nothing mentions MetaHuman or DNA. 8-influence skinning was checked on the writer's vertex type, not on a real mesh (below).

## What installs here (and which hosts answered)

Outbound traffic goes through a policy proxy. Measured today:

| Host | Result |
|---|---|
| `archive.ubuntu.com`, `security.ubuntu.com` | **ok** — `apt install dotnet-sdk-10.0` gave SDK **10.0.112** (`dotnet-sdk-8.0` is there too; CUE4Parse needs 10) |
| `api.nuget.org` | **ok** — NuGet restore works (CUE4Parse, SharpGLTF, SkiaSharp, ...) |
| `index.crates.io`, `static.crates.io` | **ok** — `cargo build` works (crates.io's own website/API answers 403, cargo does not need it) |
| `github.com` over git (clone of public repos) | **ok** — shallow and sparse `--filter=blob:none` clones; `raw.githubusercontent.com` ok |
| `github.com/<owner>/<repo>/releases/download/...` → `release-assets.githubusercontent.com` | **ok** (the OodleUE zip downloaded, HTTP 200) |
| `github.com` web pages/zips, `api.github.com`, `codeload.github.com` | **refused per repository** (403 "GitHub access to this repository is not enabled for this session") |
| `pypi.org`, `registry.npmjs.org` | ok |
| `builds.dotnet.microsoft.com`, `dotnetcli.azureedge.net`, `dotnetcli.blob.core.windows.net` | **refused** (403 on CONNECT) → `dot.net/v1/dotnet-install.sh` cannot download an SDK here (not run; its download hosts are blocked) |
| `drive.google.com`, `huggingface.co`, `deb.debian.org`, `www.fab.com`, `cdn.fab.com` | **refused** |
| `dev.epicgames.com`, `docs.unrealengine.com`, `www.unrealengine.com` | **refused** — Epic's documentation could not be read; every statement about the `.mhpkg` format below is the task brief's, not verified |

## The four candidates

| Tool | Installs/builds here? | What it can do | Verdict |
|---|---|---|---|
| **CUE4Parse** (C#) | **yes**: NuGet packages + .NET 10 from apt; also builds from a git clone | Decodes **cooked** SkeletalMesh/StaticMesh render buffers, skin weights (up to 8 influences), morph targets, textures (all BC formats, ASTC, ETC, virtual textures), `UDNAAsset`; paks, IoStore, encryption, Oodle/zlib; UE 4.x through **6.0** | **Use this.** Proven above |
| **UAssetAPI** (C#) | **yes**: builds in 11 s with the SDK | Reads/writes package *structure and properties*, including **editor-saved** packages (a 69-export UE 5.7 Blueprint parsed). Meshes and textures come back as opaque bytes: `StaticMesh` = 6,949 uninterpreted "Extras" bytes, `Texture2D` = 3,024 | Cannot export geometry or pixels. Useful only to inspect/patch property data |
| **unreal_asset** (Rust, crates.io 0.1.16) | **yes**: `cargo build --release` works | Parses packages up to **UE 5.2**; parsed its own UE 5.1 sample (16,864 exports). On a UE 5.7 package: `No discriminant in enum ObjectVersionUE5 matches the value 1018` | Too old for UE 5.6+, no mesh/texture decoding |
| **UEViewer / umodel** (C++) | clone works; **not built** | Has a glTF exporter (`Exporters/ExportGLTF.cpp`); its README says engine versions 1–4; last commit 2024-02-23 | Predates UE 5.x packages; compiling it would not tell us anything useful, so I did not |

## Hard limits

1. **Cooked vs editor.** CUE4Parse decodes the *render buffers* a cooked package stores for the GPU. The owner's `.mhpkg` is described (task brief, from Epic's docs; **not verified here**) as a zip of Unreal assets that
   may be cooked or editor/uncooked. For an **uncooked SkeletalMesh** the geometry is authoring data, not render buffers. From reading `USkeletalMesh.Deserialize` in CUE4Parse: the render LODs are read in the `bCooked` branch (`SerializeRenderItem`); an
   editor package takes a different path (`FStaticLODModel(Ar, ...)`) whose result I could not test. Expectation, **untested for lack of a sample**: `mhue list` shows
   `lods=0 ... no renderable LOD data`, and `export` fails that mesh with "Unreal Engine has to export it". Textures in uncooked packages are likewise stored as editor source data plus a derived-data cache that is not in the package. Expect the same.
2. **MetaHuman Creator characters (UE 5.6+) may not be a plain skeletal mesh at all** (task brief, **not verified**): the editor may *assemble* the character from DNA + textures + parametric body data. Then there is
   no finished body/face SkeletalMesh in the package to read; any reader, ours included, would only find the ingredients. What `mhue` can still take out of such a package: the **`.dna`** (via `UDNAAsset`, code read, untested), and any textures that are
   present as `Texture2D`. To my knowledge a DNA file also carries the face's neutral mesh geometry, skin weights and blend-shape deltas, so a mesh can in principle be rebuilt from it with Epic's DNA library;
   I could not check that against a real `.dna` here, and it is separate work from this tool.
3. **No hair.** MetaHuman hair is a groom (strands) asset; GLB cannot carry it and `mhue` does not export grooms. Hair cards, where the package has them as meshes, export as ordinary meshes.
4. **Materials are placeholders.** CUE4Parse's glTF writer gives every material a white base colour and a name; it does not link textures. `mhue export` writes a `<Material>.material.json` listing which texture feeds which parameter, but binding
   textures to GLB materials (base colour, normal, roughness) is a separate step, and MetaHuman skin/eye shaders are layered and not representable 1:1 in glTF PBR.
5. **Skin weights:** glTF carries 4 influences per vertex. SharpGLTF keeps the strongest 4 and renormalises (tested: 0.30/0.20/0.10/0.10/0.10/0.10/0.05/0.05 → 0.43/0.29/0.14/0.14, sum 1). That is what the game reads anyway, but it is a quality loss on a real 8-influence face.
6. **Missing bulk data degrades silently in the library.** A texture whose `.ubulk` is not next to its `.uasset` exports as its small mip. `mhue` warns; the file is still written, so look at the warnings.
7. **Nanite:** the fixture's `SM_Nanite` exports as an ordinary 1,083-vertex mesh (the option `NoNanite` is used); I did not check how that relates to the cluster data, and a MetaHuman skeletal mesh is not Nanite anyway.
8. **`MetaHuman` licence:** the raw assets and anything derived from them must not be redistributed or pushed to a public repository (see `../README.md`). `.gitignore` here excludes `*.mhpkg`, `*.uasset`, outputs and samples.

## What this means for the plan

* **Do not assume a Linux-only path to the MetaHumans.** Plan for *Unreal Engine on the owner's PC doing the final export* (`../PC-PROMPT.md`), and treat `mhue` as the tool that (a) tells us in seconds what each package is and
  (b) takes the final export fully off the PC if the packages turn out cooked.
* **First thing to do once a Drive token exists:** `node ../drive-pull.mjs toc <smallestPackageId>` (9 MB one), then `extract` it, then `./mhue.sh list <folder> --game UE5_6` (try `UE5_7`) and read three things: the `[cooked|editor, UE<n>/<m>]` tag,
  whether SkeletalMesh rows have `lods=` > 0, and whether any `DNAAsset` or `Texture2D` rows exist. That one command decides which of the three routes applies:
  1. **cooked + SkeletalMesh with LODs** → `./mhue.sh export` → `optimize.mjs`. No Unreal Engine needed.
  2. **editor / no LODs** → Unreal Engine export on the PC; `mhue` still extracts the textures it can and the `.dna`.
  3. **only DNA + textures** (assembled-by-editor character) → Unreal Engine must assemble and export; or build the mesh from DNA with Epic's tooling.
* If a package is `UE5_x` and `list` shows `unreadable ... MappingException`, give it the matching `.usmap` (a Dumper-7 or `-dumpusmap` file from the same engine build).

## Gotchas found while building this

* **CUE4Parse-Conversion's `ExportSession` is broken on Linux** (1.2.2.202610): it turns the *whole absolute output path* into backslashes (`ResolveOutputPath` ends in `.Replace('/', '\\')`), reports `success=True`, and writes one file whose name is
  `\tmp\...\T_BC1.png` into the **current directory**; nothing appears under the requested folder. Reproduced. `mhue` therefore uses the lower-level mesh/texture API and writes files itself. Worth an upstream issue.
* **Oodle:** not needed (managed decoder). `--fetch-oodle` downloads Epic's native `liboodle-data-shared.so` through the OodleUE release into `~/.cache/mhue` (or `$MHUE_CACHE`) only when asked; it worked here. Nothing else is downloaded at run time.
* **Dependency advisories:** `dotnet restore` warns about SixLabors.ImageSharp 3.1.12 and Microsoft.Bcl.Memory 9.0.0 (CUE4Parse-Conversion pins them). ImageSharp is used by the library's landscape/mesh code, not by the PNG path `mhue` uses (Skia); I did not audit every call, so run it on your own packages only.
* **Untrusted input:** everything read is treated as data; `mhue` executes nothing from a package. Do not point it at packages from unknown sources without the same care you would give any parser (a malformed package can still crash or exhaust memory).
* The sandbox shares 4 cores: a clean `dotnet build` takes about 10 s, `test.sh` about 12 s.

## Files

| | |
|---|---|
| `mhue.sh` | wrapper: builds on first use, then runs `dotnet bin/mhue.dll` |
| `mhue/Program.cs`, `mhue/mhue.csproj` | the CLI (about 590 lines, CUE4Parse pinned) |
| `check-glb.mjs` | GLB verifier (skins, joints, weight sums, ranges, morph targets); uses `@gltf-transform` from `../node_modules` |
| `test.sh`, `test/cmp_png.py` | the 21-check test on public fixtures |
