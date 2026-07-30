#!/usr/bin/env bash
# Regera os PNGs de marca a partir dos SVGs em public/assets/src/.
# ponytail: usa o Chrome headless (já instalado) em vez de adicionar um rasterizador de SVG
# como dependência. Só roda em macOS; noutro SO troque CHROME pelo binário local.
set -e

CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
SRC="public/assets/src"

render() { # svg, png, width, height
  "$CHROME" --headless --disable-gpu --default-background-color=00000000 \
    --screenshot="$2" --window-size="$3,$4" "file://$PWD/$1" >/dev/null 2>&1
}

render "$SRC/logo-dark.svg" public/assets/logo.png 880 360
render "$SRC/logo-light.svg" public/assets/logo-light.png 880 360

for v in dark light; do
  render "$SRC/favicon-$v.svg" "public/favicon-$v.png" 256 256
  sips -Z 64 "public/favicon-$v.png" >/dev/null
done

echo "assets gerados: logo.png, logo-light.png, favicon-dark.png, favicon-light.png"
