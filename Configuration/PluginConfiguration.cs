using MediaBrowser.Model.Plugins;

namespace ScreenShotsGallery.Configuration;

public sealed class PluginConfiguration : BasePluginConfiguration
{
    public bool EnableMoviePages { get; set; } = true;

    public bool EnableEpisodePages { get; set; } = true;

    public bool EnableSeriesPages { get; set; } = true;

    public string ImagesSubfolderName { get; set; } = "images";

    // Backwards-compatible: a list of folder names to scan for screenshots.
    // The plugin will use the first existing folder found in this list.
    public System.Collections.Generic.List<string> ImagesSubfolderNames { get; set; } = new System.Collections.Generic.List<string> { "images" };

    public int DesktopMaxWidthPx { get; set; } = 1200;

    public bool EnableLightbox { get; set; } = true;
}
