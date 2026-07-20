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

访问受支持店铺的首页 `/` 或 `/index.htm` 时，扩展会立即跳转到该店铺干净的 `/category.htm`。分类页加载时，扩展会先应用已知旧版店铺结构的兼容样式，再由条件式 JavaScript 检测异常超高店招，以及确实被隐藏且包含足够商品或分类链接的模块。只有满足异常条件的节点才会被恢复；普通弹窗、轮播、移动菜单和带 `aria-hidden` 的交互区域不会被当作商品或分类容器恢复。

扩展工具栏提供适用于所有受支持数字店铺的紧凑状态面板。打开后会显示本页是否已启用修复，以及店招、商品、分类和损坏弹层的命中数量。完整诊断仅在用户点击“复制诊断信息”时运行，详细 JSON 默认折叠。

从 1.6.0 开始，扩展会额外检测“处于隐藏状态、尺寸异常巨大、子节点仍覆盖视口”的损坏弹层。命中后只会在 `popup-hidden`、`overlay-hidden`、`ks-overlay-hidden` 或 `aria-hidden="true"` 仍存在时将它隐藏；店铺脚本移除隐藏状态后，样式会自动失效，正常激活的分类菜单可以重新显示。

扩展只检查当前地址和页面本地显示状态，不读取 Cookie、本地存储、账户、订单、输入内容或商品业务数据，不发送诊断数据，也不会修改店铺线上代码。一键诊断只有在用户点击扩展按钮时才读取当前标签页的显示结构。

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

推荐使用 1.6.0 的通用状态面板：

1. 打开异常的数字淘宝或极有家店铺 `/category.htm` 分类页。
2. 点击浏览器工具栏中的“淘宝/极有家店铺页修复”扩展图标。
3. 先确认面板显示“修复已启用”或“本页已修复”及各类命中数量。
4. 需要进一步排查时，点击“复制诊断信息”。
5. 看到“诊断信息已复制”后，直接把剪贴板内容粘贴给维护者。
6. 如果浏览器阻止自动复制，可展开“查看详细诊断”手动复制或下载 JSON。

诊断 JSON 包含当前网址、页面尺寸、修复状态、商品/分类/分页链接数量、隐藏商品祖先、异常大型容器、弹层候选、iframe 和关键计算样式。弹层候选会标明隐藏状态、异常尺寸、是否覆盖视口、商品链接数及 `likelyBroken`。节点名称和字符串长度均会限制，诊断器不会读取 Cookie、Local Storage、订单、账户或输入框内容，结果不会自动上传。

也可以在分类页的开发者工具 Console 中运行下面两个简易检查：

```js
document.documentElement.getAttribute("data-shop-category-repair")
document.documentElement.getAttribute("data-shop-category-repair-actions")
```

- `active`：条件式脚本已经运行，但当前检测没有命中异常节点。
- `repaired`：脚本已经修复至少一个异常节点。
- `headers:1,products:1,categories:1,overlays:1`：分别表示当前页面累计标记的店招、商品容器、分类容器和损坏弹层数量；实际数字会因店铺结构而变化。
- 返回 `null`：当前页面不是受支持的数字店铺分类页，或扩展尚未重新加载到当前版本。

## 停用或删除

在 `chrome://extensions/` 或 `edge://extensions/` 中关闭或移除“淘宝/极有家店铺页修复”即可。删除扩展不会影响店铺线上页面。

## 作用边界

- 扩展只修复浏览器本地显示，不会修改淘宝/极有家服务器上的装修代码。
- 扩展清单匹配 `https://*.jiyoujia.com/*` 和 `https://*.taobao.com/*`；淘宝内容脚本通过 `include_globs` 限定到 `shop*.taobao.com`，首页跳转脚本还会严格校验域名必须符合 `jiyoujia数字.jiyoujia.com` 或 `shop数字.taobao.com`。
- `www.taobao.com`、`item.taobao.com`、`s.taobao.com` 等非店铺子域名不会触发首页跳转。
- 首页跳转只在根路径 `/` 或 `/index.htm` 生效，分类页、翻页和商品详情页不会重复跳转。
- 首页跳转使用干净的 `/category.htm`，不会携带旧页面的 `callback`、`pageNo` 或 `_ksTS` 参数。
- 旧版已知 DOM 继续由 `repair.css` 兼容；其他结构由 `repair-category.js` 按异常状态检测。淘宝若彻底改变商品链接或页面渲染方式，仍可能需要升级检测规则。
- 损坏弹层修复是条件式且可逆的：必须同时具有隐藏状态、弹层语义、异常尺寸和覆盖视口的子节点，且不能是商品列表；隐藏状态解除后不再强制隐藏。
- Codex 内置浏览器不保证支持加载本地 Chrome/Edge 扩展，建议在桌面版 Chrome 或 Edge 中使用。
