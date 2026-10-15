#!/bin/sh
# Packages dist/ into an .ipk in $LUMEN_BUILD_DIR (default: build/ at the repo root) using the webOS CLI (installed as a dev dependency).
# `--no-minify` because ares' legacy minifier cannot parse modern bundler output.
set -e
cd "$(dirname "$0")/.."
[ -d dist ] || { echo "dist/ missing — run 'npm run build' first" >&2; exit 1; }
OUT=${LUMEN_BUILD_DIR:-../build}
# Ship this project's own licence next to the third-party ones (public/licenses/).
mkdir -p dist/licenses
cp LICENSE dist/licenses/LICENSE.txt
APP_ID=$(sed -n 's/.*"id": *"\([^"]*\)".*/\1/p' dist/appinfo.json | head -1)
mkdir -p "$OUT"
rm -f "$OUT/${APP_ID}_"*.ipk
npx ares-package dist --no-minify -o "$OUT"
echo "Packaged: $(ls "$OUT/${APP_ID}_"*.ipk)"
