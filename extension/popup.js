"use strict";

const PIXIV_ORIGIN = "https://www.pixiv.net";
const FAVORITES_KEY = "pixivdlFavorites";
const DB_NAME = "pixivdlBrowser";
const DB_VERSION = 1;
const WORK_STORE = "works";
const IMAGE_STORE = "images";

const state = {
  work: null,
  selectedPages: new Set(),
  mode: "zip",
  favorites: [],
  previewUrls: new Map(),
  busy: false,
  openedAsTab: false,
  view: "workspace",
  failedPid: "",
  failureMessage: ""
};

const elements = {
  pidForm: document.querySelector("#pidForm"),
  pidInput: document.querySelector("#pidInput"),
  fetchButton: document.querySelector("#fetchButton"),
  notice: document.querySelector("#notice"),
  workspaceTab: document.querySelector("#workspaceTab"),
  favoritesTab: document.querySelector("#favoritesTab"),
  workspaceView: document.querySelector("#workspaceView"),
  favoritesView: document.querySelector("#favoritesView"),
  emptyState: document.querySelector("#emptyState"),
  emptyTitle: document.querySelector("#emptyTitle"),
  emptyBody: document.querySelector("#emptyBody"),
  emptyPixivButton: document.querySelector("#emptyPixivButton"),
  workSummary: document.querySelector("#workSummary"),
  coverImage: document.querySelector("#coverImage"),
  workTitle: document.querySelector("#workTitle"),
  workAuthor: document.querySelector("#workAuthor"),
  workPid: document.querySelector("#workPid"),
  workPages: document.querySelector("#workPages"),
  favoriteButton: document.querySelector("#favoriteButton"),
  openPixivButton: document.querySelector("#openPixivButton"),
  openFavoritesTabButton: document.querySelector("#openFavoritesTabButton"),
  favoritesTitle: document.querySelector("#favoritesTitle"),
  selectAllButton: document.querySelector("#selectAllButton"),
  imageGrid: document.querySelector("#imageGrid"),
  zipMode: document.querySelector("#zipMode"),
  fileMode: document.querySelector("#fileMode"),
  downloadButton: document.querySelector("#downloadButton"),
  progress: document.querySelector("#progress"),
  progressText: document.querySelector("#progressText"),
  progressBar: document.querySelector("#progressBar"),
  favoritesGrid: document.querySelector("#favoritesGrid")
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

async function init() {
  await loadFavorites();
  state.openedAsTab = new URLSearchParams(location.search).get("view") === "favorites";
  state.view = state.openedAsTab ? "favorites" : "workspace";
  document.body.classList.toggle("tab-view", state.openedAsTab);
  document.body.classList.toggle("favorites-gallery-mode", state.openedAsTab);
  bindEvents();
  render();
  setTab(state.view);
}

function bindEvents() {
  elements.pidForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const pid = elements.pidInput.value.trim();
    if (!/^\d+$/.test(pid)) {
      showNotice("PID 只能包含数字");
      return;
    }
    await loadWork(pid);
  });

  elements.workspaceTab.addEventListener("click", () => setTab("workspace"));
  elements.favoritesTab.addEventListener("click", () => setTab("favorites"));
  elements.openFavoritesTabButton.addEventListener("click", openFavoritesInTab);
  elements.selectAllButton.addEventListener("click", toggleSelectAll);
  elements.favoriteButton.addEventListener("click", toggleFavorite);
  elements.openPixivButton.addEventListener("click", openCurrentWorkOnPixiv);
  elements.emptyPixivButton.addEventListener("click", openFailedWorkOnPixiv);
  elements.zipMode.addEventListener("click", () => setMode("zip"));
  elements.fileMode.addEventListener("click", () => setMode("files"));
  elements.downloadButton.addEventListener("click", downloadSelected);
}

