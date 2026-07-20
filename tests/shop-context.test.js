const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  classifyShopContext,
  isCandidateCategoryLocation,
  isCandidateHomeLocation,
} = require("../shop-context.js");

function createDocument({ selectors = {}, title = "" } = {}) {
  return {
    title,
    querySelector(selector) {
      return selectors[selector]?.[0] || null;
    },
    querySelectorAll(selector) {
      return selectors[selector] || [];
    },
  };
}

test("数字淘宝和极有家域名无需 DOM 信号即可确认", () => {
  for (const hostname of [
    "shop203317430.taobao.com",
    "jiyoujia492511957.jiyoujia.com",
  ]) {
    const result = classifyShopContext(
      { hostname, pathname: "/category.htm" },
      createDocument()
    );
    assert.equal(result.supported, true);
    assert.equal(result.hostType, "numeric");
    assert.equal(result.reason, "numeric-shop-host");
  }
});

test("自定义淘宝和极有家域名必须通过店铺结构识别", () => {
  const shopDocument = createDocument({
    title: "首页-有点艺术灯具馆-淘宝网",
    selectors: {
      '[class*="tshop-"]': [{}],
      'a[href*="/category.htm"]': [{}, {}],
      'a[href*="item.taobao.com/item.htm"]': [{}, {}, {}, {}],
    },
  });

  for (const hostname of [
    "ikfs0orn453wy1jhzjt0c5bydawewrm.taobao.com",
    "custom-showroom.jiyoujia.com",
  ]) {
    const result = classifyShopContext(
      { hostname, pathname: "/category.htm" },
      shopDocument
    );
    assert.equal(result.supported, true);
    assert.equal(result.hostType, "custom");
    assert.ok(result.score >= result.requiredScore);
    assert.ok(result.signals.includes("legacy-shop-structure"));
  }
});

test("随机平台子域名没有足够店铺信号时拒绝", () => {
  const result = classifyShopContext(
    {
      hostname: "random-subdomain.taobao.com",
      pathname: "/category.htm",
    },
    createDocument({ title: "淘宝网" })
  );

  assert.equal(result.supported, false);
  assert.equal(result.reason, "shop-signals-not-found");
});

test("普通淘宝页面即使伪造部分信号也明确拒绝", () => {
  const partialSignals = createDocument({
    title: "测试店铺-淘宝网",
    selectors: {
      '[class*="tshop-"]': [{}],
      'a[href*="/category.htm"]': [{}, {}],
      'a[href*="item.taobao.com/item.htm"]': [{}, {}, {}],
    },
  });

  for (const hostname of [
    "www.taobao.com",
    "item.taobao.com",
    "s.taobao.com",
  ]) {
    const result = classifyShopContext(
      { hostname, pathname: "/category.htm" },
      partialSignals
    );
    assert.equal(result.supported, false);
    assert.equal(result.reason, "excluded-platform-host");
  }
});

test("首页和分类页候选路径保持严格", () => {
  assert.equal(
    isCandidateHomeLocation({ hostname: "custom.taobao.com", pathname: "/" }),
    true
  );
  assert.equal(
    isCandidateHomeLocation({ hostname: "custom.jiyoujia.com", pathname: "/index.htm" }),
    true
  );
  assert.equal(
    isCandidateHomeLocation({ hostname: "item.taobao.com", pathname: "/" }),
    false
  );
  assert.equal(
    isCandidateCategoryLocation({
      hostname: "custom.taobao.com",
      pathname: "/category.htm",
    }),
    true
  );
  assert.equal(
    isCandidateCategoryLocation({
      hostname: "custom.taobao.com",
      pathname: "/item.htm",
    }),
    false
  );
});

test("跳转、修复、诊断和面板不再各自维护数字域名正则", () => {
  for (const file of [
    "redirect-home.js",
    "repair-category.js",
    "diagnostics-page.js",
    "popup.js",
  ]) {
    const source = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
    assert.match(source, /ShopCategoryContext|shop-context\.js/);
    assert.doesNotMatch(source, /shop\\d\+|jiyoujia\\d\+/);
  }
});
