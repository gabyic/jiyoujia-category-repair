(() => {
  const API_KEY = "ShopCategoryContext";
  const REQUIRED_CUSTOM_SCORE = 4;
  const HOME_PATHS = new Set(["/", "/index.htm"]);
  const EXCLUDED_HOSTS = new Set([
    "www.taobao.com",
    "item.taobao.com",
    "s.taobao.com",
    "login.taobao.com",
    "loginm.taobao.com",
    "passport.taobao.com",
    "cart.taobao.com",
    "trade.taobao.com",
    "buyer.taobao.com",
    "member.taobao.com",
    "market.taobao.com",
    "m.taobao.com",
    "world.taobao.com",
    "www.jiyoujia.com",
  ]);
  const NUMERIC_HOST_PATTERNS = [
    /^shop\d+\.taobao\.com$/,
    /^jiyoujia\d+\.jiyoujia\.com$/,
  ];

  function normalizeLocation(locationLike) {
    return {
      hostname: String(locationLike?.hostname || "").toLowerCase(),
      pathname: String(locationLike?.pathname || "/").toLowerCase(),
    };
  }

  function getPlatform(hostnameValue) {
    const hostname = String(hostnameValue || "").toLowerCase();
    if (hostname.endsWith(".taobao.com")) {
      return "taobao";
    }
    if (hostname.endsWith(".jiyoujia.com")) {
      return "jiyoujia";
    }
    return null;
  }

  function isExcludedHost(hostnameValue) {
    return EXCLUDED_HOSTS.has(String(hostnameValue || "").toLowerCase());
  }

  function isNumericShopHost(hostnameValue) {
    const hostname = String(hostnameValue || "").toLowerCase();
    return NUMERIC_HOST_PATTERNS.some((pattern) => pattern.test(hostname));
  }

  function safeQuery(documentLike, selector) {
    try {
      return Boolean(documentLike?.querySelector?.(selector));
    } catch (_error) {
      return false;
    }
  }

  function safeQueryCount(documentLike, selector, maximum = 50) {
    try {
      return Math.min(
        Array.from(documentLike?.querySelectorAll?.(selector) || []).length,
        maximum
      );
    } catch (_error) {
      return 0;
    }
  }

  function inspectShopSignals(documentLike) {
    if (!documentLike) {
      return { score: 0, signals: [], counts: {} };
    }

    const signals = [];
    let score = 0;
    const legacyShopStructure = safeQuery(documentLike, '[class*="tshop-"]');
    const modernShopStructure = safeQuery(
      documentLike,
      '[class*="tb-shop-"], [id*="shop-head"], [class*="shop-header"], [class*="shop-nav"], [data-spm*="shop"]'
    );
    const categoryLinks =
      safeQueryCount(documentLike, 'a[href*="/category.htm"]') +
      safeQueryCount(documentLike, 'a[href*="/category-"]') +
      safeQueryCount(documentLike, 'a[href*="search.htm"]');
    const productLinks =
      safeQueryCount(documentLike, 'a[href*="item.taobao.com/item.htm"]') +
      safeQueryCount(documentLike, 'a[href*="detail.tmall.com/item.htm"]') +
      safeQueryCount(documentLike, 'a[href*="/item.htm?id="]');
    const shopTitle = /(?:店铺|宝贝分类|淘宝网|极有家)/i.test(
      String(documentLike.title || "")
    );

    if (legacyShopStructure) {
      score += 3;
      signals.push("legacy-shop-structure");
    }
    if (modernShopStructure) {
      score += 2;
      signals.push("shop-header-or-navigation");
    }
    if (categoryLinks >= 1) {
      score += 2;
      signals.push("shop-category-links");
    }
    if (productLinks >= 3) {
      score += 1;
      signals.push("multiple-product-links");
    }
    if (shopTitle) {
      score += 1;
      signals.push("shop-title");
    }

    return {
      score,
      signals,
      counts: {
        categoryLinks,
        productLinks,
      },
      hasStructuralSignal:
        legacyShopStructure || modernShopStructure || categoryLinks >= 1,
    };
  }

  function classifyShopContext(locationLike, documentLike) {
    const { hostname, pathname } = normalizeLocation(locationLike);
    const platform = getPlatform(hostname);
    const base = {
      hostname,
      pathname,
      platform,
      hostType: null,
      supported: false,
      score: 0,
      requiredScore: REQUIRED_CUSTOM_SCORE,
      signals: [],
      counts: {},
    };

    if (!platform) {
      return { ...base, reason: "unsupported-platform-host" };
    }
    if (isExcludedHost(hostname)) {
      return { ...base, reason: "excluded-platform-host" };
    }
    if (isNumericShopHost(hostname)) {
      return {
        ...base,
        hostType: "numeric",
        supported: true,
        reason: "numeric-shop-host",
        signals: ["numeric-shop-host"],
      };
    }

    const inspection = inspectShopSignals(documentLike);
    const supported =
      inspection.hasStructuralSignal && inspection.score >= REQUIRED_CUSTOM_SCORE;
    return {
      ...base,
      hostType: "custom",
      supported,
      score: inspection.score,
      signals: inspection.signals,
      counts: inspection.counts,
      reason: supported ? "custom-shop-signals-confirmed" : "shop-signals-not-found",
    };
  }

  function isCandidateHomeLocation(locationLike) {
    const { hostname, pathname } = normalizeLocation(locationLike);
    return (
      Boolean(getPlatform(hostname)) &&
      !isExcludedHost(hostname) &&
      HOME_PATHS.has(pathname)
    );
  }

  function isCandidateCategoryLocation(locationLike) {
    const { hostname, pathname } = normalizeLocation(locationLike);
    return (
      Boolean(getPlatform(hostname)) &&
      !isExcludedHost(hostname) &&
      pathname === "/category.htm"
    );
  }

  function isSupportedCategoryLocation(locationLike, documentLike) {
    return (
      isCandidateCategoryLocation(locationLike) &&
      classifyShopContext(locationLike, documentLike).supported
    );
  }

  const api = {
    classifyShopContext,
    getPlatform,
    inspectShopSignals,
    isCandidateCategoryLocation,
    isCandidateHomeLocation,
    isExcludedHost,
    isNumericShopHost,
    isSupportedCategoryLocation,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    globalThis[API_KEY] = api;
  }
})();
