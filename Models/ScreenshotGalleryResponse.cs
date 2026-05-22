using System;
using System.Collections.Generic;

namespace ScreenShotsGallery.Models;

public sealed class ScreenshotGalleryResponse
{
    public Guid ItemId { get; set; }

    public string ItemType { get; set; } = string.Empty;

    public string ImagesFolder { get; set; } = string.Empty;

    public IReadOnlyList<ScreenshotImageDto> Images { get; set; } = Array.Empty<ScreenshotImageDto>();
}

public sealed class ScreenshotImageDto
{
    public int Index { get; set; }

    public string FileName { get; set; } = string.Empty;

    public string Url { get; set; } = string.Empty;
}
