# 极有家店铺页修复扩展

这个 Manifest V3 扩展作用于数字店铺编号格式的极有家店铺：

```text
https://jiyoujia<店铺编号>.jiyoujia.com/
https://jiyoujia<店铺编号>.jiyoujia.com/index.htm
https://jiyoujia<店铺编号>.jiyoujia.com/category.htm*
```

访问店铺首页 `/` 或 `/index.htm` 时，扩展会立即跳转到该店铺干净的 `/category.htm`；分类页加载时会覆盖店铺装修样式中的异常规则，恢复正常店招、分类导航和商品列表。扩展只检查当前地址，不读取商品或账户数据，不申请 `taobao.com` 权限，也不会修改店铺线上代码。

## Chrome 安装

1. 打开 `chrome://extensions/`。
2. 打开右上角“开发者模式”。
3. 点击“加载已解压的扩展程序”。
4. 选择本目录：

   ```text
   /Users/zoupengfei/Documents/shopfiy/browser-extensions/jiyoujia-category-repair
   ```

5. 回到扩展页面点击本扩展的“重新加载”，然后打开店铺首页验证。

## Edge 安装

1. 打开 `edge://extensions/`。
2. 打开“开发人员模式”。
3. 点击“加载解压缩的扩展”。
4. 选择本目录；修改扩展文件后，需要在扩展页面点击“重新加载”。

## 验证

1. 打开任意数字编号极有家店铺带或不带查询参数的首页 `/` 或 `/index.htm`。
2. 确认地址自动变为 `/category.htm`，并且浏览器后退不会停留在损坏的首页。
3. 确认超高空白店招和错误 GIF 背景消失。
4. 确认店铺分类导航和商品列表恢复显示。
5. 确认页面显示该店铺实际商品数量和分页信息。
6. 手动点击第 2 页；页面刷新后确认扩展仍然生效，并显示第 2 页商品。
7. 打开分类页、翻页页面和商品详情页，确认没有发生错误的首页跳转。

## 停用或删除

在 `chrome://extensions/` 或 `edge://extensions/` 中关闭或移除“极有家店铺页修复”即可。删除扩展不会影响店铺线上页面。

## 作用边界

- 扩展只修复浏览器本地显示，不会修改淘宝/极有家服务器上的装修代码。
- 扩展清单匹配 `https://*.jiyoujia.com/*`，但首页跳转脚本还会校验域名必须符合 `jiyoujia数字.jiyoujia.com`。
- 首页跳转只在根路径 `/` 或 `/index.htm` 生效，分类页、翻页和商品详情页不会重复跳转。
- 首页跳转使用干净的 `/category.htm`，不会携带旧页面的 `callback`、`pageNo` 或 `_ksTS` 参数。
- 如果店铺以后修改 DOM 类名或页面结构，需要同步更新 `repair.css`。
- Codex 内置浏览器不保证支持加载本地 Chrome/Edge 扩展，建议在桌面版 Chrome 或 Edge 中使用。
