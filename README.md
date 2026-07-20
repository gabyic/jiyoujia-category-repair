# 淘宝/极有家店铺页修复扩展

这个 Manifest V3 扩展作用于数字店铺编号格式的极有家和淘宝店铺：

```text
https://jiyoujia<店铺编号>.jiyoujia.com/
https://jiyoujia<店铺编号>.jiyoujia.com/index.htm
https://jiyoujia<店铺编号>.jiyoujia.com/category.htm*

https://shop<店铺编号>.taobao.com/
https://shop<店铺编号>.taobao.com/index.htm
https://shop<店铺编号>.taobao.com/category.htm*
```

访问受支持店铺的首页 `/` 或 `/index.htm` 时，扩展会立即跳转到该店铺干净的 `/category.htm`。分类页加载时，扩展会先应用已知旧版店铺结构的兼容样式，再由条件式 JavaScript 检测异常超高店招，以及确实被隐藏且包含足够商品或分类链接的模块。只有满足异常条件的节点才会被恢复；检测规则会排除常见弹窗、轮播、移动菜单和带 `aria-hidden` 的交互区域。

扩展只检查当前地址和页面本地显示状态，不读取账户、订单或商品业务数据，不发送诊断数据，也不会修改店铺线上代码。

为了兼容所有 `shop数字.taobao.com` 店铺，Chrome/Edge 会显示扩展可访问 `taobao.com` 的权限。扩展实际只在 `shop*.taobao.com` 页面注入，并在执行首页跳转前再次校验域名必须符合 `shop数字.taobao.com`；淘宝首页、搜索页、商品详情页等不会触发店铺首页跳转。

## Chrome 安装

1. 点击 GitHub 页面右上角的 `Code` → `Download ZIP`，下载后解压；也可以使用 Git 克隆本仓库。
2. 打开 `chrome://extensions/`。
3. 打开右上角“开发者模式”。
4. 点击“加载已解压的扩展程序”。
5. 选择解压后的 `jiyoujia-category-repair` 文件夹，确保该文件夹内直接包含 `manifest.json`。
6. 打开数字编号的淘宝或极有家店铺首页，验证扩展是否生效。

只有修改扩展源码后，才需要回到扩展管理页面点击“重新加载”。

## Edge 安装

1. 点击 GitHub 页面右上角的 `Code` → `Download ZIP`，下载后解压；也可以使用 Git 克隆本仓库。
2. 打开 `edge://extensions/`。
3. 打开“开发人员模式”。
4. 点击“加载解压缩的扩展”。
5. 选择解压后的 `jiyoujia-category-repair` 文件夹，确保该文件夹内直接包含 `manifest.json`。
6. 打开数字编号的淘宝或极有家店铺首页，验证扩展是否生效。

只有修改扩展源码后，才需要回到扩展管理页面点击“重新加载”。

## 验证

1. 打开任意数字编号淘宝或极有家店铺带或不带查询参数的首页 `/` 或 `/index.htm`。
2. 确认地址自动变为 `/category.htm`，并且浏览器后退不会停留在损坏的首页。
3. 确认超高空白店招和错误 GIF 背景消失。
4. 确认店铺分类导航和商品列表恢复显示。
5. 确认页面显示该店铺实际商品数量和分页信息。
6. 手动点击第 2 页；页面刷新后确认扩展仍然生效，并显示第 2 页商品。
7. 打开分类页、翻页页面和商品详情页，确认没有发生错误的首页跳转。

### 本地诊断

在分类页的开发者工具 Console 中运行：

```js
document.documentElement.getAttribute("data-shop-category-repair")
document.documentElement.getAttribute("data-shop-category-repair-actions")
```

- `active`：1.4.0 条件式脚本已经运行，但当前检测没有命中异常节点。
- `repaired`：脚本已经修复至少一个异常节点。
- `headers:1,products:1,categories:1`：分别表示当前页面累计标记的店招、商品容器和分类容器数量；实际数字会因店铺结构而变化。
- 返回 `null`：当前页面不是受支持的数字店铺分类页，或扩展尚未重新加载到 1.4.0。

## 停用或删除

在 `chrome://extensions/` 或 `edge://extensions/` 中关闭或移除“淘宝/极有家店铺页修复”即可。删除扩展不会影响店铺线上页面。

## 作用边界

- 扩展只修复浏览器本地显示，不会修改淘宝/极有家服务器上的装修代码。
- 扩展清单匹配 `https://*.jiyoujia.com/*` 和 `https://*.taobao.com/*`；淘宝内容脚本通过 `include_globs` 限定到 `shop*.taobao.com`，首页跳转脚本还会严格校验域名必须符合 `jiyoujia数字.jiyoujia.com` 或 `shop数字.taobao.com`。
- `www.taobao.com`、`item.taobao.com`、`s.taobao.com` 等非店铺子域名不会触发首页跳转。
- 首页跳转只在根路径 `/` 或 `/index.htm` 生效，分类页、翻页和商品详情页不会重复跳转。
- 首页跳转使用干净的 `/category.htm`，不会携带旧页面的 `callback`、`pageNo` 或 `_ksTS` 参数。
- 旧版已知 DOM 继续由 `repair.css` 兼容；其他结构由 `repair-category.js` 按异常状态检测。淘宝若彻底改变商品链接或页面渲染方式，仍可能需要升级检测规则。
- Codex 内置浏览器不保证支持加载本地 Chrome/Edge 扩展，建议在桌面版 Chrome 或 Edge 中使用。
