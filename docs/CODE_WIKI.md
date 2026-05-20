# PixivDL Browser Extension - Code Wiki

## 1. 项目概述

### 1.1 项目简介

**PixivDL Browser** 是一个 Chrome/Edge Manifest V3 浏览器扩展，用于通过 PID（作品ID）获取 Pixiv 艺术作品并下载选中的图片。

### 1.2 核心功能

- 通过 PID 获取 Pixiv 作品信息和图片列表
- 预览和选择性地下载图片（单文件或 ZIP 打包）
- 本地收藏夹管理（收藏、搜索、导入/导出）
- 本地代理设置
- 图片缓存以提升性能
- 支持在 popup 或新标签页中打开

### 1.3 技术栈

- **前端**: 原生 JavaScript（无框架）
- **存储**: Chrome Storage API + IndexedDB
- **权限**: Chrome Downloads API, Proxy API, declarativeNetRequest
- **Manifest Version**: 3

---

## 2. 项目结构

```
d:\pixivdl\
├── extension/                    # 扩展源代码
│   ├── manifest.json             # 扩展清单配置
│   ├── popup.html                # 主界面 HTML
│   ├── popup.css                 # 样式表
│   ├── popup.js                  # 主逻辑脚本
│   ├── rules.json                # 网络请求规则
│   ├── icons/                    # 图标资源
│   │   ├── icon-16.png
│   │   ├── icon-32.png
│   │   ├── icon-48.png
│   │   └── icon-128.png
│   └── README.md                  # 扩展说明
├── dist/                         # 构建输出目录
│   └── PixivDL-Browser-latest/   # 最新稳定版
├── docs/                         # 文档
│   ├── agent-collaboration.md
│   └── agent-update-log.md
├── AGENTS.md                     # Agent 协作规则
└── README.md                     # 项目总览
```

---

## 3. Manifest 配置详解

### 3.1 manifest.json 结构

```json
{
  "manifest_version": 3,
  "name": "PixivDL Browser",
  "version": "0.5.5",
  "description": "Fetch Pixiv artwork pages by PID and download selected images...",
  "icons": { /* 图标路径配置 */ },
  "action": { /* 扩展图标点击行为 */ },
  "options_ui": { /* 设置页面 */ },
  "permissions": [ /* 权限列表 */ ],
  "host_permissions": [ /* 主机权限 */ ],
  "declarative_net_request": { /* 网络请求规则 */ }
}
```

### 3.2 权限说明

| 权限 | 用途 |
|------|------|
| `downloads` | 使用浏览器下载功能 |
| `storage` | 存储收藏夹和设置 |
| `unlimitedStorage` | 无限制存储配额 |
| `declarativeNetRequest` | 修改网络请求头 |
| `proxy` | 配置本地代理 |

### 3.3 主机权限

- `https://www.pixiv.net/*` - 访问 Pixiv 网站
- `https://i.pximg.net/*` - 访问 Pixiv 图片资源

---

## 4. 主要模块详解

### 4.1 常量定义

```javascript
const PIXIV_ORIGIN = "https://www.pixiv.net";
const FAVORITES_KEY = "pixivdlFavorites";
const SETTINGS_KEY = "pixivdlSettings";
const DB_NAME = "pixivdlBrowser";
const DB_VERSION = 2;
const WORK_STORE = "works";
const IMAGE_STORE = "images";
const HANDLE_STORE = "handles";
const DOWNLOAD_FOLDER_HANDLE_KEY = "downloadFolder";
```

| 常量 | 用途 |
|------|------|
| `PIXIV_ORIGIN` | Pixiv 网站基础 URL |
| `FAVORITES_KEY` | Chrome Storage 中收藏夹的键名 |
| `SETTINGS_KEY` | Chrome Storage 中设置的键名 |
| `DB_NAME` | IndexedDB 数据库名称 |
| `WORK_STORE` | 作品缓存的 Object Store |
| `IMAGE_STORE` | 图片缓存的 Object Store |
| `HANDLE_STORE` | 文件夹句柄的 Object Store |

### 4.2 默认设置

