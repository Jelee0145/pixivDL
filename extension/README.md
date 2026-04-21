# PixivDL Browser Extension

这是 PixivDL 的浏览器扩展版本。它不需要本地后端，不需要导入 Cookie，直接使用当前浏览器里的 Pixiv 登录态。

## 安装

1. 打开 Chrome 或 Edge。
2. 进入扩展管理页：
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
3. 打开“开发者模式”。
4. 点击“加载已解压的扩展”。
5. 为了后续升级保留收藏数据，推荐选择稳定目录：

```text
D:\pixivdl\dist\PixivDL-Browser-current
```

也可以加载版本目录 `D:\pixivdl\dist\PixivDL-Browser-0.4.8`，但后续需要继续覆盖同一个目录并刷新扩展，避免 Chrome 把新目录识别为另一个扩展。

开发调试时也可以直接加载源码目录 `D:\pixivdl\extension`。

## 使用

1. 先在同一个浏览器里登录 `https://www.pixiv.net/`。
2. 点击浏览器工具栏里的 PixivDL 扩展图标。
3. 输入作品 PID，点击“获取”。
4. 勾选图片，选择 ZIP 或文件模式，然后点击下载。
5. 需要浏览收藏图库时，切换到收藏夹并点击“新标签浏览”。

下载由浏览器直接处理，文件会进入浏览器默认下载目录下的 `PixivDL` 子目录。

如果接口获取失败，空状态区会显示“前往 Pixiv 查看”，用于打开当前 PID 的 Pixiv 原作品页。
普通弹窗切换到收藏夹后，顶部输入框会改为本地收藏搜索，支持按标题、作者和 PID 筛选；新标签收藏仓库也有独立搜索框，点击封面会在右侧显示作品详情。
扩展包含 16/32/48/128 像素图标，用于浏览器工具栏、扩展管理页和系统界面展示。

- `ZIP`：把选中的图片打包成一个 ZIP。
- `文件`：逐张发起浏览器下载，多图会保存到 `PixivDL/{pid}_{标题}/` 下。

## 数据保存

- 扩展不读取、不导入、不保存 Pixiv Cookie。
- Pixiv 登录态由浏览器对 `pixiv.net` 的正常 Cookie 自动携带。
- 扩展会用 Chrome 的 `declarativeNetRequest` 给 `i.pximg.net` 图片请求补 `Referer: https://www.pixiv.net/`，用于通过 Pixiv 图片防盗链检查。
- 收藏夹保存在浏览器扩展本地存储 `chrome.storage.local`。
- 收藏只保存 PID、标题、作者、图片数量和封面缩略图。
- 查询过的作品信息、预览图和下载过的原图会缓存到浏览器扩展的 IndexedDB 中；扩展声明了 `unlimitedStorage` 用于降低大图缓存被浏览器配额清理的概率。

## 升级保留数据

收藏夹和缓存跟 Chrome 扩展 ID 绑定。为了保留旧数据，升级时应覆盖同一个已加载的扩展目录，然后在扩展管理页点击刷新；不要先移除旧扩展，也不要每次加载一个全新的版本号目录。

如果加载了新目录，Chrome 可能会给它新的扩展 ID，新扩展就看不到旧扩展 ID 下的收藏和缓存。

## 限制

- 只支持静态插画/漫画图片，不支持 ugoira 动图。
- 如果 Pixiv 改动网页 AJAX 接口，需要维护扩展脚本。
- 如果浏览器或 Pixiv CDN 拒绝图片防盗链请求，预览或下载可能失败；这种情况会在界面提示错误。
