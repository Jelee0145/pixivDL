# PixivDL Browser

PixivDL Browser 是一款轻量的 Pixiv 浏览器扩展：复用当前浏览器登录态，通过 PID 获取作品页，支持预览、多页选择、ZIP 或原图下载、收藏图库与本地缓存；无需本地后端，也不导入或保存 Pixiv Cookie。

它适合已经在 Chrome 或 Edge 中登录 Pixiv 的用户，用最短路径完成“输入 PID、检查图片、选择页面、保存作品”的本地工作流。

## 特性

- 按 Pixiv PID 获取插画和漫画作品信息。
- 展示标题、作者、页数、封面和每页图片预览。
- 支持单页、多页选择，以及一键全选、清空选择。
- 支持 ZIP 打包下载或逐张原图下载。
- 支持自定义浏览器下载目录下的保存子目录。
- 支持在扩展内启用本地 HTTP/HTTPS/SOCKS 代理。
- 支持本地收藏夹，收藏卡片包含封面、标题、作者和页数。
- 支持在新标签页打开收藏仓库，提供搜索、图库浏览、右侧作品详情、收藏导入/导出和作品下载。
- 弹窗按“作品预览 / 图片选择 / 浏览器下载”三栏组织，收藏状态、已选数量和下载进度会即时反馈。
- 提供 16/32/48/128 像素扩展图标，浏览器工具栏和扩展管理页识别更清晰。
- 使用浏览器当前 Pixiv 登录态，不需要复制、导入或保存 Cookie。
- 使用 IndexedDB 缓存作品信息、预览图和下载过的原图，降低重复请求。
- Pixiv 未登录、网络不可达或请求被拒绝时，在空状态区显示 Pixiv 原页入口。
- 使用 Manifest V3 和 `declarativeNetRequest` 为 Pixiv 图片请求补充必要的 Referer。

## 安装

### 从发布版安装

推荐普通用户从 [GitHub Releases](https://github.com/Jelee0145/pixivDL/releases/latest) 下载最新版 `PixivDL-Browser-*.zip`。为了后续升级保留收藏和缓存，建议解压或覆盖到一个固定目录，例如：

```text
D:\pixivdl\dist\PixivDL-Browser-latest
```

当前仓库对应的最新发布包示例：`PixivDL-Browser-0.5.2.zip`。

安装步骤：

1. 下载发布包并解压到固定目录。
2. 打开 Chrome 或 Edge。
3. 进入 `chrome://extensions` 或 `edge://extensions`。
4. 打开“开发者模式”。
5. 点击“加载已解压的扩展程序”。
6. 选择解压后的固定目录，例如 `PixivDL-Browser-latest`。

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
4. 在左侧确认作品信息和收藏状态，在中间勾选需要下载的图片页面。
5. 在右侧选择 `ZIP` 或 `文件` 模式，确认保存目录后点击下载。

如果接口获取失败，空状态区会显示“前往 Pixiv 查看”，用于打开当前 PID 的 Pixiv 原作品页。

弹窗顶部的“打开完整工作台”可把当前 PID 带到新标签页，以更宽的三栏工作台继续选择和下载。弹窗收藏夹用于快速搜索本地收藏；新标签页收藏仓库会展开为图库，导入/导出按钮位于标题右侧，搜索框固定在图库顶部，点击卡片可在右侧查看详情。每个收藏卡片右上角提供下载和删除按钮，下载时可选择 ZIP 或文件模式。

下载由浏览器直接处理，默认保存到浏览器下载目录下的 `PixivDL` 子目录。
保存目录可在下载面板中修改，界面会显示为 `浏览器下载目录\PixivDL` 这样的完整有效位置，实际传给浏览器下载 API 的仍是相对目录；“浏览”按钮用于打开浏览器默认下载目录。
本地代理设置只作用于当前浏览器配置文件，不修改 Windows 系统代理。

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

## 升级与数据留存

Chrome 的 `chrome.storage.local` 和 IndexedDB 数据跟“扩展 ID”绑定。未打包上架的本地解压扩展，扩展 ID 通常跟加载目录有关。

推荐更新方式：

1. 第一次安装后，后续都覆盖同一个扩展目录。
2. 在 `chrome://extensions` 里点击该扩展的刷新按钮。
3. 不要先移除旧扩展，也不要每个版本都加载一个新的版本号目录。

这样收藏夹和缓存会继续保留。若加载了一个全新的目录，Chrome 可能会把它当成另一个扩展，旧收藏仍在旧扩展 ID 下面，新扩展无法直接读取。

本地调试时推荐固定加载：

```text
D:\pixivdl\dist\PixivDL-Browser-latest
```

## 目录结构

```text
extension/
  manifest.json   # Chrome/Edge Manifest V3 配置
  popup.html      # 扩展弹窗和收藏图库页面
  popup.css       # 界面样式
  popup.js        # Pixiv 请求、缓存、收藏和下载逻辑
  rules.json      # Pixiv 图片请求 Referer 规则
  icons/          # 扩展图标
```

## 技术说明

- Pixiv 数据来自 `https://www.pixiv.net/ajax/illust/{pid}` 和对应 pages 接口。
- 图片资源来自 Pixiv 返回的页面 URL，扩展会缓存预览图和原图 Blob。
- ZIP 下载在浏览器端生成，不依赖本地服务。
- 收藏图库复用扩展页面，通过新标签页提供更宽的浏览空间。
- `dist/` 是发布产物目录，不纳入 Git；发布包通过 GitHub Releases 分发。
- 发布 workflow 会从 `extension/` 重新打包扩展，并把图标资源一起放入 Release zip。

## 限制

- 只支持 Pixiv 静态插画和漫画图片，不支持 ugoira 动图。
- Pixiv 网页 AJAX 接口不是公开稳定 API，Pixiv 改站后可能需要维护。
- 如果浏览器或 Pixiv CDN 拒绝图片防盗链请求，预览或下载可能失败。
- 只应下载当前 Pixiv 账号有权限访问的内容，并遵守 Pixiv 及作者的使用规则。

## 项目简介

面向 Pixiv 重度浏览和本地整理场景的浏览器扩展。PixivDL Browser 把作品抓取、页面预览、批量选择、下载打包和收藏图库放进一个轻量弹窗里，让用户在不搭建后端、不处理 Cookie 的前提下，更安静、更直接地保存自己有权限访问的 Pixiv 图片。
