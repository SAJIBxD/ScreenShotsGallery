# ScreenShots Gallery Plugin (Jellyfin)

A Jellyfin server plugin that injects a vertically stacked screenshot section into Movie, Episode, and Series detail pages.

## Features

- Scans `images/` subfolder next to media files or series folder.
- Supports `.jpg`, `.jpeg`, `.png`, `.webp`.
- Injects a **ScreenShots:** section with responsive vertical layout.
- SPA-safe frontend logic using `MutationObserver`, history hooks, and retry rendering.
- Optional click-to-expand lightbox.

## Media Folder Example

```text
Movie Folder/
├── movie.mkv
└── images/
    ├── 1.jpg
    ├── 2.jpg
    └── 3.webp
```

## Build

```bash
dotnet restore
dotnet build -c Release
```

## One-Command Install (macOS/Linux)

```bash
chmod +x ./install-to-jellyfin.sh
./install-to-jellyfin.sh
```

Optional debugging symbols:

```bash
./install-to-jellyfin.sh --with-symbols
```

Optional custom plugins root:

```bash
JELLYFIN_PLUGINS_DIR=/custom/plugins ./install-to-jellyfin.sh
```

Output DLL path:

```text
bin/Release/net8.0/Jellyfin.Plugin.ScreenShotsGallery.dll
```

## Install

1. Stop Jellyfin server.
2. Create plugin folder:

```text
<jellyfin-data>/plugins/ScreenShotsGallery
```

3. Copy:
- `Jellyfin.Plugin.ScreenShotsGallery.dll`
- any dependency DLLs from the same output folder

4. Start Jellyfin server.
5. Open server logs and confirm plugin load.

## API Endpoints

- `GET /ScreenShotsGallery/api/{itemId}`
- `GET /ScreenShotsGallery/api/{itemId}/image/{index}`

## Publish On GitHub With manifest.json

This repository now supports the normal Jellyfin custom repository flow.

### 1) Create a GitHub release tag

Use a tag like `v1.0.0.1` and publish a release in GitHub.

The workflow in `.github/workflows/publish-jellyfin-plugin.yml` will:
- build Release output,
- create a plugin zip,
- upload the zip to the release,
- publish a `manifest.json` on the `gh-pages` branch.

### 2) Add repository URL in Jellyfin

In Jellyfin admin settings, add this custom repository URL:

```text
https://raw.githubusercontent.com/SAJIBxD/ScreenShotsGallery/gh-pages/manifest.json
```

After that, open the plugin catalog and install/update normally.

### 3) Keep versions in sync

- Release tag version and plugin version should match (for example `v1.0.0.1`).
- `targetAbi` in manifest should match your Jellyfin server ABI target.

## Notes

- The plugin only reads local filesystem folders reachable by Jellyfin process permissions.
- If no `images/` folder exists, the section shows a graceful empty message.
