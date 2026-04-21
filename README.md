# PixivDL Browser

PixivDL Browser 是一个 Chrome/Edge 浏览器扩展，用于在已登录 Pixiv 的浏览器里按 PID 获取作品图片、预览、选择并下载。

当前项目已经只保留扩展形态，不再包含旧的 FastAPI 后端、React 本地 Web 前端、Python 虚拟环境或一键启动脚本。

## 安装

推荐直接加载源码扩展目录：

```text
D:\pixivdl\extension
```

安装步骤：

1. 打开 Chrome 或 Edge。
2. 进入 `chrome://extensions` 或 `edge://extensions`。
3. 打开开发者模式。
4. 点击“加载已解压的扩展程序”。
5. 选择 `D:\pixivdl\extension`。

源码目录在：

```text
D:\pixivdl\extension
```

每次修改源码后，在扩展管理页点击刷新按钮重新加载。

## 使用

1. 先在同一个浏览器登录 `https://www.pixiv.net/`。
2. 点击浏览器工具栏里的 PixivDL 图标。
3. 输入作品 PID，点击“获取”。
4. 勾选需要下载的图片。
5. 选择 `ZIP` 或 `文件` 模式并下载。

下载由浏览器直接处理，会进入浏览器默认下载目录下的 `PixivDL` 子目录。

## 功能

- 按 Pixiv PID 获取插画/漫画作品信息。
- 显示作品标题、作者、页数和图片预览。
- 支持单页或多页选择。
- 支持 ZIP 打包下载或逐张文件下载。
- 支持本地收藏夹，收藏卡片显示封面和图片数量。
- 支持在新标签页浏览收藏图库。
- 使用浏览器当前 Pixiv 登录态，不导入、不保存 Pixiv Cookie。
- 查询过的作品信息和图片缓存保存在扩展自己的浏览器本地存储中。

## 保留目录

```text
D:\pixivdl\extension
D:\pixivdl\.impeccable.md
```

## 限制

- 只支持 Pixiv 静态插画/漫画图片，不支持 ugoira 动图。
- Pixiv 网页 AJAX 接口不是公开稳定 API，Pixiv 改站后可能需要维护。
- 只应下载当前 Pixiv 账号有权限访问的内容。
