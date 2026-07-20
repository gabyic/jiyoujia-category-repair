const test = require("node:test");
const assert = require("node:assert/strict");
const manifest = require("../manifest.json");

const {
  applyImportantStyles,
  countRepairRoles,
  createMutationObserver,
  isEffectivelyHidden,
  isSupportedCategoryLocation,
  shouldRepairOversizedElement,
  shouldRestoreLinkGroup,
} = require("../repair-category.js");

test("Manifest 1.4.0 在两类数字店铺分类页注入条件式脚本", () => {
  assert.equal(manifest.version, "1.4.0");
  const repairEntries = manifest.content_scripts.filter((entry) =>
    entry.js?.includes("repair-category.js")
  );

  assert.equal(repairEntries.length, 2);
  assert.ok(
    repairEntries.some((entry) =>
      entry.matches.includes("https://*.jiyoujia.com/category.htm*")
    )
  );
  assert.ok(
    repairEntries.some(
      (entry) =>
        entry.matches.includes("https://*.taobao.com/category.htm*") &&
        entry.include_globs.includes("https://shop*.taobao.com/category.htm*")
    )
  );
});

test("只匹配数字极有家和数字淘宝店铺分类页", () => {
  const accepted = [
    ["jiyoujia492511957.jiyoujia.com", "/category.htm"],
    ["shop203317430.taobao.com", "/category.htm"],
    ["SHOP203317430.TAOBAO.COM", "/CATEGORY.HTM"],
  ];
  const rejected = [
    ["www.taobao.com", "/category.htm"],
    ["item.taobao.com", "/category.htm"],
    ["shopabc.taobao.com", "/category.htm"],
    ["shop203317430.taobao.com", "/"],
    ["shop203317430.taobao.com", "/item.htm"],
  ];

  for (const [hostname, pathname] of accepted) {
    assert.equal(isSupportedCategoryLocation({ hostname, pathname }), true);
  }
  for (const [hostname, pathname] of rejected) {
    assert.equal(isSupportedCategoryLocation({ hostname, pathname }), false);
  }
});

test("只修复靠近页面顶部且异常超高的店招候选", () => {
  assert.equal(
    shouldRepairOversizedElement({
      height: 1500,
      top: 80,
      viewportHeight: 800,
      hint: "tb-shop-header",
      productLinkCount: 0,
    }),
    true
  );
  assert.equal(
    shouldRepairOversizedElement({
      height: 360,
      top: 80,
      viewportHeight: 800,
      hint: "tb-shop-header",
      productLinkCount: 0,
    }),
    false
  );
  assert.equal(
    shouldRepairOversizedElement({
      height: 1500,
      top: 80,
      viewportHeight: 800,
      hint: "product-grid",
      productLinkCount: 24,
    }),
    false
  );
});

test("识别 display、visibility、零高度裁切等隐藏状态", () => {
  assert.equal(isEffectivelyHidden({ style: { display: "none" } }), true);
  assert.equal(isEffectivelyHidden({ style: { visibility: "hidden" } }), true);
  assert.equal(isEffectivelyHidden({ style: { maxHeight: "0px" } }), true);
  assert.equal(
    isEffectivelyHidden({
      style: { overflow: "hidden" },
      height: 0,
      hasContent: true,
    }),
    true
  );
  assert.equal(
    isEffectivelyHidden({ style: { display: "grid" }, height: 600, hasContent: true }),
    false
  );
});

test("商品组需要足够商品链接或明确的商品容器特征", () => {
  assert.equal(
    shouldRestoreLinkGroup({
      kind: "products",
      hidden: true,
      excluded: false,
      linkCount: 12,
      hint: "unknown-module",
    }),
    true
  );
  assert.equal(
    shouldRestoreLinkGroup({
      kind: "products",
      hidden: true,
      excluded: false,
      linkCount: 3,
      hint: "shop-product-list",
    }),
    true
  );
  assert.equal(
    shouldRestoreLinkGroup({
      kind: "products",
      hidden: true,
      excluded: true,
      linkCount: 20,
      hint: "mobile-carousel",
    }),
    false
  );
  assert.equal(
    shouldRestoreLinkGroup({
      kind: "products",
      hidden: false,
      excluded: false,
      linkCount: 20,
      hint: "product-list",
    }),
    false
  );
});

test("分类组必须隐藏、包含多个分类链接且具有导航特征", () => {
  assert.equal(
    shouldRestoreLinkGroup({
      kind: "categories",
      hidden: true,
      excluded: false,
      linkCount: 4,
      hint: "shop-category-nav",
    }),
    true
  );
  assert.equal(
    shouldRestoreLinkGroup({
      kind: "categories",
      hidden: true,
      excluded: false,
      linkCount: 1,
      hint: "shop-category-nav",
    }),
    false
  );
});

test("修复样式全部使用 important 并写入本地诊断标记", () => {
  const calls = [];
  const attributes = new Map();
  const element = {
    style: {
      setProperty(property, value, priority) {
        calls.push([property, value, priority]);
      },
    },
    setAttribute(name, value) {
      attributes.set(name, value);
    },
  };

  assert.equal(
    applyImportantStyles(element, { display: "block", height: "auto" }, "products"),
    true
  );
  assert.deepEqual(calls, [
    ["display", "block", "important"],
    ["height", "auto", "important"],
  ]);
  assert.equal(attributes.get("data-shop-category-repair-role"), "products");
});

test("诊断数量按页面已修复节点累计，不会被后续复检清零", () => {
  const counts = {
    header: 1,
    products: 2,
    categories: 1,
  };
  const documentLike = {
    querySelectorAll(selector) {
      const role = selector.match(/="([^"]+)"/)?.[1];
      return Array.from({ length: counts[role] || 0 });
    },
  };

  assert.deepEqual(countRepairRoles(documentLike), {
    headers: 1,
    products: 2,
    categories: 1,
  });
});

test("MutationObserver 只为外部动态变化安排再次修复", () => {
  let callback;
  let observedOptions;
  let schedules = 0;
  class FakeMutationObserver {
    constructor(handler) {
      callback = handler;
    }

    observe(_target, options) {
      observedOptions = options;
    }
  }

  const observer = createMutationObserver(
    { MutationObserver: FakeMutationObserver },
    {},
    () => {
      schedules += 1;
    }
  );

  assert.ok(observer);
  assert.equal(observedOptions.subtree, true);

  callback([{ type: "childList", addedNodes: [{}], target: {} }]);
  assert.equal(schedules, 1);

  callback([
    {
      type: "attributes",
      target: { hasAttribute: () => true },
    },
  ]);
  assert.equal(schedules, 1);

  callback([
    {
      type: "attributes",
      target: { hasAttribute: () => false },
    },
  ]);
  assert.equal(schedules, 2);
});
