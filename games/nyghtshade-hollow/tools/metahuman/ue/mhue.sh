#!/usr/bin/env bash
# mhue.sh - run the Unreal asset reader/exporter (builds it first if needed).   ./mhue.sh list|export <input> ...
# Needs the .NET 10 SDK:  apt install dotnet-sdk-10.0   (Ubuntu 24.04: from the Ubuntu archive; no Microsoft download host needed)
set -euo pipefail
here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
dll="$here/bin/mhue.dll"
if [ ! -f "$dll" ] || find "$here/mhue" \( -name '*.cs' -o -name '*.csproj' \) -newer "$dll" | grep -q .; then
  dotnet build "$here/mhue/mhue.csproj" -c Release -o "$here/bin" --nologo -v q -clp:ErrorsOnly >&2
fi
exec dotnet "$dll" "$@"