```javascript
const DEFAULT_SETTINGS = {
  downloadTarget: "browser",    // 下载目标: browser | folder
  downloadDirectory: "PixivDL",  // 浏览器下载目录
  downloadFolderName: "",        // 文件夹名称
  downloadAskEachTime: false,    // 是否每次询问保存位置
  proxyEnabled: false,           // 是否启用代理
  proxyScheme: "http",          // 代理协议: http | https | socks4 | socks5
  proxyHost: "127.0.0.1",       // 代理主机
  proxyPort: "7890"             // 代理端口
};
```

### 4.3 状态管理

```javascript
const state = {
  work: null,                   // 当前作品对象
  selectedPages: new Set(),      // 选中的页面集合
  mode: "zip",                   // 下载模式: zip | files
  favorites: [],                 // 收藏列表
  previewUrls: new Map(),         // 预览 URL 缓存
  busy: false,                   // 是否正在处理
  openedAsTab: false,            // 是否在新标签页打开
  view: "workspace",            // 当前视图: workspace | favorites
  workspaceInput: "",            // 工作台输入值
  favoriteQuery: "",            // 收藏搜索查询
  selectedFavoritePid: "",       // 选中的收藏 PID
  pendingDownloadPid: "",        // 待下载的收藏 PID
  failedPid: "",                // 失败的 PID
  failureMessage: "",           // 失败消息
  settings: { ...DEFAULT_SETTINGS },
  localDownloadFolderHandle: null // 本地下载文件夹句柄
};
```

---

## 5. 核心函数详解

### 5.1 初始化模块

#### `init()`

**位置**: popup.js:114-136

**功能**: 应用初始化入口，加载收藏夹、设置，注册事件监听，渲染界面。

**流程**:
1. 从 URL 参数获取请求的视图和 PID
2. 并行加载收藏夹和设置
3. 根据视图参数设置状态
4. 绑定事件监听
5. 渲染界面
6. 应用代理设置（如果启用）
7. 如果是工作台视图且有 PID，自动加载作品

#### `bindEvents()`

**位置**: popup.js:138-216

**功能**: 注册所有 UI 元素的事件监听器。

**监听的事件**:
- PID 表单提交
- 搜索输入
- 标签切换
- 设置表单提交
- 下载操作
- 收藏管理
- 代理设置

### 5.2 作品加载模块

#### `loadWork(pid)`

**位置**: popup.js:218-262

**功能**: 加载指定 PID 的作品信息。

**流程**:
1. 设置繁忙状态
2. 显示进度提示
3. 清空失败状态和预览 URL
4. 尝试从 Pixiv API 获取元数据和页面
5. 如果获取失败，尝试从本地缓存加载
6. 更新状态并渲染界面
7. 加载预览图

#### `fetchMetadata(pid)`

**位置**: popup.js:264-273

**功能**: 从 Pixiv API 获取作品元数据。

**API 端点**: `https://www.pixiv.net/ajax/illust/{pid}`

**返回字段**:
- `title` - 作品标题
- `userId` - 作者 ID
- `userName` - 作者名称
- `uploadDate` - 上传日期
- `pageCount` - 图片数量

#### `fetchPages(pid)`

**位置**: popup.js:275-284

**功能**: 获取作品的页面列表。

**API 端点**: `https://www.pixiv.net/ajax/illust/{pid}/pages`

**返回字段**:
- `urls.original` - 原图 URL
- `urls.regular` - 常规尺寸 URL
- `urls.thumb_mini` - 缩略图 URL

#### `fetchJson(url)`

**位置**: popup.js:286-303

**功能**: 通用 JSON 获取函数，处理认证和错误。

**参数处理**:
- 401/403: 提示登录状态不可用
- 404: 提示作品不存在
- 其他错误: 显示 HTTP 状态码

#### `normalizeWork(pid, metadata, pages)`

**位置**: popup.js:305-330

**功能**: 规范化作品数据格式。

**输出结构**:
```javascript
{
  pid: string,
  title: string,
  authorId: string,
  authorName: string,
  uploadedAt: string,
  pageCount: number,
  pages: [{
    page: number,        // 页索引 (0-based)
    originalUrl: string, // 原图 URL
    regularUrl: string,  // 常规 URL
    thumbUrl: string,    // 缩略图 URL
    extension: string   // 文件扩展名
  }]
}
```

