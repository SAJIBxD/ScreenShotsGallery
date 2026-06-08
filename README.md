# ScreenShots Gallery

A tiny Jellyfin plugin that shows a vertical gallery of screenshots on media detail pages.

## Jellyfin plugin installation (recommended) 

1. In Jellyfin Admin, go to **Plugins → Catalog → Add Repository**.
2. Add this manifest URL: `https://raw.githubusercontent.com/SAJIBxD/ScreenShotsGallery/gh-pages/manifest.json`
3. After adding this, open **Plugins → Catalog**, find **ScreenShots Gallery**, and click **Install**.
4. Restart Jellyfin. Open any movie/episode/series page that has an `images/` folder to see the gallery.

## How to prepare screenshots

Place an `images/` folder next to your media file or inside a series folder. Put image files there (any names). Example:

```
My Movie/
├─ movie.mp4
└─ images/
    ├─ 1.jpg
    ├─ cover.png
    └─ scene3.webp
```

The plugin will automatically show those images on the item's page.

## Quick troubleshooting

- No images visible: ensure the Jellyfin server can read the `images/` folder (permissions).
- Plugin not in catalog: double-check the repository URL or install the ZIP manually from Releases.
- Check server logs under Admin → Logs for load or runtime errors.

## Manual install

1. Download the latest release ZIP from GitHub Releases.
2. Stop Jellyfin, extract the ZIP into the plugins folder (e.g. `/var/lib/jellyfin/plugins/ScreenShotsGallery`), then start Jellyfin.

That's it — enjoy the gallery!