async function loadWork(pid) {
  setBusy(true);
  showNotice("正在读取 Pixiv 作品...");
  clearFailure();
  clearPreviewUrls();
  try {
    let work;
    try {
      const [metadata, pages] = await Promise.all([fetchMetadata(pid), fetchPages(pid)]);
      work = normalizeWork(pid, metadata, pages);
      await putCachedWork(work);
    } catch (error) {
      const cached = await getCachedWork(pid);
      if (!cached) {
        throw error;
      }
      work = cached;
      showNotice(`Pixiv 请求失败，已载入本地缓存：${error instanceof Error ? error.message : "未知错误"}`);
    }
    state.work = work;
    state.selectedPages = new Set(work.pages.map((page) => page.page));
    setTab("workspace");
    if (!elements.notice.textContent.startsWith("Pixiv 请求失败")) {
      showNotice(`已获取 ${work.pageCount} 张图片`);
    }
    clearFailure();
    render();
    await loadPreviews(work);
  } catch (error) {
    state.work = null;
    state.selectedPages.clear();
    const message = error instanceof Error ? error.message : "获取作品失败";
    showNotice(message);
    setFailure(pid, message);
    render();
  } finally {
    setBusy(false);
  }
}

async function fetchMetadata(pid) {
  const data = await fetchJson(`${PIXIV_ORIGIN}/ajax/illust/${encodeURIComponent(pid)}`);
  if (data.error) {
    throw new Error(typeof data.message === "string" ? data.message : "Pixiv 返回作品错误");
  }
  if (!data.body) {
    throw new Error("Pixiv 作品响应缺少 body");
  }
  return data.body;
}

async function fetchPages(pid) {
  const data = await fetchJson(`${PIXIV_ORIGIN}/ajax/illust/${encodeURIComponent(pid)}/pages`);
  if (data.error) {
    throw new Error(typeof data.message === "string" ? data.message : "Pixiv 返回图片列表错误");
  }
  if (!Array.isArray(data.body)) {
    throw new Error("Pixiv 图片列表响应格式异常");
  }
  return data.body;
}

async function fetchJson(url) {
  const response = await fetch(url, {
    credentials: "include",
    headers: {
      Accept: "application/json"
    }
  });
  if (response.status === 401 || response.status === 403) {
    throw new Error("Pixiv 登录态不可用，请先在浏览器中登录 pixiv.net");
  }
  if (response.status === 404) {
    throw new Error("作品不存在、已删除或无权访问");
  }
  if (!response.ok) {
    throw new Error(`Pixiv 请求失败：HTTP ${response.status}`);
  }
  return response.json();
}

function normalizeWork(pid, metadata, pages) {
  const normalizedPages = pages.map((item, index) => {
    const urls = item.urls ?? {};
    const originalUrl = urls.original;
    if (!originalUrl) {
      throw new Error(`第 ${index} 页缺少原图地址`);
    }
    return {
      page: index,
      originalUrl,
      regularUrl: urls.regular ?? urls.small ?? urls.thumb_mini ?? originalUrl,
      thumbUrl: urls.thumb_mini ?? urls.small ?? urls.regular ?? originalUrl,
      extension: extensionFromUrl(originalUrl)
    };
  });

  return {
    pid,
    title: String(metadata.title ?? `pixiv_${pid}`),
    authorId: String(metadata.userId ?? ""),
    authorName: String(metadata.userName ?? "未知作者"),
    pageCount: normalizedPages.length,
    pages: normalizedPages
  };
}

async function loadPreviews(work) {
  const firstPage = work.pages[0];
  if (firstPage) {
    const coverUrl = await getPreviewObjectUrl(work, firstPage);
    if (state.work?.pid === work.pid) {
      elements.coverImage.src = coverUrl;
    }
  }

  await Promise.all(
    work.pages.map(async (page) => {
      try {
        const url = await getPreviewObjectUrl(work, page);
        const image = elements.imageGrid.querySelector(`[data-page="${page.page}"] img`);
        if (image && state.work?.pid === work.pid) {
          image.src = url;
        }
      } catch {
        const tile = elements.imageGrid.querySelector(`[data-page="${page.page}"]`);
        if (tile) {
          tile.classList.add("failed");
        }
      }
    })
  );
}

async function getPreviewObjectUrl(work, page) {
  const key = `${work.pid}:${page.page}:preview`;
  if (state.previewUrls.has(key)) {
    return state.previewUrls.get(key);
  }
  const blob = await fetchImageBlobCached(page.regularUrl, work.pid, cacheImageKey(work.pid, page.page, "regular"));
  const url = URL.createObjectURL(blob);
  state.previewUrls.set(key, url);
  return url;
}

async function fetchImageBlobCached(url, pid, key) {
  const cached = await getCachedImage(key);
  if (cached) {
    return cached;
  }
  const blob = await fetchImageBlob(url, pid);
  await putCachedImage(key, blob).catch(() => undefined);
  return blob;
}

