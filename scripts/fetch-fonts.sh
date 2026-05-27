#!/usr/bin/env bash
# Download the brand fonts into packages/ui/fonts/.
# Run from the repo root: ./scripts/fetch-fonts.sh
#
# Fonts are SIL Open Font License 1.1. Sources documented in
# packages/ui/fonts/README.md.

set -euo pipefail

FONTS_DIR="packages/ui/fonts"

if [ ! -d "$FONTS_DIR" ]; then
  echo "Run this from the repo root. Could not find $FONTS_DIR."
  exit 1
fi

mkdir -p "$FONTS_DIR/inter"
mkdir -p "$FONTS_DIR/source-serif-4"

# Inter variable WOFF2 (latest release, rsms/inter)
INTER_VERSION="${INTER_VERSION:-4.0}"
INTER_BASE="https://github.com/rsms/inter/releases/download/v${INTER_VERSION}"

echo "Fetching Inter v${INTER_VERSION}..."
curl -sSfL "${INTER_BASE}/Inter-${INTER_VERSION}.zip" -o /tmp/inter.zip
unzip -joq /tmp/inter.zip "*InterVariable.woff2" -d "$FONTS_DIR/inter/" || true
unzip -joq /tmp/inter.zip "*InterVariable-Italic.woff2" -d "$FONTS_DIR/inter/" || true
rm /tmp/inter.zip

# Source Serif 4 variable WOFF2 (latest release, adobe-fonts/source-serif)
SOURCE_SERIF_VERSION="${SOURCE_SERIF_VERSION:-4.005}"
SOURCE_SERIF_BASE="https://github.com/adobe-fonts/source-serif/raw/${SOURCE_SERIF_VERSION}R/WOFF2/VAR"

echo "Fetching Source Serif 4 v${SOURCE_SERIF_VERSION}..."
curl -sSfL "${SOURCE_SERIF_BASE}/SourceSerif4Variable-Roman.ttf.woff2" \
  -o "$FONTS_DIR/source-serif-4/SourceSerif4Variable-Roman.woff2"
curl -sSfL "${SOURCE_SERIF_BASE}/SourceSerif4Variable-Italic.ttf.woff2" \
  -o "$FONTS_DIR/source-serif-4/SourceSerif4Variable-Italic.woff2"

echo "Done. Files in $FONTS_DIR."
ls -la "$FONTS_DIR/inter" "$FONTS_DIR/source-serif-4"
