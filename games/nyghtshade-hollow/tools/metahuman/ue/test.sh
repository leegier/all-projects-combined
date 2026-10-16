#!/usr/bin/env bash
# test.sh - end-to-end test of mhue on PUBLIC sample assets only (the CUE4Parse and UAssetAPI projects' own test fixtures).
#   ./test.sh [samples-dir]        samples are fetched with a sparse shallow git clone (~37 MB) into samples-dir (default ./samples, git-ignored)
set -uo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
samples="${1:-$here/samples}"; mkdir -p "$samples"
mhue="$here/mhue.sh"; fail=0; n=0
ok()   { n=$((n+1)); echo "  ok   $*"; }
bad()  { n=$((n+1)); fail=$((fail+1)); echo "  FAIL $*"; }
check(){ if eval "$2"; then ok "$1"; else bad "$1  [$2]"; fi; }
# says(pattern, cmd...): run cmd, capture stdout+stderr, then grep (no pipe: grep -q + pipefail = false SIGPIPE failures)
says(){ local pat="$1" out; shift; out="$("$@" 2>&1)"; grep -q -- "$pat" <<<"$out"; }

fetch() { # repo dir sparse-path
  [ -d "$samples/$2/$3" ] && return 0
  rm -rf "${samples:?}/$2"
  git clone -q --depth 1 --no-tags --filter=blob:none --sparse "https://github.com/$1.git" "$samples/$2" \
    && git -C "$samples/$2" sparse-checkout set "$3" >/dev/null
}
echo "== fetching public fixtures"
fetch FabianFG/CUE4Parse cue4parse CUE4Parse.Tests/Fixtures/UE5_8 || { echo "cannot fetch CUE4Parse fixtures"; exit 2; }
fetch atenfyr/UAssetAPI uassetapi UAssetAPI.Tests/TestAssets/TestUE5_5/BlankGame || echo "  (UAssetAPI fixtures unavailable: zip tests skipped)"
FX="$samples/cue4parse/CUE4Parse.Tests/Fixtures/UE5_8"
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
cd "$tmp"   # run from an empty folder: nothing the tool does may touch the working directory

echo "== list: cooked IoStore container (UE 5.8, zlib)"
"$mhue" list "$FX/IoStore/Tagged/Zlib" --game UE5_8 --json > list.json 2>/dev/null
py='import json,sys; d=json.load(open("list.json")); c=d["classes"]; a=d["assets"]'
check "97 packages"                 "python3 -I -c '$py; sys.exit(0 if d[\"packages\"]==97 else 1)'"
check "1 SkeletalMesh, 2 StaticMesh" "python3 -I -c '$py; sys.exit(0 if (c.get(\"SkeletalMesh\"),c.get(\"StaticMesh\"))==(1,2) else 1)'"
check "every package reported as cooked" "python3 -I -c '$py; sys.exit(0 if all(x[\"Kind\"]==\"cooked\" for x in a) else 1)'"

echo "== export: skeletal mesh -> GLB (skin), textures -> PNG"
"$mhue" export "$FX/IoStore/Tagged/Zlib" --game UE5_8 --out "$tmp/o" --match 'Meshes/|Textures/' --morphs > export.log 2>&1
export_rc=$?
check "export exit 0, 20 items"       "[ $export_rc -eq 0 ] && grep -q '^20 exported, 0 failed' export.log"
M="$tmp/o/CUE4ParseFixtures/Content/Fixtures"
check "SK_Fixture.glb is skinned, weights sum to 1" "node '$here/check-glb.mjs' '$M/Meshes/SK_Fixture.glb' --expect-skin >/dev/null"
check "SM_Nanite.glb has geometry"     "node '$here/check-glb.mjs' '$M/Meshes/SM_Nanite.glb' | grep -q '1083 verts'"
if python3 -I -c 'import PIL' 2>/dev/null; then
  check "9 textures match the source images" "python3 -I '$here/test/cmp_png.py' '$M/Textures' '$FX/SourceTextures' >/dev/null"