async function fetchImageBlob(url, pid) {
  const response = await fetch(url, {
    credentials: "omit",
    referrer: `${PIXIV_ORIGIN}/artworks/${pid}`
  });
  if (response.status === 401 || response.status === 403) {
    throw new Error("图片请求被 Pixiv 拒绝，可能需要刷新登录态或关闭防盗链拦截");
  }
  if (!response.ok) {
    throw new Error(`图片请求失败：HTTP ${response.status}`);
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.startsWith("image/")) {
    throw new Error("Pixiv 返回的不是图片内容");
  }
  return response.blob();
}

function toggleSelectAll() {
  if (!state.work) {
    return;
  }
  if (state.selectedPages.size === state.work.pages.length) {
    state.selectedPages.clear();
  } else {
    state.selectedPages = new Set(state.work.pages.map((page) => page.page));
  }
  render();
}

function setMode(mode) {
  state.mode = mode;
  render();
}

async function downloadSelected() {
  if (!state.work || state.selectedPages.size === 0 || state.busy) {
    return;
  }
  setBusy(true);
  try {
    const pages = state.work.pages.filter((page) => state.selectedPages.has(page.page));
    if (state.mode === "files") {
      await downloadFiles(state.work, pages);
    } else {
      await downloadZip(state.work, pages);
    }
    showNotice("浏览器下载已发起");
  } catch (error) {
    showNotice(error instanceof Error ? error.message : "下载失败");
  } finally {
    setProgress(0, "");
    setBusy(false);
  }
}

async function downloadSinglePage(work, page) {
  setProgress(0.2, `正在下载 p${page.page}`);
  const blob = await fetchImageBlobCached(
    page.originalUrl,
    work.pid,
    cacheImageKey(work.pid, page.page, "original")
  );
  const filename = `${work.pid}_p${page.page}.${page.extension}`;
  await browserDownloadBlob(blob, filename);
  setProgress(1, "完成");
}

async function downloadFiles(work, pages) {
  for (let index = 0; index < pages.length; index += 1) {
    const page = pages[index];
    setProgress(index / pages.length, `正在下载 p${page.page}`);
    const blob = await fetchImageBlobCached(
      page.originalUrl,
      work.pid,
      cacheImageKey(work.pid, page.page, "original")
    );
    const filename = `${work.pid}_${sanitizeFilename(work.title)}/${work.pid}_p${page.page}.${page.extension}`;
    await browserDownloadBlob(blob, filename);
  }
  setProgress(1, "完成");
}

async function downloadZip(work, pages) {
  const zip = new ZipBuilder();
  for (let index = 0; index < pages.length; index += 1) {
    const page = pages[index];
    setProgress(index / pages.length, `正在获取 p${page.page}`);
    const blob = await fetchImageBlobCached(
      page.originalUrl,
      work.pid,
      cacheImageKey(work.pid, page.page, "original")
    );
    const bytes = new Uint8Array(await blob.arrayBuffer());
    zip.addFile(`${work.pid}_p${page.page}.${page.extension}`, bytes);
  }
  setProgress(0.92, "正在生成 ZIP");
  const zipBlob = zip.toBlob();
  const filename = `${work.pid}_${sanitizeFilename(work.title)}.zip`;
  await browserDownloadBlob(zipBlob, filename);
  setProgress(1, "完成");
}

function browserDownloadBlob(blob, filename) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    chrome.downloads.download(
      {
        url,
        filename: `PixivDL/${filename}`,
        saveAs: false,
        conflictAction: "uniquify"
      },
      (downloadId) => {
        const error = chrome.runtime.lastError;
        setTimeout(() => URL.revokeObjectURL(url), 30000);
        if (error) {
          reject(new Error(error.message));
          return;
        }
        if (!downloadId) {
          reject(new Error("浏览器拒绝了下载请求"));
          return;
        }
        resolve(downloadId);
      }
    );
  });
}

async function toggleFavorite() {
  if (!state.work) {
    return;
  }
  const existingIndex = state.favorites.findIndex((favorite) => favorite.pid === state.work.pid);
  if (existingIndex >= 0) {
    state.favorites.splice(existingIndex, 1);
    await saveFavorites();
    showNotice("已取消收藏");
    render();
    return;
  }
  const coverDataUrl = await makeFavoriteCover(state.work).catch(() => "");
  state.favorites.unshift({
    pid: state.work.pid,
    title: state.work.title,
    authorName: state.work.authorName,
    authorId: state.work.authorId,
    pageCount: state.work.pageCount,
    coverDataUrl,
    addedAt: new Date().toISOString()
  });
  await saveFavorites();
  showNotice("已加入收藏");
  render();
}