### 5.3 预览加载模块

#### `loadPreviews(work)`

**位置**: popup.js:332-357

**功能**: 异步加载作品的所有预览图。

**优化**:
- 首张图片加载为封面
- 其他图片并行加载
- 失败时标记 `.failed` 类

#### `fetchImageBlobCached(url, pid, key)`

**位置**: popup.js:370-378

**功能**: 获取图片并使用缓存。

**缓存策略**:
1. 先检查 IndexedDB 缓存
2. 缓存命中则直接返回
3. 未命中则从网络获取并存入缓存

### 5.4 下载模块

#### `downloadSelected()`

**位置**: popup.js:415-446

**功能**: 下载选中的图片。

**模式判断**:
- `files`: 调用 `downloadFiles()`
- `zip`: 调用 `downloadZip()`

#### `downloadFiles(work, pages)`

**位置**: popup.js:524-542

**功能**: 以文件模式下载图片。

**特点**:
- 每个文件单独下载
- 支持多图同时下载
- 文件名格式: `{pid}_{sanitize(title)}/{pid}_p{page}.{ext}`

#### `downloadZip(work, pages)`

**位置**: popup.js:544-567

**功能**: 打包下载为 ZIP 文件。

**流程**:
1. 创建 ZipBuilder 实例
2. 逐个获取图片并加入 ZIP
3. 生成 ZIP blob
4. 调用浏览器下载

#### `browserDownloadBlob(blob, filename)`

**位置**: popup.js:569-600

**功能**: 使用浏览器下载功能下载 blob。

**参数处理**:
- 安全化文件名（移除路径遍历字符）
- 处理保存目录设置
- 管理 Object URL 生命周期

### 5.5 收藏管理模块

#### `toggleFavorite()`

**位置**: popup.js:687-712

**功能**: 切换作品收藏状态。

**防重复机制**:
- 检查 PID 是否已存在
- 已存在则移除，未存在则添加

#### `exportFavorites()`

**位置**: popup.js:1037-1055

**功能**: 导出收藏到 JSON 文件。

**导出格式**:
```json
{
  "schema": "pixivdl-favorites",
  "version": 1,
  "exportedAt": "ISO日期",
  "favorites": [...]
}
```

#### `importFavoritesFromFile(event)`

**位置**: popup.js:1057-1089

**功能**: 从 JSON 文件导入收藏。

**去重处理**:
- 使用 Map 记录已存在的 PID
- 跳过重复项
- 报告新增和跳过数量

### 5.6 设置管理模块

#### `saveSettingsFromForm(event)`

**位置**: popup.js:758-782

**功能**: 从表单保存设置到 Chrome Storage。

**保存后操作**:
1. 规范化设置值
2. 保存到 storage
3. 应用代理设置
4. 同步表单显示

#### `normalizeSettings(value)`

**位置**: popup.js:784-806

**功能**: 规范化设置值，确保类型安全。

**处理**:
- `downloadTarget`: 只能是 "browser" 或 "folder"
- `proxyScheme`: 必须是有效协议
- `proxyPort`: 必须在 1-65535 范围内
- 空值使用默认值

#### `applyProxySettings()`

**位置**: popup.js:993-1035

**功能**: 应用代理设置到浏览器。

**API 调用**:
```javascript
chrome.proxy.settings.set({
  scope: "regular",
  value: {
    mode: "fixed_servers",
    rules: {
      singleProxy: {
        scheme: string,
        host: string,
        port: number
      },
      bypassList: ["<local>"]
    }
  }
});
```

### 5.7 IndexedDB 缓存模块

#### `openDatabase()`

**位置**: popup.js:1634-1652

**功能**: 打开 IndexedDB 数据库。

**Object Stores**:
| Store | KeyPath | 用途 |
|-------|---------|------|
| `works` | `pid` | 作品元数据缓存 |
| `images` | `key` | 图片 blob 缓存 |
| `handles` | `key` | 文件夹句柄存储 |

#### `idbTransaction(storeName, mode, callback)`

