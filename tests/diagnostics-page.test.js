const test = require("node:test");
const assert = require("node:assert/strict");

const {
  collect,
  isAbnormalOverlaySize,
  isStyleHidden,
  isSupportedCategoryLocation,
  sanitizeUrl,
  shouldFlagBrokenOverlay,
  truncate,
} = require("../diagnostics-page.js");

test("诊断器标识相对视口异常巨大的弹层尺寸", () => {
  assert.equal(
    isAbnormalOverlaySize({
      width: 10000,
      height: 100000,
      viewportWidth: 1920,
      viewportHeight: 869,
    }),
    true
  );
  assert.equal(
    isAbnormalOverlaySize({
      width: 600,
      height: 700,
      viewportWidth: 1920,
      viewportHeight: 869,
    }),
    false
  );
});

test("诊断损坏弹层判定与修复规则一致并排除商品列表", () => {
  const brokenOverlay = {
    hiddenByState: true,
    abnormalSize: true,
    descendantCoversViewport: true,
    productLinkCount: 0,
  };

  assert.equal(shouldFlagBrokenOverlay(brokenOverlay), true);
  assert.equal(
    shouldFlagBrokenOverlay({ ...brokenOverlay, productLinkCount: 48 }),
    false
  );
  assert.equal(
    shouldFlagBrokenOverlay({ ...brokenOverlay, descendantCoversViewport: false }),
    false
  );
});

test("完整诊断返回修复状态和链接统计且不读取浏览器私有存储", () => {
  const body = { innerText: "暂无商品", scrollHeight: 1200 };
  const productLinks = [{ parentElement: body }, { parentElement: body }];
  const categoryLinks = [{ parentElement: body }];
  const pageLinks = [{}, {}, {}];
  const documentLike = {
    title: "默认宝贝分类页",
    readyState: "complete",
    body,
    links: { length: 12 },
    styleSheets: [],
    location: { href: "https://shop203317430.taobao.com/category.htm?pageNo=2" },
    documentElement: {
      scrollWidth: 1280,
      scrollHeight: 1600,
      getAttribute(name) {
        return name === "data-shop-category-repair" ? "active" : "headers:0,products:0,categories:0";
      },
    },
    querySelectorAll(selector) {
      if (selector.includes("item.taobao.com")) return productLinks;
      if (selector.includes("/category.htm")) return categoryLinks;
      if (selector.includes("pageNo=")) return pageLinks;
      return [];
    },
    elementsFromPoint() {
      return [];
    },
  };
  const windowLike = {
    location: {
      hostname: "shop203317430.taobao.com",
      pathname: "/category.htm",
      href: "https://shop203317430.taobao.com/category.htm?pageNo=2",
    },
    innerWidth: 1280,
    innerHeight: 720,
    devicePixelRatio: 2,
    localStorage: { secret: "must-not-appear" },
  };

  const result = collect(documentLike, windowLike);
  const serialized = JSON.stringify(result);

  assert.equal(result.supported, true);
  assert.equal(result.repair.status, "active");
  assert.deepEqual(result.links, {
    total: 12,
    products: 2,
    categories: 1,
    pagination: 3,
  });
  assert.equal(result.messages.hasMissingItemMessage, true);
  assert.doesNotMatch(serialized, /must-not-appear/);
});

test("诊断器只支持数字淘宝和极有家店铺分类页", () => {
  const accepted = [
    { hostname: "shop203317430.taobao.com", pathname: "/category.htm" },
    { hostname: "jiyoujia492511957.jiyoujia.com", pathname: "/category.htm" },
    { hostname: "SHOP203317430.TAOBAO.COM", pathname: "/CATEGORY.HTM" },
  ];
  const rejected = [
    { hostname: "shopabc.taobao.com", pathname: "/category.htm" },
    { hostname: "item.taobao.com", pathname: "/item.htm" },
    { hostname: "shop203317430.taobao.com", pathname: "/" },
  ];

  for (const locationLike of accepted) {
    assert.equal(isSupportedCategoryLocation(locationLike), true);
  }
  for (const locationLike of rejected) {
    assert.equal(isSupportedCategoryLocation(locationLike), false);
  }
});

test("诊断 URL 隐去敏感参数但保留排查分页需要的参数", () => {
  const result = sanitizeUrl(
    "https://shop203317430.taobao.com/category.htm?pageNo=2&sessionToken=secret-value&spm=test#anchor"
  );

  assert.match(result, /pageNo=2/);
  assert.match(result, /spm=test/);
  assert.match(result, /sessionToken=%5Bredacted%5D/);
  assert.doesNotMatch(result, /secret-value/);
  assert.doesNotMatch(result, /#anchor/);
});

test("诊断字符串和超长 URL 会被限制长度", () => {
  assert.equal(truncate("abcdef", 4), "abcd…");
  const result = sanitizeUrl(`https://example.com/path?value=${"x".repeat(1000)}`);
  assert.ok(result.length <= 700);
});

test("诊断器识别 display、visibility、最大高度和裁切隐藏", () => {
  assert.equal(isStyleHidden({ style: { display: "none" }, height: 100 }), true);
  assert.equal(isStyleHidden({ style: { visibility: "hidden" }, height: 100 }), true);
  assert.equal(isStyleHidden({ style: { maxHeight: "0px" }, height: 100 }), true);
  assert.equal(
    isStyleHidden({ style: { overflow: "hidden" }, height: 0 }),
    true
  );
  assert.equal(
    isStyleHidden({ style: { display: "grid", visibility: "visible" }, height: 500 }),
    false
  );
});