async function makeFavoriteCover(work) {
  const first = work.pages[0];
  if (!first) {
    return "";
  }
  const blob = await fetchImageBlobCached(first.thumbUrl, work.pid, cacheImageKey(work.pid, first.page, "thumb"));
  return blobToDataUrl(blob);
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("封面缓存失败"));
    reader.readAsDataURL(blob);
  });
}

async function loadFavorites() {
  const data = await storageGet(FAVORITES_KEY);
  state.favorites = Array.isArray(data[FAVORITES_KEY]) ? data[FAVORITES_KEY] : [];
}

async function saveFavorites() {
  await storageSet({ [FAVORITES_KEY]: state.favorites });
}

function storageGet(key) {
  return new Promise((resolve) => {
    chrome.storage.local.get(key, resolve);
  });
}

function storageSet(value) {
  return new Promise((resolve, reject) => {
    chrome.storage.local.set(value, () => {
      const error = chrome.runtime.lastError;
      if (error) {
        reject(new Error(error.message));
        return;
      }
      resolve();
    });
  });
}

function setTab(tab) {
  const showWorkspace = tab === "workspace";
  state.view = showWorkspace ? "workspace" : "favorites";
  elements.workspaceView.hidden = !showWorkspace;
  elements.favoritesView.hidden = showWorkspace;
  elements.workspaceView.classList.toggle("view-active", showWorkspace);
  elements.workspaceView.classList.toggle("view-hidden", !showWorkspace);
  elements.favoritesView.classList.toggle("view-active", !showWorkspace);
  elements.favoritesView.classList.toggle("view-hidden", showWorkspace);
  elements.workspaceTab.classList.toggle("active", showWorkspace);
  elements.favoritesTab.classList.toggle("active", !showWorkspace);
  document.body.classList.toggle("favorites-mode", !showWorkspace);
  if (!showWorkspace) {
    renderFavorites();
  }
}

function openFavoritesInTab() {
  const url = chrome.runtime.getURL("popup.html?view=favorites");
  chrome.tabs.create({ url });
}

function pixivArtworkUrl(pid) {
  return `${PIXIV_ORIGIN}/artworks/${encodeURIComponent(pid)}`;
}

function openCurrentWorkOnPixiv() {
  if (!state.work) {
    return;
  }
  chrome.tabs.create({ url: pixivArtworkUrl(state.work.pid) });
}

function openFailedWorkOnPixiv() {
  const pid = state.failedPid || elements.pidInput.value.trim();
  if (/^\d+$/.test(pid)) {
    chrome.tabs.create({ url: pixivArtworkUrl(pid) });
  }
}

function setFailure(pid, message) {
  state.failedPid = pid;
  state.failureMessage = message;
}

function clearFailure() {
  state.failedPid = "";
  state.failureMessage = "";
}

function setBusy(value) {
  state.busy = value;
  elements.fetchButton.disabled = value;
  elements.downloadButton.disabled = value || !state.work || state.selectedPages.size === 0;
}

function showNotice(message) {
  elements.notice.textContent = message;
  elements.notice.hidden = !message;
}

function setProgress(value, text) {
  elements.progress.hidden = !text;
  elements.progressText.textContent = text;
  elements.progressBar.style.width = `${Math.max(0, Math.min(1, value)) * 100}%`;
}

function render() {
  renderWork();
  renderImages();
  renderDownload();
  renderFavorites();
}

function renderWork() {
  const work = state.work;
  elements.emptyState.hidden = Boolean(work);
  elements.workSummary.hidden = !work;
  elements.selectAllButton.disabled = !work;
  if (!work) {
    renderEmptyState();
    elements.coverImage.removeAttribute("src");
    return;
  }

  elements.workTitle.textContent = work.title;
  elements.workAuthor.textContent = work.authorName;
  elements.workPid.textContent = `PID ${work.pid}`;
  elements.workPages.textContent = `${work.pageCount} 张`;
  const isFavorite = state.favorites.some((favorite) => favorite.pid === work.pid);
  elements.favoriteButton.textContent = isFavorite ? "已收藏" : "收藏";
  elements.favoriteButton.classList.toggle("saved", isFavorite);
}

