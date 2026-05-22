using System;
using System.Collections.Generic;
using MediaBrowser.Common.Configuration;
using MediaBrowser.Common.Plugins;
using MediaBrowser.Model.Plugins;
using MediaBrowser.Model.Serialization;
using ScreenShotsGallery.Configuration;

namespace ScreenShotsGallery;

public sealed class Plugin : BasePlugin<PluginConfiguration>, IHasWebPages
{
    public const string PluginName = "ScreenShots Gallery (Dev)";
    public static readonly Guid PluginGuid = new("b6f3c1a2-9d4e-4a3b-8f2d-5e9c2a7f4b11");

    public static Plugin? Instance { get; private set; }

    public Plugin(IApplicationPaths applicationPaths, IXmlSerializer xmlSerializer)
        : base(applicationPaths, xmlSerializer)
    {
        Instance = this;
    }

    public override string Name => PluginName;

    public override Guid Id => PluginGuid;

    public IEnumerable<PluginPageInfo> GetPages()
    {
        return new[]
        {
            new PluginPageInfo
            {
                Name = "screenshotsgallery.js",
                EmbeddedResourcePath = $"{GetType().Namespace}.Web.screenshotsgallery.js"
            },
            new PluginPageInfo
            {
                Name = "screenshotsgallery.css",
                EmbeddedResourcePath = $"{GetType().Namespace}.Web.screenshotsgallery.css"
            }

            , new PluginPageInfo
            {
                Name = "screenshotsgallery-settings.html",
                EmbeddedResourcePath = $"{GetType().Namespace}.Web.screenshotsgallery-settings.html"
            }, new PluginPageInfo
            {
                Name = "screenshotsgallery-settings.js",
                EmbeddedResourcePath = $"{GetType().Namespace}.Web.screenshotsgallery-settings.js"
            }
        };
    }
}
