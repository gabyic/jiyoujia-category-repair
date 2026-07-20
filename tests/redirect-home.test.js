const test = require("node:test");
const assert = require("node:assert/strict");

const { getHomeRedirectDecision } = require("../redirect-home.js");

test("数字店铺首页可以在 DOM 尚未加载时立即跳转", () => {
  const decision = getHomeRedirectDecision(
    { hostname: "shop203317430.taobao.com", pathname: "/", origin: "https://shop203317430.taobao.com" },
    null
  );

  assert.equal(decision.redirect, true);
  assert.equal(decision.waitForDocument, false);
  assert.equal(decision.target, "https://shop203317430.taobao.com/category.htm");
});

test("自定义域名首页必须等 DOM 店铺信号确认后跳转", () => {
  const locationLike = {
    hostname: "ikfs0orn453wy1jhzjt0c5bydawewrm.taobao.com",
    pathname: "/",
    origin: "https://ikfs0orn453wy1jhzjt0c5bydawewrm.taobao.com",
  };

  const pending = getHomeRedirectDecision(locationLike, null);
  assert.equal(pending.redirect, false);
  assert.equal(pending.waitForDocument, true);

  const shopDocument = {
    title: "首页-有点艺术灯具馆-淘宝网",
    querySelector(selector) {
      return selector === '[class*="tshop-"]' ? {} : null;
    },
    querySelectorAll(selector) {
      if (selector === 'a[href*="/category.htm"]') return [{}, {}];
      if (selector === 'a[href*="item.taobao.com/item.htm"]') return [{}, {}, {}];
      return [];
    },
  };
  const confirmed = getHomeRedirectDecision(locationLike, shopDocument);
  assert.equal(confirmed.redirect, true);
  assert.equal(confirmed.waitForDocument, false);
});

test("普通淘宝页面和无店铺信号自定义域名不会跳转", () => {
  const emptyDocument = {
    title: "淘宝网",
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
  };

  assert.equal(
    getHomeRedirectDecision(
      { hostname: "www.taobao.com", pathname: "/", origin: "https://www.taobao.com" },
      emptyDocument
    ).redirect,
    false
  );
  assert.equal(
    getHomeRedirectDecision(
      { hostname: "random.taobao.com", pathname: "/", origin: "https://random.taobao.com" },
      emptyDocument
    ).redirect,
    false
  );
});