function renderEmptyState() {
  const hasFailure = Boolean(state.failedPid);
  elements.emptyTitle.textContent = hasFailure ? "获取失败" : "输入 PID 获取作品";
  elements.emptyBody.textContent = hasFailure
    ? "当前无法通过接口读取图片，可以前往 Pixiv 原作品页查看。"
    : "获取成功后可预览、选择并下载图片。";
  elements.emptyPixivButton.hidden = !hasFailure;
}

function renderImages() {
  elements.imageGrid.textContent = "";
  if (!state.work) {
    return;
  }
  for (const page of state.work.pages) {
    const tile = document.createElement("button");
    tile.type = "button";
    tile.dataset.page = String(page.page);
    tile.className = `image-tile ${state.selectedPages.has(page.page) ? "selected" : ""}`;
    tile.addEventListener("click", () => {
      if (state.selectedPages.has(page.page)) {
        state.selectedPages.delete(page.page);
      } else {
        state.selectedPages.add(page.page);
      }
      render();
    });

    const image = document.createElement("img");
    image.alt = `p${page.page}`;
    const previewUrl = state.previewUrls.get(`${state.work.pid}:${page.page}:preview`);
    if (previewUrl) {
      image.src = previewUrl;
    }
    const badge = document.createElement("span");
    badge.textContent = `p${page.page}`;

    tile.append(image, badge);
    elements.imageGrid.append(tile);
  }
}

function renderDownload() {
  elements.zipMode.classList.toggle("active", state.mode === "zip");
  elements.fileMode.classList.toggle("active", state.mode === "files");
  const selectedCount = state.selectedPages.size;
  elements.downloadButton.textContent = `下载 ${selectedCount} 张`;
  elements.downloadButton.disabled = state.busy || !state.work || selectedCount === 0;
  if (!state.work) {
    elements.selectAllButton.textContent = "全选";
  } else {
    elements.selectAllButton.textContent =
      selectedCount === state.work.pages.length ? "取消全选" : "全选";
  }
}

function renderFavorites() {
  elements.favoritesGrid.textContent = "";
  elements.openFavoritesTabButton.hidden = state.openedAsTab;
  elements.favoritesTitle.textContent = state.openedAsTab ? "收藏图片仓库" : "本地收藏夹";
  if (state.favorites.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    const title = document.createElement("strong");
    title.textContent = "暂无收藏";
    const body = document.createElement("span");
    body.textContent = "收藏作品后会显示封面和图片数量。";
    empty.append(title, body);
    elements.favoritesGrid.append(empty);
    return;
  }

  for (const favorite of state.favorites) {
    const card = document.createElement("article");
    card.className = "favorite-card";

    const media = document.createElement("button");
    media.type = "button";
    media.className = "favorite-media";
    media.addEventListener("click", () => {
      if (state.openedAsTab) {
        chrome.tabs.create({ url: pixivArtworkUrl(favorite.pid) });
        return;
      }
      elements.pidInput.value = favorite.pid;
      loadWork(favorite.pid);
    });

    const image = document.createElement("img");
    image.alt = favorite.title;
    if (favorite.coverDataUrl) {
      image.src = favorite.coverDataUrl;
    }

    const count = document.createElement("span");
    count.className = "favorite-count";
    count.textContent = `${favorite.pageCount} 张`;
    media.append(image, count);

    const body = document.createElement("div");
    body.className = "favorite-body";
    const title = document.createElement("h2");
    title.textContent = favorite.title;
    const meta = document.createElement("p");
    meta.textContent = `${favorite.authorName} · PID ${favorite.pid}`;
    body.append(title, meta);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "icon-button";
    remove.textContent = "X";
    remove.addEventListener("click", async () => {
      state.favorites = state.favorites.filter((item) => item.pid !== favorite.pid);
      await saveFavorites();
      render();
    });

    card.append(media, body, remove);
    elements.favoritesGrid.append(card);
  }
}

function clearPreviewUrls() {
  for (const url of state.previewUrls.values()) {
    URL.revokeObjectURL(url);
  }
  state.previewUrls.clear();
  elements.coverImage.removeAttribute("src");
}

function extensionFromUrl(url) {
  const path = new URL(url).pathname;
  const ext = path.split(".").pop()?.toLowerCase();
  return ext && /^[a-z0-9]+$/.test(ext) ? ext : "jpg";
}