else echo "  skip PNG comparison (Pillow not installed)"; fi
check "nothing leaked into the working directory" "[ -z \"\$(find '$tmp' -maxdepth 1 -name '*\\\\*' -o -maxdepth 1 -name '*.png' -o -maxdepth 1 -name '*.glb')\" ]"

echo "== containers and keys"
n_of() { "$mhue" list "$@" --json 2>/dev/null | python3 -I -c 'import json,sys; print(json.load(sys.stdin)["packages"])'; }
check "Oodle-compressed IoStore decodes (managed decoder)" "[ \"\$(n_of '$FX/IoStore/Tagged/Oodle' --game UE5_8)\" = 97 ]"
check "unversioned + usmap reads"      "[ \"\$(n_of '$FX/IoStore/Unversioned/Uncompressed' --game UE5_8 --usmap '$FX/Mappings/CUE4ParseFixtures-Uncompressed.usmap')\" = 97 ]"
key="$(python3 -I -c "print(b'CUE4ParseFixtureAESKey0123456789'.hex())")"
check "encrypted container: no key -> loud warning" "says 'NOT mounted' '$mhue' list '$FX/IoStore/Tagged/OodleEncrypted' --game UE5_8 --fast"
check "encrypted container: right key reads"        "[ \"\$(n_of '$FX/IoStore/Tagged/OodleEncrypted' --game UE5_8 --aes $key)\" = 97 ]"

echo "== zip input (.mhpkg) and hostile zips"
python3 -I - "$tmp" <<'PY'
import sys, zipfile
t = sys.argv[1]
for name, entry in [("dotdot", "../escaped.txt"), ("abs", "/tmp/escaped-abs.txt"), ("bs", "..\\escaped-bs.txt"), ("nested", "a/../../e2.txt"), ("drive", "C:/Windows/x.txt")]:
    with zipfile.ZipFile(f"{t}/evil-{name}.zip", "w") as z: z.writestr(entry, "owned")
PY
for z in dotdot abs bs nested drive; do
  check "hostile zip refused: $z" "says 'unsafe zip entry' '$mhue' list '$tmp/evil-$z.zip' --work '$tmp/w-$z' --fast"
done
check "no file escaped the extraction folder" "[ ! -e '$tmp/escaped.txt' ] && [ ! -e /tmp/escaped-abs.txt ] && [ ! -e '$tmp/../escaped.txt' ]"
UA="$samples/uassetapi/UAssetAPI.Tests/TestAssets/TestUE5_5/BlankGame"
if [ -d "$UA" ]; then
  python3 -I - "$UA" "$tmp/sample.mhpkg" <<'PY'
import sys, os, zipfile
src, dst = sys.argv[1:3]
with zipfile.ZipFile(dst, "w", zipfile.ZIP_DEFLATED) as z:
    for f in sorted(os.listdir(src)):
        if f.endswith((".uasset", ".uexp", ".ubulk", ".usmap")): z.write(os.path.join(src, f), "Content/Sample/" + f)
PY
  "$mhue" export "$tmp/sample.mhpkg" --work "$tmp/wz" --out "$tmp/oz" --game UE5_5 --usmap "$UA/BlankUE5_5.usmap" --no-materials > zip.log 2>&1
  check "zip: StaticMesh + 2048px texture exported" "grep -q 'SM_Cube.glb' zip.log && [ -f '$tmp/oz/Content/Sample/T_Test.png' ]"
  check "zip: cube has 24 verts / 12 tris"           "node '$here/check-glb.mjs' '$tmp/oz/Content/Sample/SM_Cube.glb' --json | python3 -I -c 'import json,sys; m=json.load(sys.stdin)[\"meshes\"]; sys.exit(0 if (sum(p[\"vertices\"] for x in m for p in x[\"primitives\"]),sum(p[\"triangles\"] for x in m for p in x[\"primitives\"]))==(24,12) else 1)'"
  check "zip: missing .ubulk is warned about"        "grep -q 'WARNING.*T_pl01_001_body_D.*2048x2048' zip.log"
fi
echo; echo "$((n-fail))/$n checks passed"; exit $((fail>0))