**位置**: popup.js:1654-1680

**功能**: 执行 IndexedDB 事务的通用封装。

**特性**:
- Promise 化异步操作
- 自动关闭数据库连接
- 错误处理和传播

#### 缓存操作函数

| 函数 | 位置 | 用途 |
|------|------|------|
| `putCachedWork(work)` | 1682-1685 | 缓存作品元数据 |
| `getCachedWork(pid)` | 1687-1689 | 获取缓存作品 |
| `putCachedImage(key, blob)` | 1691-1695 | 缓存图片 blob |
| `getCachedImage(key)` | 1697-1700 | 获取缓存图片 |

### 5.8 UI 渲染模块

#### `render()`

**位置**: popup.js:1266-1271

**功能**: 主渲染入口，调用所有子渲染函数。

#### `renderWork()`

**位置**: popup.js:1273-1297

**功能**: 渲染作品信息面板。

**显示内容**:
- 封面图片
- 标题、作者
- PID、页数、上传时间
- 收藏状态

#### `renderImages()`

**位置**: popup.js:1308-1341

**功能**: 渲染图片选择网格。

**特性**:
- 动态创建缩略图瓦片
- 显示选择状态（蓝色边框 + 勾选图标）
- 点击切换选择
- 失败图片标记

#### `renderDownload()`

**位置**: popup.js:1343-1365

**功能**: 渲染下载控制面板。

**状态**:
- ZIP/文件模式切换
- 已选数量显示
- 下载按钮启用/禁用

#### `renderFavorites()`

**位置**: popup.js:1367-1484

**功能**: 渲染收藏列表。

**功能**:
- 搜索过滤
- 收藏卡片展示
- 选中状态管理
- 详情面板渲染

---

## 6. ZipBuilder 类

### 6.1 类定义

**位置**: popup.js:1726-1758

**功能**: 纯前端 ZIP 文件构建器，无需外部库。

### 6.2 方法

#### `addFile(name, bytes)`

**功能**: 添加文件到 ZIP。

**参数**:
- `name`: 文件名（含路径）
- `bytes`: Uint8Array 文件内容

#### `toBlob()`

**功能**: 生成 ZIP Blob。

**输出**: `application/zip` 类型的 Blob

### 6.3 内部函数

| 函数 | 位置 | 用途 |
|------|------|------|
| `localHeader(file)` | 1760-1775 | 生成本地文件头 |
| `centralHeader(file, offset)` | 1777-1794 | 生成中央目录头 |
| `endOfCentralDirectory()` | 1796-1805 | 生成结束标记 |
| `crc32(bytes)` | 1807-1813 | CRC32 校验计算 |

---

## 7. 工具函数

### 7.1 文件名处理

#### `sanitizeFilename(value)`

**位置**: popup.js:1626-1628

**功能**: 清理文件名，移除非法字符。

**规则**:
- 移除 `< > : " / \ | ? *` 和控制字符
- 替换多个空格为单个
- 截断至 90 字符

#### `extensionFromUrl(url)`

**位置**: popup.js:1620-1624

**功能**: 从 URL 提取文件扩展名。

#### `buildBrowserDownloadFilename(filename)`

**位置**: popup.js:608-618

**功能**: 构建浏览器下载的完整路径。

**安全处理**:
- 分割路径部分
- 对每个部分进行安全化
- 拼接保存目录和文件名

### 7.2 目录处理

#### `normalizeDownloadDirectory(value)`

**位置**: popup.js:969-986

**功能**: 规范化下载目录路径。

**处理**:
- 移除驱动器字母
- 移除 "Downloads" 前缀
- 安全化路径段
- 使用 `/` 分隔符

### 7.3 日期格式化

#### `formatDate(value)`

**位置**: popup.js:1579-1594

**功能**: 格式化日期为中文本地格式。

**输出**: `YYYY/MM/DD HH:mm` 格式

---

## 8. API 调用

### 8.1 Pixiv AJAX API

| 端点 | 用途 | 响应格式 |
|------|------|----------|
| `/ajax/illust/{pid}` | 获取作品元数据 | `{ error, body }` |
| `/ajax/illust/{pid}/pages` | 获取页面列表 | `{ error, body: [] }` |

