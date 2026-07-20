(() => {
  const REPAIR_ATTRIBUTE = "data-shop-category-repair-role";
  const EXCLUDED_HINT_PATTERN =
    /(?:carousel|dialog|drawer|dropdown|modal|mobile|popup|slider|tab[-_]?panel|template)/i;
  const HEADER_HINT_PATTERN =
    /(?:banner|header|shop[-_]?head|shop[-_]?header|store[-_]?head|tb[-_]?header)/i;
  const PRODUCT_HINT_PATTERN =
    /(?:goods|grid|item|list|product|search|shop[-_]?item|shop[-_]?srch)/i;
  const CATEGORY_HINT_PATTERN = /(?:cat|cate|category|menu|nav)/i;
  const PRODUCT_LINK_SELECTOR = [
    'a[href*="item.taobao.com/item.htm"]',
    'a[href*="detail.tmall.com/item.htm"]',
  ].join(",");
  const CATEGORY_LINK_SELECTOR = [
    'a[href*="/category.htm"]',
    'a[href*="/category-"]',
    'a[href*="search.htm"]',
  ].join(",");

  function isSupportedCategoryLocation(locationLike) {
    if (!locationLike) {
      return false;
    }

    const hostname = String(locationLike.hostname || "").toLowerCase();
    const pathname = String(locationLike.pathname || "").toLowerCase();
    const isSupportedHost =
      /^jiyoujia\d+\.jiyoujia\.com$/.test(hostname) ||
      /^shop\d+\.taobao\.com$/.test(hostname);

    return isSupportedHost && pathname === "/category.htm";
  }

  function elementHint(element) {
    if (!element) {
      return "";
    }

    return [
      element.id || "",
      typeof element.className === "string" ? element.className : "",
      element.getAttribute?.("role") || "",
      element.getAttribute?.("data-spm") || "",
    ].join(" ");
  }

  function isExcludedContainer(element) {
    if (!element) {
      return true;
    }

    const tagName = String(element.tagName || "").toLowerCase();
    const hint = elementHint(element);
    const ariaHidden = element.getAttribute?.("aria-hidden");

    return (
      ["dialog", "noscript", "script", "template"].includes(tagName) ||
      ariaHidden === "true" ||
      EXCLUDED_HINT_PATTERN.test(hint)
    );
  }

  function isEffectivelyHidden(metrics) {
    const style = metrics?.style || {};
    const display = String(style.display || "").toLowerCase();
    const visibility = String(style.visibility || "").toLowerCase();
    const maxHeight = Number.parseFloat(style.maxHeight);
    const height = Number(metrics?.height || 0);
    const overflow = String(style.overflow || "").toLowerCase();

    return (
      display === "none" ||
      visibility === "hidden" ||
      visibility === "collapse" ||
      (Number.isFinite(maxHeight) && maxHeight <= 1) ||
      (height <= 1 && ["clip", "hidden"].includes(overflow) && metrics?.hasContent)
    );
  }

  function shouldRepairOversizedElement(metrics) {
    const height = Number(metrics?.height || 0);
    const top = Number(metrics?.top || 0);
    const viewportHeight = Math.max(Number(metrics?.viewportHeight || 0), 600);
    const threshold = Math.max(900, viewportHeight * 1.35);

    return (
      HEADER_HINT_PATTERN.test(String(metrics?.hint || "")) &&
      Number(metrics?.productLinkCount || 0) === 0 &&
      top < Math.max(600, viewportHeight * 0.75) &&
      height >= threshold
    );
  }

  function shouldRestoreLinkGroup(metrics) {
    if (!metrics?.hidden || metrics?.excluded) {
      return false;
    }

    const count = Number(metrics.linkCount || 0);
    const hint = String(metrics.hint || "");

    if (metrics.kind === "products") {
      return count >= 8 || (count >= 3 && PRODUCT_HINT_PATTERN.test(hint));
    }

    if (metrics.kind === "categories") {
      return count >= 2 && CATEGORY_HINT_PATTERN.test(hint);
    }

    return false;
  }

  function applyImportantStyles(element, styles, role) {
    if (!element?.style?.setProperty) {
      return false;
    }

    for (const [property, value] of Object.entries(styles)) {
      element.style.setProperty(property, value, "important");
    }
    element.setAttribute?.(REPAIR_ATTRIBUTE, role);
    return true;
  }

  function repairOversizedHeaders(documentLike, windowLike) {
    const selector = [
      '[class*="banner" i]',
      '[class*="header" i]',
      '[class*="shop-head" i]',
      '[id*="banner" i]',
      '[id*="header" i]',
      '[id*="shop-head" i]',
    ].join(",");
    const candidates = Array.from(documentLike.querySelectorAll(selector)).slice(0, 250);
    let repairs = 0;

    for (const element of candidates) {
      if (element.hasAttribute?.(REPAIR_ATTRIBUTE) || isExcludedContainer(element)) {
        continue;
      }

      const rect = element.getBoundingClientRect();
      const productLinkCount = element.querySelectorAll(PRODUCT_LINK_SELECTOR).length;
      if (
        !shouldRepairOversizedElement({
          height: rect.height,
          top: rect.top,
          viewportHeight: windowLike.innerHeight,
          hint: elementHint(element),
          productLinkCount,
        })
      ) {
        continue;
      }

      if (
        applyImportantStyles(
          element,
          {
            height: "auto",
            "min-height": "0",
            "max-height": "none",
            background: "none",
            "background-image": "none",
          },
          "header"
        )
      ) {
        repairs += 1;
      }
    }

    return repairs;
  }

  function collectHiddenLinkGroups(documentLike, windowLike, selector, kind) {
    const groups = new Map();
    const links = Array.from(documentLike.querySelectorAll(selector)).slice(0, 1000);

    for (const link of links) {
      let ancestor = link.parentElement;
      let depth = 0;

      while (ancestor && ancestor !== documentLike.body && depth < 9) {
        if (!ancestor.hasAttribute?.(REPAIR_ATTRIBUTE)) {
          const style = windowLike.getComputedStyle(ancestor);
          const rect = ancestor.getBoundingClientRect();
          const hidden = isEffectivelyHidden({
            style,
            height: rect.height,
            hasContent: ancestor.childElementCount > 0,
          });

          if (hidden) {
            if (!groups.has(ancestor)) {
              groups.set(ancestor, new Set());
            }
            groups.get(ancestor).add(link);
          }
        }

        ancestor = ancestor.parentElement;
        depth += 1;
      }
    }

    return Array.from(groups, ([element, groupLinks]) => ({
      element,
      metrics: {
        kind,
        hidden: true,
        excluded: isExcludedContainer(element),
        linkCount: groupLinks.size,
        hint: elementHint(element),
      },
    }));
  }

  function repairHiddenLinkGroups(documentLike, windowLike, selector, kind) {
    const groups = collectHiddenLinkGroups(documentLike, windowLike, selector, kind);
    let repairs = 0;

    for (const { element, metrics } of groups) {
      if (!shouldRestoreLinkGroup(metrics)) {
        continue;
      }

      if (
        applyImportantStyles(
          element,
          {
            display: "block",
            visibility: "visible",
            height: "auto",
            "min-height": "0",
            "max-height": "none",
            overflow: "visible",
          },
          kind
        )
      ) {
        repairs += 1;
      }
    }

    return repairs;
  }

  function countRepairRoles(documentLike) {
    const count = (role) =>
      documentLike.querySelectorAll(`[${REPAIR_ATTRIBUTE}="${role}"]`).length;

    return {
      headers: count("header"),
      products: count("products"),
      categories: count("categories"),
    };
  }

  function runRepair(documentLike, windowLike) {
    const results = {
      headers: repairOversizedHeaders(documentLike, windowLike),
      products: repairHiddenLinkGroups(
        documentLike,
        windowLike,
        PRODUCT_LINK_SELECTOR,
        "products"
      ),
      categories: repairHiddenLinkGroups(
        documentLike,
        windowLike,
        CATEGORY_LINK_SELECTOR,
        "categories"
      ),
    };
    const totals = countRepairRoles(documentLike);
    const total = totals.headers + totals.products + totals.categories;

    documentLike.documentElement?.setAttribute(
      "data-shop-category-repair",
      total > 0 ? "repaired" : "active"
    );
    documentLike.documentElement?.setAttribute(
      "data-shop-category-repair-actions",
      `headers:${totals.headers},products:${totals.products},categories:${totals.categories}`
    );

    if (total > 0) {
      windowLike.console?.info?.("[店铺页修复] 已条件式恢复异常模块", results);
    }

    return results;
  }

  function createMutationObserver(windowLike, target, scheduleRepair) {
    if (!windowLike.MutationObserver || !target) {
      return null;
    }

    const observer = new windowLike.MutationObserver((mutations) => {
      const hasExternalChange = mutations.some((mutation) => {
        if (mutation.type === "childList") {
          return mutation.addedNodes?.length > 0;
        }

        return !mutation.target?.hasAttribute?.(REPAIR_ATTRIBUTE);
      });

      if (hasExternalChange) {
        scheduleRepair();
      }
    });

    observer.observe(target, {
      attributes: true,
      attributeFilter: ["class", "hidden", "style"],
      childList: true,
      subtree: true,
    });
    return observer;
  }

  function bootstrap(windowLike) {
    const documentLike = windowLike.document;
    if (!isSupportedCategoryLocation(windowLike.location)) {
      return;
    }

    const start = () => {
      let timer = null;
      const scheduleRepair = (delay = 120) => {
        if (timer !== null) {
          windowLike.clearTimeout(timer);
        }
        timer = windowLike.setTimeout(() => {
          timer = null;
          runRepair(documentLike, windowLike);
        }, delay);
      };

      runRepair(documentLike, windowLike);
      windowLike.setTimeout(() => runRepair(documentLike, windowLike), 600);
      windowLike.setTimeout(() => runRepair(documentLike, windowLike), 1800);
      const observer = createMutationObserver(
        windowLike,
        documentLike.body,
        scheduleRepair
      );
      windowLike.setTimeout(() => observer?.disconnect?.(), 30000);
    };

    if (documentLike.readyState === "loading") {
      documentLike.addEventListener("DOMContentLoaded", start, { once: true });
    } else {
      start();
    }
  }

  const api = {
    applyImportantStyles,
    countRepairRoles,
    createMutationObserver,
    isEffectivelyHidden,
    isExcludedContainer,
    isSupportedCategoryLocation,
    shouldRepairOversizedElement,
    shouldRestoreLinkGroup,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else if (typeof window !== "undefined") {
    bootstrap(window);
  }
})();