function sanitizeFilename(value) {
  return value.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_").replace(/\s+/g, " ").trim().slice(0, 90) || "untitled";
}

function cacheImageKey(pid, page, kind) {
  return `${pid}:${page}:${kind}`;
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(WORK_STORE)) {
        db.createObjectStore(WORK_STORE, { keyPath: "pid" });
      }
      if (!db.objectStoreNames.contains(IMAGE_STORE)) {
        db.createObjectStore(IMAGE_STORE, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("打开本地缓存失败"));
  });
}

async function idbTransaction(storeName, mode, callback) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    let request;
    try {
      request = callback(store);
    } catch (error) {
      db.close();
      reject(error);
      return;
    }
    transaction.oncomplete = () => {
      db.close();
      resolve(request?.result);
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error ?? new Error("本地缓存操作失败"));
    };
    transaction.onabort = () => {
      db.close();
      reject(transaction.error ?? new Error("本地缓存操作取消"));
    };
  });
}

async function putCachedWork(work) {
  const snapshot = JSON.parse(JSON.stringify({ ...work, cachedAt: new Date().toISOString() }));
  await idbTransaction(WORK_STORE, "readwrite", (store) => store.put(snapshot));
}

async function getCachedWork(pid) {
  return idbTransaction(WORK_STORE, "readonly", (store) => store.get(pid));
}

async function putCachedImage(key, blob) {
  await idbTransaction(IMAGE_STORE, "readwrite", (store) =>
    store.put({ key, blob, cachedAt: new Date().toISOString() })
  );
}

async function getCachedImage(key) {
  const item = await idbTransaction(IMAGE_STORE, "readonly", (store) => store.get(key));
  return item?.blob instanceof Blob ? item.blob : null;
}

async function clearCacheStores() {
  await idbTransaction(WORK_STORE, "readwrite", (store) => store.clear());
  await idbTransaction(IMAGE_STORE, "readwrite", (store) => store.clear());
}

class ZipBuilder {
  constructor() {
    this.files = [];
  }

  addFile(name, bytes) {
    const filename = new TextEncoder().encode(name);
    const crc = crc32(bytes);
    this.files.push({ name, filename, bytes, crc });
  }

  toBlob() {
    const chunks = [];
    const central = [];
    let offset = 0;

    for (const file of this.files) {
      const local = localHeader(file);
      chunks.push(local, file.bytes);
      central.push(centralHeader(file, offset));
      offset += local.length + file.bytes.length;
    }

    const centralOffset = offset;
    let centralSize = 0;
    for (const header of central) {
      chunks.push(header);
      centralSize += header.length;
    }
    chunks.push(endOfCentralDirectory(this.files.length, centralSize, centralOffset));
    return new Blob(chunks, { type: "application/zip" });
  }
}

function localHeader(file) {
  const header = new Uint8Array(30 + file.filename.length);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x04034b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 0x0800, true);
  view.setUint16(8, 0, true);
  view.setUint16(10, 0, true);
  view.setUint16(12, 0, true);
  view.setUint32(14, file.crc, true);
  view.setUint32(18, file.bytes.length, true);
  view.setUint32(22, file.bytes.length, true);
  view.setUint16(26, file.filename.length, true);
  header.set(file.filename, 30);
  return header;
}

function centralHeader(file, offset) {
  const header = new Uint8Array(46 + file.filename.length);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x02014b50, true);
  view.setUint16(4, 20, true);
  view.setUint16(6, 20, true);
  view.setUint16(8, 0x0800, true);
  view.setUint16(10, 0, true);
  view.setUint16(12, 0, true);
  view.setUint16(14, 0, true);
  view.setUint32(16, file.crc, true);
  view.setUint32(20, file.bytes.length, true);
  view.setUint32(24, file.bytes.length, true);
  view.setUint16(28, file.filename.length, true);
  view.setUint32(42, offset, true);
  header.set(file.filename, 46);
  return header;
}

function endOfCentralDirectory(count, size, offset) {
  const header = new Uint8Array(22);
  const view = new DataView(header.buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(8, count, true);
  view.setUint16(10, count, true);
  view.setUint32(12, size, true);
  view.setUint32(16, offset, true);
  return header;
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let value = i;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[i] = value >>> 0;
  }
  return table;
})();
