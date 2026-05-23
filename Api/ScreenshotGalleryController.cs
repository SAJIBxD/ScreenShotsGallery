using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text;
using MediaBrowser.Controller.Entities;
using MediaBrowser.Controller.Entities.Movies;
using MediaBrowser.Controller.Entities.TV;
using MediaBrowser.Controller.Library;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using ScreenShotsGallery.Models;
using ScreenShotsGallery.Configuration;

namespace ScreenShotsGallery.Api;

[ApiController]
[Authorize]
[Route("~/ScreenShotsGallery/api")]
public sealed class ScreenshotGalleryController : ControllerBase
{
    private static readonly HashSet<string> SupportedExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".jpg",
        ".jpeg",
        ".png",
        ".webp"
    };

    private readonly ILibraryManager _libraryManager;
    private readonly ILogger<ScreenshotGalleryController> _logger;

    public ScreenshotGalleryController(ILibraryManager libraryManager, ILogger<ScreenshotGalleryController> logger)
    {
        _libraryManager = libraryManager;
        _logger = logger;
    }

    [HttpGet("config")]
    public ActionResult<PluginConfiguration> GetConfig()
    {
        var cfg = Plugin.Instance?.Configuration ?? new PluginConfiguration();
        return Ok(cfg);
    }

    [HttpPost("config")]
    public ActionResult<PluginConfiguration> PostConfig([FromBody] PluginConfiguration cfg)
    {
        if (Plugin.Instance is null)
        {
            return BadRequest();
        }

        try
        {
            var folderName = NormalizeFolderName(cfg.ImagesSubfolderName);
            if (string.IsNullOrWhiteSpace(folderName) && cfg.ImagesSubfolderNames is not null && cfg.ImagesSubfolderNames.Count > 0)
            {
                folderName = NormalizeFolderName(cfg.ImagesSubfolderNames[0]);
            }

            if (string.IsNullOrWhiteSpace(folderName))
            {
                folderName = "images";
            }

            Plugin.Instance.Configuration.ImagesSubfolderName = folderName;
            Plugin.Instance.Configuration.ImagesSubfolderNames = new System.Collections.Generic.List<string> { folderName };
            Plugin.Instance.SaveConfiguration(Plugin.Instance.Configuration);
            return Ok(Plugin.Instance.Configuration);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to save plugin configuration");
            return StatusCode(500);
        }
    }

    [HttpGet("resource/{*name}")]
    [ProducesResponseType(200)]
    [ProducesResponseType(404)]
    public IActionResult GetResource(string name)
    {
        if (string.IsNullOrWhiteSpace(name)) return NotFound();

        var assembly = typeof(Plugin).Assembly;
        // Normalize name and build expected resource name inside assembly
        var resourceName = $"{typeof(Plugin).Namespace}.Web.{name.Replace('/', '.')}";

        var stream = assembly.GetManifestResourceStream(resourceName);
        if (stream is null)
        {
            _logger.LogWarning("Resource not found: {ResourceName}", resourceName);
            return NotFound();
        }

        string contentType = name.EndsWith(".js", StringComparison.OrdinalIgnoreCase) ? "application/javascript"
            : name.EndsWith(".css", StringComparison.OrdinalIgnoreCase) ? "text/css"
            : name.EndsWith(".html", StringComparison.OrdinalIgnoreCase) ? "text/html"
            : "application/octet-stream";

        return File(stream, contentType);
    }

    [HttpGet("{itemId:guid}")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(ScreenshotGalleryResponse), 200)]
    [ProducesResponseType(404)]
    public ActionResult<ScreenshotGalleryResponse> GetGallery(Guid itemId)
    {
        var item = _libraryManager.GetItemById(itemId);
        if (item is null)
        {
            return NotFound();
        }

        if (!TryResolveItemFolder(item, out var itemFolder, out var itemType))
        {
            return Ok(new ScreenshotGalleryResponse
            {
                ItemId = itemId,
                ItemType = item.GetType().Name,
                Images = Array.Empty<ScreenshotImageDto>()
            });
        }

        // Try configured candidate folders and pick the first one that exists.
        if (!TryFindImagesFolder(itemFolder, out var imagesFolder))
        {
            return Ok(new ScreenshotGalleryResponse
            {
                ItemId = itemId,
                ItemType = itemType,
                ImagesFolder = imagesFolder,
                Images = Array.Empty<ScreenshotImageDto>()
            });
        }

        var imageFiles = DiscoverImageFiles(imagesFolder);
        var images = imageFiles
            .Select((file, index) => new ScreenshotImageDto
            {
                Index = index,
                FileName = Path.GetFileName(file),
                Url = $"/ScreenShotsGallery/api/{itemId}/image/{index.ToString(CultureInfo.InvariantCulture)}"
            })
            .ToArray();

        return Ok(new ScreenshotGalleryResponse
        {
            ItemId = itemId,
            ItemType = itemType,
            ImagesFolder = imagesFolder,
            Images = images
        });
    }

    [HttpGet("{itemId:guid}/image/{index:int}")]
    [AllowAnonymous]
    [ProducesResponseType(200)]
    [ProducesResponseType(404)]
    public IActionResult GetImage(Guid itemId, int index)
    {
        var item = _libraryManager.GetItemById(itemId);
        if (item is null || !TryResolveItemFolder(item, out var itemFolder, out _))
        {
            return NotFound();
        }

        if (!TryFindImagesFolder(itemFolder, out var imagesFolder))
        {
            return NotFound();
        }

        var imageFiles = DiscoverImageFiles(imagesFolder);
        if (index < 0 || index >= imageFiles.Count)
        {
            return NotFound();
        }

        var imagePath = imageFiles[index];

        try
        {
            var stream = System.IO.File.OpenRead(imagePath);
            return File(stream, GetMimeType(imagePath));
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to stream screenshot for item {ItemId} from {ImagePath}", itemId, imagePath);
            return NotFound();
        }
    }

    private static IReadOnlyList<string> DiscoverImageFiles(string imagesFolder)
    {
        return Directory
            .EnumerateFiles(imagesFolder)
            .Where(path => SupportedExtensions.Contains(Path.GetExtension(path)))
            .OrderBy(path => Path.GetFileName(path), NaturalFileNameComparer.Instance)
            .ToArray();
    }

    private sealed class NaturalFileNameComparer : IComparer<string>
    {
        public static NaturalFileNameComparer Instance { get; } = new();

        public int Compare(string? left, string? right)
        {
            if (ReferenceEquals(left, right))
            {
                return 0;
            }

            if (left is null)
            {
                return -1;
            }

            if (right is null)
            {
                return 1;
            }

            var leftParts = SplitNaturalParts(left);
            var rightParts = SplitNaturalParts(right);
            var partCount = Math.Min(leftParts.Count, rightParts.Count);

            for (var index = 0; index < partCount; index++)
            {
                var leftPart = leftParts[index];
                var rightPart = rightParts[index];

                if (leftPart.IsNumber && rightPart.IsNumber)
                {
                    var numberCompare = leftPart.Number.CompareTo(rightPart.Number);
                    if (numberCompare != 0)
                    {
                        return numberCompare;
                    }

                    var lengthCompare = leftPart.Text.Length.CompareTo(rightPart.Text.Length);
                    if (lengthCompare != 0)
                    {
                        return lengthCompare;
                    }

                    continue;
                }

                if (leftPart.IsNumber != rightPart.IsNumber)
                {
                    return leftPart.IsNumber ? -1 : 1;
                }

                var textCompare = string.Compare(leftPart.Text, rightPart.Text, StringComparison.OrdinalIgnoreCase);
                if (textCompare != 0)
                {
                    return textCompare;
                }
            }

            return leftParts.Count.CompareTo(rightParts.Count);
        }

        private static List<NaturalPart> SplitNaturalParts(string value)
        {
            var parts = new List<NaturalPart>();
            var builder = new StringBuilder();
            var currentIsDigit = false;

            for (var index = 0; index < value.Length; index++)
            {
                var ch = value[index];
                var isDigit = char.IsDigit(ch);

                if (index == 0)
                {
                    currentIsDigit = isDigit;
                }
                else if (isDigit != currentIsDigit)
                {
                    parts.Add(CreatePart(builder.ToString(), currentIsDigit));
                    builder.Clear();
                    currentIsDigit = isDigit;
                }

                builder.Append(ch);
            }

            if (builder.Length > 0)
            {
                parts.Add(CreatePart(builder.ToString(), currentIsDigit));
            }

            return parts;
        }

        private static NaturalPart CreatePart(string text, bool isNumber)
        {
            return isNumber && long.TryParse(text, NumberStyles.None, CultureInfo.InvariantCulture, out var number)
                ? new NaturalPart(text, true, number)
                : new NaturalPart(text, false, 0);
        }

        private readonly record struct NaturalPart(string Text, bool IsNumber, long Number);
    }

    private static bool TryResolveItemFolder(BaseItem item, out string folderPath, out string itemType)
    {
        folderPath = string.Empty;
        itemType = item.GetType().Name;

        switch (item)
        {
            case Movie movie when !string.IsNullOrWhiteSpace(movie.Path):
                folderPath = ResolveFolder(movie.Path);
                itemType = nameof(Movie);
                return !string.IsNullOrWhiteSpace(folderPath);
            case Episode episode when !string.IsNullOrWhiteSpace(episode.Path):
                folderPath = ResolveFolder(episode.Path);
                itemType = nameof(Episode);
                return !string.IsNullOrWhiteSpace(folderPath);
            case Series series when !string.IsNullOrWhiteSpace(series.Path):
                folderPath = ResolveFolder(series.Path);
                itemType = nameof(Series);
                return !string.IsNullOrWhiteSpace(folderPath);
            default:
                return false;
        }
    }

    private static string ResolveFolder(string itemPath)
    {
        return Directory.Exists(itemPath)
            ? itemPath
            : Path.GetDirectoryName(itemPath) ?? string.Empty;
    }

    private static string GetMimeType(string filePath)
    {
        return Path.GetExtension(filePath).ToLowerInvariant() switch
        {
            ".jpg" => "image/jpeg",
            ".jpeg" => "image/jpeg",
            ".png" => "image/png",
            ".webp" => "image/webp",
            _ => "application/octet-stream"
        };
    }

    private static string GetImagesSubfolderName()
    {
        var configured = Plugin.Instance?.Configuration?.ImagesSubfolderName;
        return string.IsNullOrWhiteSpace(configured) ? "images" : configured.Trim();
    }

    private static string NormalizeFolderName(string? folderName)
    {
        return string.IsNullOrWhiteSpace(folderName) ? string.Empty : folderName.Trim();
    }

    private static bool TryFindImagesFolder(string itemFolder, out string found)
    {
        found = string.Empty;

        try
        {
            var config = Plugin.Instance?.Configuration;
            var candidates = new List<string>();

            if (config is not null && config.ImagesSubfolderNames != null && config.ImagesSubfolderNames.Count > 0)
            {
                candidates.AddRange(config.ImagesSubfolderNames.Where(s => !string.IsNullOrWhiteSpace(s)).Select(s => s.Trim()));
            }

            // Backwards-compat: include single ImagesSubfolderName if not already present
            var single = GetImagesSubfolderName();
            if (!string.IsNullOrWhiteSpace(single) && !candidates.Contains(single, StringComparer.OrdinalIgnoreCase))
            {
                candidates.Add(single);
            }

            // Ensure default fallback
            if (!candidates.Any()) candidates.Add("images");

            foreach (var candidate in candidates)
            {
                var path = Path.Combine(itemFolder, candidate);
                if (Directory.Exists(path))
                {
                    found = path;
                    return true;
                }
            }
        }
        catch
        {
            // ignore and return not found
        }

        found = string.Empty;
        return false;
    }
}
