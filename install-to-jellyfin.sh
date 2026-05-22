#!/usr/bin/env bash
set -euo pipefail

PLUGIN_NAME="ScreenShotsGallery"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_CONFIG="Release"
TARGET_FRAMEWORK="net8.0"
OUTPUT_DIR="$PROJECT_DIR/bin/$BUILD_CONFIG/$TARGET_FRAMEWORK"
DEFAULT_JELLYFIN_PLUGINS_DIR="$HOME/.local/share/jellyfin/plugins"
DEST_ROOT="${JELLYFIN_PLUGINS_DIR:-$DEFAULT_JELLYFIN_PLUGINS_DIR}"
DEST_DIR="$DEST_ROOT/$PLUGIN_NAME"

WITH_SYMBOLS="false"

for arg in "$@"; do
    case "$arg" in
        --with-symbols)
            WITH_SYMBOLS="true"
            ;;
        --help|-h)
            cat <<'USAGE'
Usage: ./install-to-jellyfin.sh [--with-symbols]

Builds the plugin in Release mode and installs it into:
  $HOME/.local/share/jellyfin/plugins/ScreenShotsGallery

Environment variable override:
  JELLYFIN_PLUGINS_DIR=/custom/plugins/path ./install-to-jellyfin.sh

Options:
  --with-symbols   Also copy .pdb and .xml files for debugging
USAGE
            exit 0
            ;;
        *)
            echo "Unknown argument: $arg"
            echo "Use --help for usage."
            exit 1
            ;;
    esac
done

if ! command -v dotnet >/dev/null 2>&1; then
    echo "Error: dotnet SDK is not installed or not in PATH."
    exit 1
fi

echo "Building plugin ($BUILD_CONFIG)..."
dotnet build "$PROJECT_DIR" -c "$BUILD_CONFIG"

if [[ ! -f "$OUTPUT_DIR/Jellyfin.Plugin.ScreenShotsGallery.dll" ]]; then
    echo "Error: build output DLL not found in $OUTPUT_DIR"
    exit 1
fi

echo "Installing to $DEST_DIR"
mkdir -p "$DEST_DIR"

cp "$OUTPUT_DIR/Jellyfin.Plugin.ScreenShotsGallery.dll" "$DEST_DIR/"
cp "$OUTPUT_DIR/Jellyfin.Plugin.ScreenShotsGallery.deps.json" "$DEST_DIR/"

if [[ "$WITH_SYMBOLS" == "true" ]]; then
    [[ -f "$OUTPUT_DIR/Jellyfin.Plugin.ScreenShotsGallery.pdb" ]] && cp "$OUTPUT_DIR/Jellyfin.Plugin.ScreenShotsGallery.pdb" "$DEST_DIR/"
    [[ -f "$OUTPUT_DIR/Jellyfin.Plugin.ScreenShotsGallery.xml" ]] && cp "$OUTPUT_DIR/Jellyfin.Plugin.ScreenShotsGallery.xml" "$DEST_DIR/"
fi

echo "Install complete."
echo "Restart Jellyfin to load the plugin."
