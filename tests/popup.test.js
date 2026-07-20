const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const {
  createStatusModel,
  formatPageLabel,
  isSupportedUrl,
  parseRepairActions,
} = require("../popup.js");

test("通用状态面板只支持数字店铺分类页", () => {
  assert.equal(
    isSupportedUrl("https://shop203317430.taobao.com/category.htm?pageNo=2"),
    true
  );
  assert.equal(
    isSupportedUrl("https://jiyoujia492511957.jiyoujia.com/category.htm"),
    true
  );
  assert.equal(isSupportedUrl("https://item.taobao.com/item.htm?id=1"), false);
  assert.equal(isSupportedUrl("https://shop203317430.taobao.com/"), false);
});

test("修复统计可解析旧值并为新字段提供默认值", () => {
  assert.deepEqual(
    parseRepairActions("headers:1,products:2,categories:3,overlays:4"),
    { headers: 1, products: 2, categories: 3, overlays: 4 }
  );
  assert.deepEqual(parseRepairActions("headers:1,products:2,categories:3"), {
    headers: 1,
    products: 2,
    categories: 3,
    overlays: 0,
  });
});

test("状态面板区分已修复和已启用未命中", () => {
  const repaired = createStatusModel(
    "repaired",
    "headers:0,products:0,categories:0,overlays:1"
  );
  assert.equal(repaired.title, "本页已修复");
  assert.equal(repaired.actions.overlays, 1);
  assert.match(repaired.detail, /1/);

  const active = createStatusModel(
    "active",
    "headers:0,products:0,categories:0,overlays:0"
  );
  assert.equal(active.title, "修复已启用");
  assert.equal(active.state, "success");
});

test("面板仅显示精简的店铺域名和路径", () => {
  assert.equal(
    formatPageLabel(
      "https://shop203317430.taobao.com/category.htm?spm=private-value&pageNo=2"
    ),
    "shop203317430.taobao.com/category.htm"
  );
});

test("诊断 JSON 默认折叠且面板宽度保持紧凑", () => {
  const html = fs.readFileSync(path.join(__dirname, "..", "popup.html"), "utf8");
  const css = fs.readFileSync(path.join(__dirname, "..", "popup.css"), "utf8");

  assert.match(html, /<details[^>]+id="result-section"[^>]+hidden>/);
  assert.match(html, /复制诊断信息/);
  assert.doesNotMatch(html, /v1\.6\.0/);
  assert.match(html, /id="extension-version"/);
  assert.match(css, /body\s*\{[^}]*width:\s*320px/is);
  assert.doesNotMatch(css, /min-height:\s*280px/);
});
