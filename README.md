# PixivDL Browser

PixivDL Browser 是一款轻量的 Pixiv 浏览器扩展：复用当前浏览器登录态，通过 PID 获取作品页，支持预览、多页选择、ZIP 或原图下载、收藏图库与本地缓存；无需本地后端，也不导入或保存 Pixiv Cookie。

它适合已经在 Chrome 或 Edge 中登录 Pixiv 的用户，用最短路径完成“输入 PID、检查图片、选择页面、保存作品”的本地工作流。

## 特性

- 按 Pixiv PID 获取插画和漫画作品信息。
- 展示标题、作者、页数、封面和每页图片预览。
- 支持单页、多页选择，以及一键全选、清空选择。
- 支持 ZIP 打包下载或逐张原图下载。
- 支持本地收藏夹，收藏卡片包含封面、标题、作者和页数。
- 支持在新标签页打开收藏图库，适合集中浏览已收藏作品。
- 使用浏览器当前 Pixiv 登录态，不需要复制、导入或保存 Cookie。
- 使用 IndexedDB 缓存作品信息、预览图和下载过的原图，降低重复请求。
- Pixiv 未登录、网络不可达或请求被拒绝时，显示登录、原页和外部检索入口。
- 使用 Manifest V3 和 `declarativeNetRequest` 为 Pixiv 图片请求补充必要的 Referer。

## 安装

### 从发布版安装

推荐普通用户从 [GitHub Releases](https://github.com/Jelee0145/pixivDL/releases/latest) 下载最新版 `PixivDL-Browser-*.zip`，解压后加载解压出来的扩展目录。

安装步骤：

1. 下载并解压发布包。
2. 打开 Chrome 或 Edge。
3. 进入 `chrome://extensions` 或 `edge://extensions`。
4. 打开“开发者模式”。
5. 点击“加载已解压的扩展程序”。
6. 选择解压后的 `PixivDL-Browser-*` 目录。

### 从源码安装

当前仓库提交的是扩展源码，不提交 `dist/` 打包产物。开发或本地调试时，可以直接加载源码目录：

```text
D:\pixivdl\extension
```

源码安装步骤：

1. 打开 Chrome 或 Edge。
2. 进入 `chrome://extensions` 或 `edge://extensions`。
3. 打开“开发者模式”。
4. 点击“加载已解压的扩展程序”。
5. 选择 `D:\pixivdl\extension`。

修改源码后，在扩展管理页点击刷新按钮即可重新加载。

## 使用

1. 先在同一个浏览器登录 `https://www.pixiv.net/`。
2. 点击浏览器工具栏里的 PixivDL 图标。
3. 输入作品 PID，点击“获取”。
4. 勾选需要下载的图片页面。
5. 选择 `ZIP` 或 `文件` 模式并下载。

如果当前浏览器没有可用的 Pixiv 登录态，插件会显示失败恢复面板。面板只负责打开新标签页，不会自动抓取、解析或下载第三方镜像来源。

下载由浏览器直接处理，默认保存到浏览器下载目录下的 `PixivDL` 子目录。

下载模式：

- `ZIP`：把选中的图片打包成一个压缩包。
- `文件`：逐张发起浏览器下载，多页作品会保存到 `PixivDL/{pid}_{标题}/` 下。

## 数据与隐私

- 扩展不读取、不导入、不持久化 Pixiv Cookie。
- Pixiv 登录态由浏览器对 `pixiv.net` 的正常 Cookie 机制自动携带。
- 收藏夹保存在浏览器扩展本地存储 `chrome.storage.local`。
- 收藏数据只包含 PID、标题、作者、图片数量和封面缩略图。
- 查询过的作品信息和图片缓存保存在扩展 IndexedDB 中。
- 扩展声明 `unlimitedStorage`，用于降低大图缓存被浏览器配额清理的概率。

## 目录结构

```text
extension/
  manifest.json   # Chrome/Edge Manifest V3 配置
  popup.html      # 扩展弹窗和收藏图库页面
  popup.css       # 界面样式
  popup.js        # Pixiv 请求、缓存、收藏和下载逻辑
  rules.json      # Pixiv 图片请求 Referer 规则
```

## 技术说明

- Pixiv 数据来自 `https://www.pixiv.net/ajax/illust/{pid}` 和对应 pages 接口。
- 图片资源来自 Pixiv 返回的页面 URL，扩展会缓存预览图和原图 Blob。
- ZIP 下载在浏览器端生成，不依赖本地服务。
- 收藏图库复用扩展页面，通过新标签页提供更宽的浏览空间。
- `dist/` 是发布产物目录，不纳入 Git；发布包通过 GitHub Releases 分发。

## 限制

- 只支持 Pixiv 静态插画和漫画图片，不支持 ugoira 动图。
- Pixiv 网页 AJAX 接口不是公开稳定 API，Pixiv 改站后可能需要维护。
- 如果浏览器或 Pixiv CDN 拒绝图片防盗链请求，预览或下载可能失败。
- 外部检索入口只用于手动查找 PID，不作为自动下载来源。
- 只应下载当前 Pixiv 账号有权限访问的内容，并遵守 Pixiv 及作者的使用规则。

## 项目简介

面向 Pixiv 重度浏览和本地整理场景的浏览器扩展。PixivDL Browser 把作品抓取、页面预览、批量选择、下载打包和收藏图库放进一个轻量弹窗里，让用户在不搭建后端、不处理 Cookie 的前提下，更安静、更直接地保存自己有权限访问的 Pixiv 图片。