### 8.2 请求头设置

**rules.json** 中定义了对 `i.pximg.net` 的请求头修改：

```json
{
  "header": "Referer",
  "operation": "set",
  "value": "https://www.pixiv.net/"
}
```

**用途**: 绕过 Pixiv 图片防盗链

---

## 9. 权限范围

### 9.1 Chrome API 使用

| API | 权限 | 用途 |
|-----|------|------|
| `chrome.downloads.download` | `downloads` | 触发浏览器下载 |
| `chrome.storage.local.get/set` | `storage` | 存储用户数据 |
| `chrome.proxy.settings` | `proxy` | 配置代理 |
| `chrome.tabs.create` | - | 打开新标签页 |

### 9.2 文件系统访问

使用 File System Access API：
- `window.showDirectoryPicker()` - 选择本地文件夹
- `handle.queryPermission()` - 查询权限
- `handle.requestPermission()` - 请求权限

---

## 10. 存储结构

### 10.1 Chrome Storage

| Key | 类型 | 说明 |
|-----|------|------|
| `pixivdlFavorites` | `Favorite[]` | 收藏列表 |
| `pixivdlSettings` | `Settings` | 用户设置 |

### 10.2 IndexedDB

**数据库**: `pixivdlBrowser` (v2)

| Object Store | KeyPath | 存储内容 |
|--------------|---------|----------|
| `works` | `pid` | 作品元数据 |
| `images` | `key` | 图片 Blob |
| `handles` | `key` | 文件夹句柄 |

---

## 11. 运行与构建

### 11.1 开发模式

1. 打开 Chrome/Edge
2. 访问 `chrome://extensions/`
3. 开启「开发者模式」
4. 点击「加载已解压的扩展程序」
5. 选择 `extension/` 目录

### 11.2 构建发布版本

```powershell
# 同步到 dist 目录
Copy-Item -Recurse extension dist\PixivDL-Browser-latest

# 打包为 ZIP
Compress-Archive -Path dist\PixivDL-Browser-latest -DestinationPath dist\PixivDL-Browser-0.5.5.zip -Force
```

### 11.3 语法检查

```powershell
node --check extension\popup.js
```

---

## 12. 数据流向图

```
用户输入 PID
    ↓
loadWork(pid)
    ↓
┌─────────────────────────────────────┐
│  fetchMetadata(pid)                 │ → Pixiv API
│  fetchPages(pid)                    │ → Pixiv API
└─────────────────────────────────────┘
    ↓
normalizeWork() → 规范化数据
    ↓
putCachedWork() → IndexedDB 缓存
    ↓
loadPreviews() → 显示缩略图
    ↓
用户选择页面 + 选择下载模式
    ↓
downloadSelected()
    ├─ downloadFiles() → chrome.downloads.download
    └─ downloadZip() → ZipBuilder → chrome.downloads.download
```

---

## 13. 错误处理

### 13.1 网络错误

| 错误码 | 含义 | 处理方式 |
|--------|------|----------|
| 401/403 | 登录态失效 | 提示用户登录 |
| 404 | 作品不存在 | 显示失败状态 + 跳转链接 |
| 其他 | 请求失败 | 显示错误信息 |

### 13.2 缓存降级

当 Pixiv API 请求失败时：
1. 尝试从 IndexedDB 加载缓存作品
2. 显示通知说明使用了缓存
3. 如果无缓存则抛出错误

### 13.3 下载错误

单个图片下载失败不会中断整体下载：
1. 记录失败信息
2. 更新进度条为错误状态
3. 抛出错误终止后续下载

---

## 14. 安全考虑

### 14.1 路径安全

- 禁止 `.` 和 `..` 路径段
- 移除所有非法路径字符
- 截断过长文件名

### 14.2 用户数据

- 收藏数据存储在 Chrome Storage
- 图片缓存使用 IndexedDB
- 不存储 Pixiv 登录凭证

### 14.3 代理设置

- 仅修改浏览器扩展范围的代理
- 不影响系统全局代理
- 禁用时清除扩展代理配置
