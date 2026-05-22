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

DEFAULT_JELLYFIN_WEB_PLUGINS_DIR="/Applications/Jellyfin.app/Contents/Resources/jellyfin-web/plugins/$PLUGIN_NAME"
WEB_DEST_DIR="${JELLYFIN_WEB_PLUGINS_DIR:-$DEFAULT_JELLYFIN_WEB_PLUGINS_DIR}"

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

copy_file() {
    local source_path="$1"
    local destination_path="$2"

    if [[ -w "$(dirname "$destination_path")" ]]; then
        cp "$source_path" "$destination_path"
    else
        sudo cp "$source_path" "$destination_path"
    fi
}

ensure_dir() {
    local destination_dir="$1"

    if [[ -d "$destination_dir" && -w "$destination_dir" ]]; then
        mkdir -p "$destination_dir"
    else
        sudo mkdir -p "$destination_dir"
    fi
}

echo "Building plugin ($BUILD_CONFIG)..."
dotnet build "$PROJECT_DIR" -c "$BUILD_CONFIG"

# Find the built DLL. Prefer a Dev-suffixed assembly if present, otherwise pick any matching assembly.
DLL=""
if [[ -f "$OUTPUT_DIR/Jellyfin.Plugin.ScreenShotsGalleryDev.dll" ]]; then
    DLL="$OUTPUT_DIR/Jellyfin.Plugin.ScreenShotsGalleryDev.dll"
else
    DLL=$(ls "$OUTPUT_DIR"/Jellyfin.Plugin.ScreenShotsGallery*.dll 2>/dev/null | head -n1 || true)
fi

if [[ -z "$DLL" ]]; then
    echo "Error: build output DLL not found in $OUTPUT_DIR"
    exit 1
fi

BASE_NAME=$(basename "$DLL" .dll)

echo "Installing to $DEST_DIR"
mkdir -p "$DEST_DIR"

# Copy main DLL and deps.json if present
cp "$DLL" "$DEST_DIR/"
if [[ -f "$OUTPUT_DIR/${BASE_NAME}.deps.json" ]]; then
    cp "$OUTPUT_DIR/${BASE_NAME}.deps.json" "$DEST_DIR/"
fi

# Jellyfin writes meta.json back into the plugin directory at startup.
# Keep the plugin folder owned by the current user so manifest saves succeed.
sudo chown -R "$(id -u)":"$(id -g)" "$DEST_DIR"

echo "Installing web assets to $WEB_DEST_DIR"
ensure_dir "$WEB_DEST_DIR"
copy_file "$PROJECT_DIR/Web/screenshotsgallery.js" "$WEB_DEST_DIR/"
copy_file "$PROJECT_DIR/Web/screenshotsgallery.css" "$WEB_DEST_DIR/"
if [[ -f "$PROJECT_DIR/Web/screenshotsgallery-settings.js" ]]; then
    copy_file "$PROJECT_DIR/Web/screenshotsgallery-settings.js" "$WEB_DEST_DIR/"
fi
if [[ -f "$PROJECT_DIR/Web/screenshotsgallery-settings.html" ]]; then
    copy_file "$PROJECT_DIR/Web/screenshotsgallery-settings.html" "$WEB_DEST_DIR/"
fi

if [[ "$WITH_SYMBOLS" == "true" ]]; then
    if [[ -f "$OUTPUT_DIR/${BASE_NAME}.pdb" ]]; then
        cp "$OUTPUT_DIR/${BASE_NAME}.pdb" "$DEST_DIR/"
    fi
    if [[ -f "$OUTPUT_DIR/${BASE_NAME}.xml" ]]; then
        cp "$OUTPUT_DIR/${BASE_NAME}.xml" "$DEST_DIR/"
    fi
fi

echo "Install complete."
echo "Restart Jellyfin to load the plugin."
