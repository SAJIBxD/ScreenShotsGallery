(() => {
    "use strict";

    const PLUGIN_ROOT_ATTR = "data-sg-plugin-root";
    const PLUGIN_STYLE_ID = "sg-plugin-style";
    const RETRY_INTERVAL_MS = 300;
    const MAX_RETRIES = 30;
    const API_ROOT = "/ScreenShotsGallery/api";

    let renderToken = 0;
    let lastHandledKey = "";

    const detailContainerSelectors = [
        ".itemDetailPage .detailPageContent",
        ".itemDetailPage .detailPagePrimaryContainer",
        ".detailPageContent"
    ];

    function apiClient() {
        return window.ApiClient || null;
    }

    function getServerUrl(path) {
        const normalizedPath = String(path || "").replace(/^\/+/, "");

        if (/^https?:\/\//i.test(normalizedPath)) {
            return normalizedPath;
        }

        return `${window.location.origin}/${normalizedPath}`;
    }

    function getConfigurationResourceUrl(name) {
        return `/web/plugins/ScreenShotsGallery/${encodeURIComponent(name)}`;
    }

    function ensureCssLoaded() {
        if (document.getElementById(PLUGIN_STYLE_ID)) {
            return;
        }

        const link = document.createElement("link");
        link.id = PLUGIN_STYLE_ID;
        link.rel = "stylesheet";
        link.href = getConfigurationResourceUrl("screenshotsgallery.css") + "?v=" + Date.now();
        document.head.appendChild(link);
    }

    function cleanupInjected() {
        document.querySelectorAll(`[${PLUGIN_ROOT_ATTR}='true']`).forEach((el) => el.remove());
        const overlay = document.getElementById("sg-lightbox-overlay");
        if (overlay) {
            overlay.remove();
        }
    }

    function extractGuidCandidate(value) {
        if (!value) {
            return null;
        }

        const match = value.match(/[0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
        return match ? match[0] : null;
    }

    function getCurrentItemId() {
        const url = new URL(window.location.href);

        const bySearch = extractGuidCandidate(url.searchParams.get("id"));
        if (bySearch) {
            return bySearch;
        }

        const byHashQuery = extractGuidCandidate(new URLSearchParams(url.hash.split("?")[1] || "").get("id"));
        if (byHashQuery) {
            return byHashQuery;
        }

        const byPath = extractGuidCandidate(url.pathname);
        if (byPath) {
            return byPath;
        }

        const byHash = extractGuidCandidate(url.hash);
        if (byHash) {
            return byHash;
        }

        return null;
    }

    function resolveDetailContainer() {
        for (const selector of detailContainerSelectors) {
            const candidate = document.querySelector(selector);
            if (candidate) {
                return candidate;
            }
        }

        return null;
    }

    function isVisibleElement(el) {
        if (!el || !(el instanceof Element)) {
            return false;
        }

        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    }

    function insertGallerySection(section, detailContainer) {
        const anchorSelector = ".itemDetailPage #similarCollapsible";
        const anchor = document.querySelector(anchorSelector);

        if (anchor && anchor.parentElement) {
            anchor.parentElement.insertBefore(section, anchor);
            return `before ${anchorSelector}`;
        }

        detailContainer.appendChild(section);
        return "append detailContainer";
    }

    function normalizeGalleryPayload(payload) {
        if (!payload || typeof payload !== "object") {
            return null;
        }

        const rawImages = payload.images || payload.Images || [];
        const images = Array.isArray(rawImages)
            ? rawImages.map((img) => ({
                index: img.index ?? img.Index,
                fileName: img.fileName ?? img.FileName,
                url: img.url ?? img.Url
            }))
            : [];

        return {
            itemId: payload.itemId || payload.ItemId || "",
            itemType: payload.itemType || payload.ItemType || "",
            imagesFolder: payload.imagesFolder || payload.ImagesFolder || "",
            images
        };
    }

    async function fetchGallery(itemId) {
        const path = `${API_ROOT}/${itemId}`;
        const url = getServerUrl(path);

        console.info('[ScreenShotsGallery] fetchGallery', { itemId, path, url });

        console.info('[ScreenShotsGallery] direct fetch', url);
        const response = await fetch(url, { credentials: "same-origin" });
        console.info('[ScreenShotsGallery] direct fetch response', { status: response.status, ok: response.ok, url });
        if (!response.ok) {
            console.warn("[ScreenShotsGallery] gallery request failed", response.status, url, response);
            return null;
        }
        const json = await response.json();
        return normalizeGalleryPayload(json);
    }

    function createLightbox() {
        const overlay = document.createElement("div");
        overlay.id = "sg-lightbox-overlay";
        overlay.className = "sg-lightbox-overlay";
        overlay.setAttribute(PLUGIN_ROOT_ATTR, "true");

        const image = document.createElement("img");
        image.className = "sg-lightbox-image";
        overlay.appendChild(image);

        overlay.addEventListener("click", () => {
            overlay.classList.remove("open");
            setTimeout(() => overlay.remove(), 150);
        });

        document.body.appendChild(overlay);

        return {
            open(src, altText) {
                image.src = src;
                image.alt = altText;
                requestAnimationFrame(() => overlay.classList.add("open"));
            }
        };
    }

    function buildSection(itemId, galleryData) {
        const wrapper = document.createElement("section");
        wrapper.className = "verticalSection detailVerticalSection verticalSection-extrabottompadding emby-scroller-container";
        wrapper.setAttribute(PLUGIN_ROOT_ATTR, "true");
        wrapper.setAttribute("data-sg-item-id", itemId);

        const title = document.createElement("h2");
        title.className = "sectionTitle sectionTitle-cards padded-right";
        title.textContent = "ScreenShots";

        wrapper.appendChild(title);

        if (!Array.isArray(galleryData.images) || galleryData.images.length === 0) {
            wrapper.classList.add("hide");
            return wrapper;
        }

        const stack = document.createElement("div");
        stack.className = "sg-gallery-stack";
        const lightbox = createLightbox();

        for (const imageDto of galleryData.images) {
            if (!imageDto || !imageDto.url) {
                continue;
            }

            const imageUrl = getServerUrl(imageDto.url || `${API_ROOT}/${itemId}/image/${imageDto.index}`);
            const item = document.createElement("figure");
            item.className = "sg-gallery-item";

            const img = document.createElement("img");
            img.className = "sg-gallery-image";
            img.loading = "lazy";
            img.decoding = "async";
            img.alt = imageDto.fileName || "Screenshot";
            img.src = imageUrl;

            img.addEventListener("click", () => lightbox.open(imageUrl, img.alt));

            item.appendChild(img);
            stack.appendChild(item);
        }

        wrapper.appendChild(stack);
        return wrapper;
    }

    async function renderForCurrentPage(attempt = 0, token = null) {
        const currentToken = token ?? ++renderToken;
        const itemId = getCurrentItemId();

        if (!itemId) {
            cleanupInjected();
            lastHandledKey = "";
            return;
        }

        const key = `${window.location.pathname}${window.location.hash}|${itemId}`;
        const detailContainer = resolveDetailContainer();

        if (!detailContainer) {
            if (attempt < MAX_RETRIES) {
                setTimeout(() => renderForCurrentPage(attempt + 1, currentToken), RETRY_INTERVAL_MS);
            }
            return;
        }

        if (currentToken !== renderToken) {
            return;
        }

        if (lastHandledKey === key && document.querySelector(`[${PLUGIN_ROOT_ATTR}='true'][data-sg-item-id='${itemId}']`)) {
            return;
        }

        try {
            const gallery = await fetchGallery(itemId);
            if (currentToken !== renderToken) {
                return;
            }

            cleanupInjected();
            if (!gallery) {
                lastHandledKey = key;
                return;
            }

            const section = buildSection(itemId, gallery);
            try {
                const placement = insertGallerySection(section, detailContainer);
                console.info('[ScreenShotsGallery] append complete', { placement, detailClass: detailContainer && detailContainer.className });
            } catch (e) {
                console.error('[ScreenShotsGallery] failed to append gallery section', e, detailContainer);
            }
            lastHandledKey = key;
        } catch (error) {
            console.debug("[ScreenShotsGallery] render failed", error);
        }
    }

    function onNavigation() {
        renderForCurrentPage();
    }

    function observeDomChanges() {
        const observer = new MutationObserver(() => {
            onNavigation();
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    function hookNavigationEvents() {
        const originalPushState = history.pushState;
        history.pushState = function (...args) {
            const result = originalPushState.apply(this, args);
            onNavigation();
            return result;
        };

        const originalReplaceState = history.replaceState;
        history.replaceState = function (...args) {
            const result = originalReplaceState.apply(this, args);
            onNavigation();
            return result;
        };

        window.addEventListener("hashchange", onNavigation);
        window.addEventListener("popstate", onNavigation);

        setInterval(onNavigation, 2000);
    }

    function init() {
        console.info("[ScreenShotsGallery] injector initialized");
        ensureCssLoaded();
        hookNavigationEvents();
        observeDomChanges();
        onNavigation();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, { once: true });
    } else {
        init();
    }
})();
