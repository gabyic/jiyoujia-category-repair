(() => {
  const API_KEY = "__SHOP_CATEGORY_DIAGNOSTICS__";
  const PRODUCT_LINK_SELECTOR = [
    'a[href*="item.taobao.com/item.htm"]',
    'a[href*="detail.tmall.com/item.htm"]',
    'a[href*="/item.htm?id="]',
  ].join(",");
  const CATEGORY_LINK_SELECTOR = [
    'a[href*="/category.htm"]',
    'a[href*="/category-"]',
    'a[href*="search.htm"]',
  ].join(",");
  const PAGE_LINK_SELECTOR = [
    'a[href*="pageNo="]',
    '[class*="page" i] a',
    '[class*="pagination" i] a',
  ].join(",");
  const SENSITIVE_QUERY_PATTERN = /(?:auth|cookie|credential|password|session|sid|token)/i;

  function truncate(value, maximum = 240) {
    const text = String(value ?? "");
    return text.length > maximum ? `${text.slice(0, maximum)}…` : text;
  }

  function sanitizeUrl(value, base) {
    try {
      const url = new URL(String(value || ""), base || undefined);
      for (const key of Array.from(url.searchParams.keys())) {
        const values = url.searchParams.getAll(key);
        url.searchParams.delete(key);
        for (const currentValue of values) {
          url.searchParams.append(
            key,
            SENSITIVE_QUERY_PATTERN.test(key) ? "[redacted]" : truncate(currentValue, 160)
          );
        }
      }
      url.hash = "";
      return truncate(url.href, 700);
    } catch (_error) {
      return truncate(value, 700);
    }
  }

  function isSupportedCategoryLocation(locationLike) {
    const hostname = String(locationLike?.hostname || "").toLowerCase();
    const pathname = String(locationLike?.pathname || "").toLowerCase();
    const supportedHost =
      /^jiyoujia\d+\.jiyoujia\.com$/.test(hostname) ||
      /^shop\d+\.taobao\.com$/.test(hostname);
    return supportedHost && pathname === "/category.htm";
  }

  function isStyleHidden(metrics) {
    const style = metrics?.style || {};
    const height = Number(metrics?.height || 0);
    const maxHeight = Number.parseFloat(style.maxHeight);
    return (
      String(style.display || "").toLowerCase() === "none" ||
      ["hidden", "collapse"].includes(String(style.visibility || "").toLowerCase()) ||
      (Number.isFinite(maxHeight) && maxHeight <= 1) ||
      (height <= 1 && ["clip", "hidden"].includes(String(style.overflow || "").toLowerCase()))
    );
  }

  function isAbnormalOverlaySize(metrics) {
    const width = Number(metrics?.width || 0);
    const height = Number(metrics?.height || 0);
    const viewportWidth = Math.max(Number(metrics?.viewportWidth || 0), 320);
    const viewportHeight = Math.max(Number(metrics?.viewportHeight || 0), 600);
    return (
      width >= Math.max(3000, viewportWidth * 3) ||
      height >= Math.max(5000, viewportHeight * 5)
    );
  }

  function shouldFlagBrokenOverlay(metrics) {
    return (
      Boolean(metrics?.hiddenByState) &&
      Boolean(metrics?.abnormalSize) &&
      Boolean(metrics?.descendantCoversViewport) &&
      Number(metrics?.productLinkCount || 0) <= 2
    );
  }

  function hasHiddenOverlayState(element) {
    const className =
      typeof element?.className === "string" ? element.className : "";
    return (
      /(?:^|\s)(?:ks-)?(?:overlay|popup)-hidden(?:\s|$)/i.test(className) ||
      element?.getAttribute?.("aria-hidden") === "true"
    );
  }

  function rectCoversViewport(rect, viewportWidth, viewportHeight) {
    return (
      Number(rect?.left || 0) <= 0 &&
      Number(rect?.top || 0) <= 0 &&
      Number(rect?.right || 0) >= viewportWidth &&
      Number(rect?.bottom || 0) >= viewportHeight
    );
  }

  function classTokens(element) {
    const raw = typeof element?.className === "string" ? element.className : "";
    return raw.trim().split(/\s+/).filter(Boolean).slice(0, 6).map((value) => truncate(value, 70));
  }

  function elementLabel(element) {
    if (!element) {
      return "";
    }

    const tag = String(element.tagName || "element").toLowerCase();
    const id = element.id ? `#${truncate(element.id, 80)}` : "";
    const classes = classTokens(element).map((value) => `.${value}`).join("");
    return truncate(`${tag}${id}${classes}`, 300);
  }

  function roundedRect(rect) {
    return {
      x: Math.round(Number(rect?.x || 0)),
      y: Math.round(Number(rect?.y || 0)),
      top: Math.round(Number(rect?.top || 0)),
      width: Math.round(Number(rect?.width || 0)),
      height: Math.round(Number(rect?.height || 0)),
      bottom: Math.round(Number(rect?.bottom || 0)),
    };
  }

  function summarizeElement(element, windowLike) {
    const rect = element.getBoundingClientRect();
    const style = windowLike.getComputedStyle(element);
    return {
      element: elementLabel(element),
      rect: roundedRect(rect),
      style: {
        display: truncate(style.display, 40),
        visibility: truncate(style.visibility, 40),
        opacity: truncate(style.opacity, 40),
        overflow: truncate(style.overflow, 40),
        maxHeight: truncate(style.maxHeight, 60),
        position: truncate(style.position, 40),
        zIndex: truncate(style.zIndex, 40),
        contentVisibility: truncate(style.contentVisibility, 40),
        backgroundImage: truncate(style.backgroundImage, 260),
      },
      hidden: isStyleHidden({ style, height: rect.height }),
      childCount: element.childElementCount,
    };
  }

  function collectHiddenProductAncestors(documentLike, windowLike) {
    const matches = new Map();
    const links = Array.from(documentLike.querySelectorAll(PRODUCT_LINK_SELECTOR)).slice(0, 400);

    for (const link of links) {
      let current = link.parentElement;
      let depth = 0;
      while (current && current !== documentLike.body && depth < 10) {
        const rect = current.getBoundingClientRect();
        const style = windowLike.getComputedStyle(current);
        if (isStyleHidden({ style, height: rect.height })) {
          if (!matches.has(current)) {
            matches.set(current, { element: current, linkCount: 0 });
          }
          matches.get(current).linkCount += 1;
        }
        current = current.parentElement;
        depth += 1;
      }
    }

    return Array.from(matches.values())
      .sort((left, right) => right.linkCount - left.linkCount)
      .slice(0, 30)
      .map(({ element, linkCount }) => ({
        ...summarizeElement(element, windowLike),
        productLinkCount: linkCount,
      }));
  }

  function collectLargeContainers(documentLike, windowLike) {
    const viewportHeight = Math.max(windowLike.innerHeight || 0, 600);
    const candidates = Array.from(documentLike.querySelectorAll("body *")).slice(0, 3500);

    return candidates
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return { element, rect, area: Math.max(0, rect.width) * Math.max(0, rect.height) };
      })
      .filter(({ rect }) => rect.height >= Math.max(900, viewportHeight * 1.2) || rect.width >= 2400)
      .sort((left, right) => right.area - left.area)
      .slice(0, 25)
      .map(({ element }) => summarizeElement(element, windowLike));
  }

  function collectOverlayCandidates(documentLike, windowLike) {
    const viewportWidth = Math.max(Number(windowLike.innerWidth || 0), 320);
    const viewportHeight = Math.max(Number(windowLike.innerHeight || 0), 600);
    const candidates = Array.from(
      documentLike.querySelectorAll('[class*="popup" i], [class*="overlay" i]')
    ).slice(0, 250);

    return candidates
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const descendants = Array.from(element.querySelectorAll?.("*") || []).slice(0, 180);
        const descendantCoversViewport = descendants.some((descendant) =>
          rectCoversViewport(
            descendant.getBoundingClientRect(),
            viewportWidth,
            viewportHeight
          )
        );
        const abnormalSize = isAbnormalOverlaySize({
          width: rect.width,
          height: rect.height,
          viewportWidth,
          viewportHeight,
        });
        const hiddenByState = hasHiddenOverlayState(element);
        const productLinkCount = element.querySelectorAll(PRODUCT_LINK_SELECTOR).length;

        return {
          ...summarizeElement(element, windowLike),
          hiddenByState,
          abnormalSize,
          descendantCoversViewport,
          productLinkCount,
          likelyBroken: shouldFlagBrokenOverlay({
            hiddenByState,
            abnormalSize,
            descendantCoversViewport,
            productLinkCount,
          }),
        };
      })
      .filter(
        (candidate) =>
          candidate.hiddenByState || candidate.abnormalSize || candidate.descendantCoversViewport
      )
      .sort((left, right) => Number(right.likelyBroken) - Number(left.likelyBroken))
      .slice(0, 30);
  }

  function collectPointStack(documentLike, windowLike) {
    if (typeof documentLike.elementsFromPoint !== "function") {
      return [];
    }

    const points = [
      [Math.round(windowLike.innerWidth / 2), 80],
      [Math.round(windowLike.innerWidth / 2), Math.round(windowLike.innerHeight / 2)],
      [Math.round(windowLike.innerWidth / 2), Math.max(windowLike.innerHeight - 80, 0)],
    ];

    return points.map(([x, y]) => ({
      point: { x, y },
      elements: documentLike.elementsFromPoint(x, y).slice(0, 8).map(elementLabel),
    }));
  }

  function collectIframes(documentLike, windowLike) {
    return Array.from(documentLike.querySelectorAll("iframe"))
      .slice(0, 30)
      .map((element) => ({
        ...summarizeElement(element, windowLike),
        src: sanitizeUrl(element.getAttribute("src") || "", documentLike.location?.href),
        title: truncate(element.getAttribute("title") || "", 160),
      }));
  }

  function collectStyleSheetSummary(documentLike) {
    let readable = 0;
    let unreadable = 0;
    for (const sheet of Array.from(documentLike.styleSheets || [])) {
      try {
        void sheet.cssRules;
        readable += 1;
      } catch (_error) {
        unreadable += 1;
      }
    }
    return { total: readable + unreadable, readable, crossOriginOrUnreadable: unreadable };
  }

  function collect(documentLike = document, windowLike = window) {
    const supported = isSupportedCategoryLocation(windowLike.location);
    const bodyText = String(documentLike.body?.innerText || "");
    const productLinkCount = documentLike.querySelectorAll(PRODUCT_LINK_SELECTOR).length;
    const categoryLinkCount = documentLike.querySelectorAll(CATEGORY_LINK_SELECTOR).length;
    const pageLinkCount = documentLike.querySelectorAll(PAGE_LINK_SELECTOR).length;

    return {
      schemaVersion: 2,
      generatedAt: new Date().toISOString(),
      supported,
      extensionVersion:
        globalThis.chrome?.runtime?.getManifest?.().version || "unknown",
      page: {
        url: sanitizeUrl(windowLike.location.href),
        title: truncate(documentLike.title, 240),
        readyState: documentLike.readyState,
        viewport: {
          width: Math.round(windowLike.innerWidth || 0),
          height: Math.round(windowLike.innerHeight || 0),
          devicePixelRatio: Number(windowLike.devicePixelRatio || 1),
        },
        documentSize: {
          scrollWidth: Math.round(documentLike.documentElement?.scrollWidth || 0),
          scrollHeight: Math.round(documentLike.documentElement?.scrollHeight || 0),
          bodyScrollHeight: Math.round(documentLike.body?.scrollHeight || 0),
        },
      },
      repair: {
        status: documentLike.documentElement?.getAttribute("data-shop-category-repair"),
        actions: documentLike.documentElement?.getAttribute(
          "data-shop-category-repair-actions"
        ),
        markedNodes: documentLike.querySelectorAll("[data-shop-category-repair-role]").length,
      },
      links: {
        total: documentLike.links?.length || 0,
        products: productLinkCount,
        categories: categoryLinkCount,
        pagination: pageLinkCount,
      },
      messages: {
        hasMissingItemMessage: /没有找到|暂无宝贝|暂无商品|没有相关宝贝|no\s+(?:items|products)/i.test(
          bodyText
        ),
        visibleTextLength: bodyText.length,
      },
      hiddenProductContainers: collectHiddenProductAncestors(documentLike, windowLike),
      overlayCandidates: collectOverlayCandidates(documentLike, windowLike),
      largeContainers: collectLargeContainers(documentLike, windowLike),
      iframes: collectIframes(documentLike, windowLike),
      viewportStacks: collectPointStack(documentLike, windowLike),
      styleSheets: collectStyleSheetSummary(documentLike),
    };
  }

  const api = {
    collect,
    isAbnormalOverlaySize,
    isStyleHidden,
    isSupportedCategoryLocation,
    sanitizeUrl,
    shouldFlagBrokenOverlay,
    truncate,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    globalThis[API_KEY] = api;
  }
})();
