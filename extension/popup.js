"use strict";

const PIXIV_ORIGIN = "https://www.pixiv.net";
const FAVORITES_KEY = "pixivdlFavorites";
const SETTINGS_KEY = "pixivdlSettings";
const DB_NAME = "pixivdlBrowser";
const DB_VERSION = 1;
const WORK_STORE = "works";
const IMAGE_STORE = "images";

const DEFAULT_SETTINGS = {
  downloadDirectory: "PixivDL",
  proxyEnabled: false,
  proxyScheme: "http",
  proxyHost: "127.0.0.1",
  proxyPort: "7890"
};

const state = {
  work: null,
  selectedPages: new Set(),
  mode: "zip",
  favorites: [],
  previewUrls: new Map(),
  busy: false,
  openedAsTab: false,
  view: "workspace",
  workspaceInput: "",
  favoriteQuery: "",
  selectedFavoritePid: "",
  pendingDownloadPid: "",
  failedPid: "",
  failureMessage: "",
  settings: { ...DEFAULT_SETTINGS }
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
  workUploadTime: document.querySelector("#workUploadTime"),
  workFavoriteState: document.querySelector("#workFavoriteState"),
  favoriteButton: document.querySelector("#favoriteButton"),
  openPixivButton: document.querySelector("#openPixivButton"),
  focusSettingsButton: document.querySelector("#focusSettingsButton"),
  openPixivHomeButton: document.querySelector("#openPixivHomeButton"),
  openWorkspaceTabButton: document.querySelector("#openWorkspaceTabButton"),
  openFavoritesTabButton: document.querySelector("#openFavoritesTabButton"),
  importFavoritesButton: document.querySelector("#importFavoritesButton"),
  exportFavoritesButton: document.querySelector("#exportFavoritesButton"),
  importFavoritesInput: document.querySelector("#importFavoritesInput"),
  favoritesTitle: document.querySelector("#favoritesTitle"),
  favoritesStatus: document.querySelector("#favoritesStatus"),
  gallerySearchForm: document.querySelector("#gallerySearchForm"),
  gallerySearchInput: document.querySelector("#gallerySearchInput"),
  gallerySearchButton: document.querySelector("#gallerySearchButton"),
  favoriteDetail: document.querySelector("#favoriteDetail"),
  selectAllButton: document.querySelector("#selectAllButton"),
  selectedCountLabel: document.querySelector("#selectedCountLabel"),
  imageGrid: document.querySelector("#imageGrid"),
  zipMode: document.querySelector("#zipMode"),
  fileMode: document.querySelector("#fileMode"),
  settingsForm: document.querySelector("#settingsForm"),
  downloadDirectoryInput: document.querySelector("#downloadDirectoryInput"),
  browseDownloadDirectoryButton: document.querySelector("#browseDownloadDirectoryButton"),
  downloadDirectoryHint: document.querySelector("#downloadDirectoryHint"),
  proxyEnabledInput: document.querySelector("#proxyEnabledInput"),
  proxySchemeInput: document.querySelector("#proxySchemeInput"),
  proxyHostInput: document.querySelector("#proxyHostInput"),
  proxyPortInput: document.querySelector("#proxyPortInput"),
  saveSettingsButton: document.querySelector("#saveSettingsButton"),
  downloadButton: document.querySelector("#downloadButton"),
  downloadMeta: document.querySelector("#downloadMeta"),
  progress: document.querySelector("#progress"),
  progressText: document.querySelector("#progressText"),
  progressBar: document.querySelector("#progressBar"),
  favoritesGrid: document.querySelector("#favoritesGrid"),
  downloadChoiceModal: document.querySelector("#downloadChoiceModal"),
  closeDownloadChoiceButton: document.querySelector("#closeDownloadChoiceButton"),
  downloadChoiceMeta: document.querySelector("#downloadChoiceMeta"),
  favoriteZipDownloadButton: document.querySelector("#favoriteZipDownloadButton"),
  favoriteFilesDownloadButton: document.querySelector("#favoriteFilesDownloadButton")
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

async function init() {
  const params = new URLSearchParams(location.search);
  const requestedView = params.get("view");
  const requestedPid = params.get("pid") ?? "";
  await Promise.all([loadFavorites(), loadSettings()]);
  state.openedAsTab = requestedView === "favorites" || requestedView === "workspace";
  state.view = requestedView === "favorites" ? "favorites" : "workspace";
  state.workspaceInput = /^\d+$/.test(requestedPid) ? requestedPid : "";
  document.body.classList.toggle("tab-view", state.openedAsTab);
  document.body.classList.toggle("favorites-gallery-mode", state.openedAsTab && state.view === "favorites");
  document.body.classList.toggle("workspace-tab-mode", state.openedAsTab && state.view === "workspace");
  bindEvents();
  render();
  setTab(state.view);
  syncSettingsForm();
  if (state.settings.proxyEnabled) {
    await applyProxySettings().catch((error) => showNotice(error.message));
  }
  if (state.view === "workspace" && /^\d+$/.test(state.workspaceInput)) {
    elements.pidInput.value = state.workspaceInput;
    await loadWork(state.workspaceInput);
  }
}

function bindEvents() {
  elements.pidForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const value = elements.pidInput.value.trim();
    if (state.view === "favorites" && !state.openedAsTab) {
      state.favoriteQuery = value;
      renderFavorites();
      return;
    }
    const pid = value;
    if (!/^\d+$/.test(pid)) {
      showNotice("PID 只能包含数字");
      return;
    }
    state.workspaceInput = pid;
    await loadWork(pid);
  });

  elements.pidInput.addEventListener("input", () => {
    const value = elements.pidInput.value.trim();
    if (state.view === "favorites" && !state.openedAsTab) {
      state.favoriteQuery = value;
      renderFavorites();
    } else {
      state.workspaceInput = value;
    }
  });

  elements.gallerySearchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    state.favoriteQuery = elements.gallerySearchInput.value.trim();
    renderFavorites();
  });

  elements.gallerySearchInput.addEventListener("input", () => {
    state.favoriteQuery = elements.gallerySearchInput.value.trim();
    renderFavorites();
  });

  elements.workspaceTab.addEventListener("click", () => setTab("workspace"));
  elements.favoritesTab.addEventListener("click", () => setTab("favorites"));
  elements.focusSettingsButton.addEventListener("click", () => {
    setTab("workspace");
    elements.downloadDirectoryInput.focus();
  });
  elements.openPixivHomeButton.addEventListener("click", () => {
    chrome.tabs.create({ url: PIXIV_ORIGIN });
  });
  elements.openWorkspaceTabButton.addEventListener("click", openWorkspaceInTab);
  elements.openFavoritesTabButton.addEventListener("click", openFavoritesInTab);
  elements.importFavoritesButton.addEventListener("click", () => elements.importFavoritesInput.click());
  elements.exportFavoritesButton.addEventListener("click", exportFavorites);
  elements.importFavoritesInput.addEventListener("change", importFavoritesFromFile);
  elements.selectAllButton.addEventListener("click", toggleSelectAll);
  elements.favoriteButton.addEventListener("click", toggleFavorite);
  elements.openPixivButton.addEventListener("click", openCurrentWorkOnPixiv);
  elements.emptyPixivButton.addEventListener("click", openFailedWorkOnPixiv);
  elements.zipMode.addEventListener("click", () => setMode("zip"));
  elements.fileMode.addEventListener("click", () => setMode("files"));
  elements.downloadDirectoryInput.addEventListener("input", updateDownloadDirectoryDisplay);
  elements.browseDownloadDirectoryButton.addEventListener("click", openDownloadDirectory);
  elements.settingsForm.addEventListener("submit", saveSettingsFromForm);
  elements.downloadButton.addEventListener("click", downloadSelected);
  elements.closeDownloadChoiceButton.addEventListener("click", closeDownloadChoice);
  elements.downloadChoiceModal.addEventListener("click", (event) => {
    if (event.target === elements.downloadChoiceModal) {
      closeDownloadChoice();
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !elements.downloadChoiceModal.hidden) {
      closeDownloadChoice();
    }
  });
  elements.favoriteZipDownloadButton.addEventListener("click", () => downloadPendingFavorite("zip"));
  elements.favoriteFilesDownloadButton.addEventListener("click", () => downloadPendingFavorite("files"));
}

async function loadWork(pid) {
  setBusy(true);
  state.workspaceInput = pid;
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
    uploadedAt: String(metadata.uploadDate ?? metadata.createDate ?? metadata.create_date ?? ""),
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
      if (pages.length === 1) {
        await downloadSinglePage(state.work, pages[0]);
      } else {
        await downloadFiles(state.work, pages);
      }
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

async function loadWorkForDownload(favorite) {
  try {
    const [metadata, pages] = await Promise.all([fetchMetadata(favorite.pid), fetchPages(favorite.pid)]);
    const work = normalizeWork(favorite.pid, metadata, pages);
    await putCachedWork(work);
    return work;
  } catch (error) {
    const cached = await getCachedWork(favorite.pid);
    if (cached) {
      return cached;
    }
    throw error;
  }
}

function openDownloadChoice(favorite) {
  state.pendingDownloadPid = favorite.pid;
  elements.downloadChoiceMeta.textContent = `${favorite.title} · ${favorite.pageCount} 张`;
  elements.downloadChoiceModal.hidden = false;
  elements.favoriteZipDownloadButton.focus();
}

function closeDownloadChoice() {
  state.pendingDownloadPid = "";
  elements.downloadChoiceModal.hidden = true;
}

async function downloadPendingFavorite(mode) {
  const favorite = state.favorites.find((item) => item.pid === state.pendingDownloadPid);
  if (!favorite || state.busy) {
    return;
  }
  closeDownloadChoice();
  setBusy(true);
  try {
    showFavoritesStatus(`正在准备下载 ${favorite.title}...`);
    const work = await loadWorkForDownload(favorite);
    if (mode === "files") {
      await downloadFiles(work, work.pages);
    } else {
      await downloadZip(work, work.pages);
    }
    showFavoritesStatus("浏览器下载已发起");
  } catch (error) {
    showFavoritesStatus(error instanceof Error ? error.message : "下载失败");
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
    const directory = getDownloadDirectory();
    const downloadFilename = directory ? `${directory}/${filename}` : filename;
    chrome.downloads.download(
      {
        url,
        filename: downloadFilename,
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
  if (!state.selectedFavoritePid && state.favorites[0]) {
    state.selectedFavoritePid = state.favorites[0].pid;
  }
}

async function saveFavorites() {
  await storageSet({ [FAVORITES_KEY]: state.favorites });
}

async function loadSettings() {
  const data = await storageGet(SETTINGS_KEY);
  state.settings = normalizeSettings(data[SETTINGS_KEY]);
}

async function saveSettingsFromForm(event) {
  event.preventDefault();
  try {
    state.settings = normalizeSettings({
      downloadDirectory: elements.downloadDirectoryInput.value,
      proxyEnabled: elements.proxyEnabledInput.checked,
      proxyScheme: elements.proxySchemeInput.value,
      proxyHost: elements.proxyHostInput.value,
      proxyPort: elements.proxyPortInput.value
    });
    await storageSet({ [SETTINGS_KEY]: state.settings });
    await applyProxySettings();
    syncSettingsForm();
    showNotice(`设置已保存：${formatDownloadDirectoryPath(state.settings.downloadDirectory)}`);
  } catch (error) {
    showNotice(error instanceof Error ? error.message : "设置保存失败");
  }
}

function normalizeSettings(value) {
  const source = value && typeof value === "object" ? value : {};
  const proxyScheme = ["http", "https", "socks4", "socks5"].includes(source.proxyScheme)
    ? source.proxyScheme
    : DEFAULT_SETTINGS.proxyScheme;
  const proxyHost = String(source.proxyHost ?? DEFAULT_SETTINGS.proxyHost).trim() || DEFAULT_SETTINGS.proxyHost;
  const proxyPort = String(source.proxyPort ?? DEFAULT_SETTINGS.proxyPort).trim();
  const portNumber = Number.parseInt(proxyPort, 10);
  return {
    downloadDirectory: normalizeDownloadDirectory(source.downloadDirectory ?? DEFAULT_SETTINGS.downloadDirectory),
    proxyEnabled: Boolean(source.proxyEnabled),
    proxyScheme,
    proxyHost,
    proxyPort: Number.isInteger(portNumber) && portNumber >= 1 && portNumber <= 65535
      ? String(portNumber)
      : DEFAULT_SETTINGS.proxyPort
  };
}

function syncSettingsForm() {
  elements.downloadDirectoryInput.value = formatDownloadDirectoryPath(state.settings.downloadDirectory);
  updateDownloadDirectoryDisplay();
  elements.proxyEnabledInput.checked = state.settings.proxyEnabled;
  elements.proxySchemeInput.value = state.settings.proxyScheme;
  elements.proxyHostInput.value = state.settings.proxyHost;
  elements.proxyPortInput.value = state.settings.proxyPort;
}

function getDownloadDirectory() {
  return normalizeDownloadDirectory(state.settings.downloadDirectory);
}

function updateDownloadDirectoryDisplay() {
  const directory = normalizeDownloadDirectory(elements.downloadDirectoryInput.value);
  elements.downloadDirectoryHint.textContent = `实际保存：${formatDownloadDirectoryPath(directory)}`;
  elements.downloadDirectoryInput.title = "保存目录是浏览器下载目录下的相对路径";
}

function formatDownloadDirectoryPath(value) {
  const directory = normalizeDownloadDirectory(value).replace(/\//g, "\\");
  return `浏览器下载目录\\${directory}`;
}

function openDownloadDirectory() {
  if (chrome.downloads?.showDefaultFolder) {
    chrome.downloads.showDefaultFolder();
    showNotice("已打开浏览器默认下载目录；保存子目录会在下载时自动创建。");
    return;
  }
  chrome.tabs.create({ url: "chrome://downloads/" });
}

function normalizeDownloadDirectory(value) {
  const raw = String(value ?? "")
    .trim()
    .replace(/^浏览器下载目录[\\/]+/, "");
  if (!raw) {
    return DEFAULT_SETTINGS.downloadDirectory;
  }
  const withoutDrive = raw.replace(/^[a-zA-Z]:/, "");
  const parts = withoutDrive
    .split(/[\\/]+/)
    .map((part) => sanitizePathPart(part))
    .filter(Boolean);
  return parts.join("/") || DEFAULT_SETTINGS.downloadDirectory;
}

function sanitizePathPart(value) {
  const part = sanitizeFilename(value);
  return part === "." || part === ".." ? "" : part;
}

function applyProxySettings() {
  return new Promise((resolve, reject) => {
    if (!chrome.proxy?.settings) {
      reject(new Error("当前浏览器不支持扩展代理设置"));
      return;
    }
    if (!state.settings.proxyEnabled) {
      chrome.proxy.settings.clear({ scope: "regular" }, () => {
        const error = chrome.runtime.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }
        resolve();
      });
      return;
    }
    chrome.proxy.settings.set(
      {
        scope: "regular",
        value: {
          mode: "fixed_servers",
          rules: {
            singleProxy: {
              scheme: state.settings.proxyScheme,
              host: state.settings.proxyHost,
              port: Number.parseInt(state.settings.proxyPort, 10)
            },
            bypassList: ["<local>"]
          }
        }
      },
      () => {
        const error = chrome.runtime.lastError;
        if (error) {
          reject(new Error(error.message));
          return;
        }
        resolve();
      }
    );
  });
}

async function exportFavorites() {
  const payload = {
    schema: "pixivdl-favorites",
    version: 1,
    exportedAt: new Date().toISOString(),
    favorites: state.favorites.map((favorite) => ({
      pid: favorite.pid,
      title: favorite.title,
      authorName: favorite.authorName,
      authorId: favorite.authorId,
      pageCount: favorite.pageCount,
      coverDataUrl: favorite.coverDataUrl,
      addedAt: favorite.addedAt
    }))
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  await browserDownloadBlob(blob, `pixivdl-favorites-${dateStamp()}.json`);
  showFavoritesStatus(`已导出 ${state.favorites.length} 个收藏`);
}

async function importFavoritesFromFile(event) {
  const file = event.target.files?.[0];
  elements.importFavoritesInput.value = "";
  if (!file) {
    return;
  }
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    const imported = normalizeImportedFavorites(parsed);
    if (imported.length === 0) {
      showFavoritesStatus("没有可导入的收藏");
      return;
    }
    const existing = new Map(state.favorites.map((favorite) => [favorite.pid, favorite]));
    let added = 0;
    for (const favorite of imported) {
      if (!existing.has(favorite.pid)) {
        state.favorites.push(favorite);
        existing.set(favorite.pid, favorite);
        added += 1;
      }
    }
    if (!state.selectedFavoritePid && state.favorites[0]) {
      state.selectedFavoritePid = state.favorites[0].pid;
    }
    await saveFavorites();
    render();
    showFavoritesStatus(`导入完成：新增 ${added} 个，跳过 ${imported.length - added} 个重复收藏`);
  } catch (error) {
    showFavoritesStatus(error instanceof Error ? error.message : "导入失败");
  }
}

function normalizeImportedFavorites(payload) {
  const items = Array.isArray(payload) ? payload : payload?.favorites;
  if (!Array.isArray(items)) {
    throw new Error("导入文件格式不正确");
  }
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const pid = String(item?.pid ?? "").trim();
    if (!/^\d+$/.test(pid) || seen.has(pid)) {
      continue;
    }
    seen.add(pid);
    result.push({
      pid,
      title: String(item?.title ?? `pixiv_${pid}`).slice(0, 200),
      authorName: String(item?.authorName ?? "未知作者").slice(0, 120),
      authorId: String(item?.authorId ?? "").slice(0, 80),
      pageCount: Math.max(1, Number.parseInt(item?.pageCount, 10) || 1),
      coverDataUrl: validCoverDataUrl(item?.coverDataUrl) ? item.coverDataUrl : "",
      addedAt: validDateString(item?.addedAt) ? item.addedAt : new Date().toISOString()
    });
  }
  return result;
}

function validCoverDataUrl(value) {
  return typeof value === "string" && (value === "" || /^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(value));
}

function validDateString(value) {
  return typeof value === "string" && !Number.isNaN(new Date(value).getTime());
}

function dateStamp() {
  const date = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}`;
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
  rememberCurrentInput();
  const showWorkspace = tab === "workspace";
  state.view = showWorkspace ? "workspace" : "favorites";
  document.body.classList.toggle("workspace-tab-mode", state.openedAsTab && showWorkspace);
  document.body.classList.toggle("favorites-gallery-mode", state.openedAsTab && !showWorkspace);
  elements.workspaceView.hidden = !showWorkspace;
  elements.favoritesView.hidden = showWorkspace;
  elements.workspaceView.classList.toggle("view-active", showWorkspace);
  elements.workspaceView.classList.toggle("view-hidden", !showWorkspace);
  elements.favoritesView.classList.toggle("view-active", !showWorkspace);
  elements.favoritesView.classList.toggle("view-hidden", showWorkspace);
  elements.workspaceTab.classList.toggle("active", showWorkspace);
  elements.favoritesTab.classList.toggle("active", !showWorkspace);
  document.body.classList.toggle("favorites-mode", !showWorkspace);
  configureSearchMode();
  if (!showWorkspace) {
    renderFavorites();
  }
}

function rememberCurrentInput() {
  const value = elements.pidInput.value.trim();
  if (state.view === "favorites" && !state.openedAsTab) {
    state.favoriteQuery = value;
  } else if (state.view === "workspace") {
    state.workspaceInput = value;
  }
}

function configureSearchMode() {
  if (state.openedAsTab && state.view === "favorites") {
    return;
  }
  if (state.view === "favorites") {
    elements.pidInput.value = state.favoriteQuery;
    elements.pidInput.placeholder = "搜索收藏标题 / 作者 / PID";
    elements.fetchButton.textContent = "搜索";
  } else {
    elements.pidInput.value = state.workspaceInput;
    elements.pidInput.placeholder = "输入作品 PID";
    elements.fetchButton.textContent = "获取";
  }
}

function openWorkspaceInTab() {
  rememberCurrentInput();
  const pid = state.work?.pid ?? state.workspaceInput.trim();
  const url = new URL(chrome.runtime.getURL("popup.html"));
  url.searchParams.set("view", "workspace");
  if (/^\d+$/.test(pid)) {
    url.searchParams.set("pid", pid);
  }
  chrome.tabs.create({ url: url.toString() });
}

function openFavoritesInTab() {
  const url = chrome.runtime.getURL("popup.html?view=favorites");
  chrome.tabs.create({ url });
}

function openFavoriteInWorkspace(favorite) {
  if (state.openedAsTab) {
    state.openedAsTab = false;
    document.body.classList.remove("tab-view", "favorites-gallery-mode", "workspace-tab-mode", "favorites-mode");
  }
  elements.pidInput.value = favorite.pid;
  loadWork(favorite.pid);
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
  if (work) {
    state.workspaceInput = work.pid;
  }
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
  elements.workPid.textContent = work.pid;
  elements.workPages.textContent = `${work.pageCount} 张`;
  elements.workUploadTime.textContent = formatDate(work.uploadedAt);
  const isFavorite = state.favorites.some((favorite) => favorite.pid === work.pid);
  elements.favoriteButton.textContent = isFavorite ? "已收藏" : "收藏";
  elements.favoriteButton.classList.toggle("saved", isFavorite);
  elements.workFavoriteState.textContent = isFavorite ? "已收藏" : "未收藏";
  elements.workFavoriteState.classList.toggle("saved-state", isFavorite);
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
    tile.setAttribute("aria-pressed", state.selectedPages.has(page.page) ? "true" : "false");
    tile.title = `切换 p${page.page + 1}`;
    tile.addEventListener("click", () => {
      if (state.selectedPages.has(page.page)) {
        state.selectedPages.delete(page.page);
      } else {
        state.selectedPages.add(page.page);
      }
      render();
    });

    const image = document.createElement("img");
    image.alt = `p${page.page + 1}`;
    const previewUrl = state.previewUrls.get(`${state.work.pid}:${page.page}:preview`);
    if (previewUrl) {
      image.src = previewUrl;
    }
    const badge = document.createElement("span");
    badge.textContent = `${page.page + 1}`;

    tile.append(image, badge);
    elements.imageGrid.append(tile);
  }
}

function renderDownload() {
  elements.zipMode.classList.toggle("active", state.mode === "zip");
  elements.fileMode.classList.toggle("active", state.mode === "files");
  const selectedCount = state.selectedPages.size;
  const totalCount = state.work?.pages.length ?? 0;
  elements.selectedCountLabel.textContent = `已选 ${selectedCount} / ${totalCount}`;
  elements.downloadButton.textContent = `下载 ${selectedCount} 张`;
  elements.downloadButton.disabled = state.busy || !state.work || selectedCount === 0;
  if (!state.work) {
    elements.downloadMeta.textContent = "选择页面后下载；ZIP 适合多图归档。";
  } else if (selectedCount === 0) {
    elements.downloadMeta.textContent = "先在中间选择至少 1 张图片。";
  } else {
    const modeText = state.mode === "zip" ? "ZIP 打包" : "文件模式";
    elements.downloadMeta.textContent = `准备以${modeText}下载 ${selectedCount} 张图片。`;
  }
  if (!state.work) {
    elements.selectAllButton.textContent = "全选";
  } else {
    elements.selectAllButton.textContent =
      selectedCount === state.work.pages.length ? "取消全选" : "全选";
  }
}

function renderFavorites() {
  elements.favoritesGrid.textContent = "";
  elements.openWorkspaceTabButton.hidden = state.openedAsTab && state.view === "workspace";
  elements.openFavoritesTabButton.hidden = state.openedAsTab;
  elements.importFavoritesButton.hidden = !state.openedAsTab;
  elements.exportFavoritesButton.hidden = !state.openedAsTab;
  elements.gallerySearchForm.hidden = !state.openedAsTab;
  elements.favoriteDetail.hidden = !state.openedAsTab;
  if (state.openedAsTab && elements.gallerySearchInput.value !== state.favoriteQuery) {
    elements.gallerySearchInput.value = state.favoriteQuery;
  }
  elements.favoritesTitle.textContent = state.openedAsTab ? "收藏图片仓库" : "本地收藏夹";
  const query = state.favoriteQuery.trim().toLowerCase();
  const favorites = query
    ? state.favorites.filter((favorite) => favoriteMatchesQuery(favorite, query))
    : state.favorites;
  if (state.openedAsTab && favorites.length > 0 && !favorites.some((favorite) => favorite.pid === state.selectedFavoritePid)) {
    state.selectedFavoritePid = favorites[0].pid;
  }
  if (state.favorites.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    const title = document.createElement("strong");
    title.textContent = "暂无收藏";
    const body = document.createElement("span");
    body.textContent = "收藏作品后会显示封面和图片数量。";
    empty.append(title, body);
    elements.favoritesGrid.append(empty);
    renderFavoriteDetail(null);
    return;
  }
  if (favorites.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    const title = document.createElement("strong");
    title.textContent = "没有匹配收藏";
    const body = document.createElement("span");
    body.textContent = "换个标题、作者或 PID 试试。";
    empty.append(title, body);
    elements.favoritesGrid.append(empty);
    renderFavoriteDetail(null);
    return;
  }

  for (const favorite of favorites) {
    const card = document.createElement("article");
    card.className = `favorite-card ${favorite.pid === state.selectedFavoritePid ? "selected" : ""}`;

    const media = document.createElement("button");
    media.type = "button";
    media.className = "favorite-media";
    media.addEventListener("click", () => {
      if (state.openedAsTab) {
        state.selectedFavoritePid = favorite.pid;
        renderFavorites();
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
    const saved = document.createElement("span");
    saved.className = "favorite-saved";
    saved.textContent = "★";
    media.append(image, count, saved);

    const body = document.createElement("div");
    body.className = "favorite-body";
    const title = document.createElement("h2");
    title.textContent = favorite.title;
    const author = document.createElement("p");
    author.textContent = favorite.authorName || "未知作者";
    const meta = document.createElement("p");
    meta.className = "favorite-pid";
    meta.textContent = `PID: ${favorite.pid}`;
    body.append(title, author, meta);

    const actions = document.createElement("div");
    actions.className = "card-actions";

    const download = document.createElement("button");
    download.type = "button";
    download.className = "icon-button";
    download.textContent = "↓";
    download.title = "下载";
    download.setAttribute("aria-label", `下载 ${favorite.title}`);
    download.addEventListener("click", () => openDownloadChoice(favorite));

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "icon-button";
    remove.textContent = "X";
    remove.title = "删除";
    remove.setAttribute("aria-label", `删除 ${favorite.title}`);
    remove.addEventListener("click", async () => {
      state.favorites = state.favorites.filter((item) => item.pid !== favorite.pid);
      if (state.selectedFavoritePid === favorite.pid) {
        state.selectedFavoritePid = state.favorites[0]?.pid ?? "";
      }
      await saveFavorites();
      render();
    });
    actions.append(download, remove);

    card.append(media, body, actions);
    elements.favoritesGrid.append(card);
  }
  renderFavoriteDetail(favorites.find((favorite) => favorite.pid === state.selectedFavoritePid) ?? favorites[0]);
}

function renderFavoriteDetail(favorite) {
  elements.favoriteDetail.textContent = "";
  if (!state.openedAsTab) {
    return;
  }
  if (!favorite) {
    const empty = document.createElement("div");
    empty.className = "detail-empty";
    const title = document.createElement("strong");
    title.textContent = "选择作品";
    const body = document.createElement("span");
    body.textContent = "点击左侧收藏封面后，这里会显示作品详情。";
    empty.append(title, body);
    elements.favoriteDetail.append(empty);
    return;
  }

  const eyebrow = document.createElement("p");
  eyebrow.className = "eyebrow";
  eyebrow.textContent = "Details";
  const heading = document.createElement("h2");
  heading.className = "detail-heading";
  heading.textContent = "详情";

  const image = document.createElement("img");
  image.className = "detail-cover";
  image.alt = favorite.title;
  if (favorite.coverDataUrl) {
    image.src = favorite.coverDataUrl;
  }

  const title = document.createElement("h2");
  title.textContent = favorite.title;
  const author = document.createElement("p");
  author.className = "detail-author";
  author.textContent = favorite.authorName || "未知作者";

  const meta = document.createElement("dl");
  meta.className = "detail-meta";
  appendDetailMeta(meta, "PID", favorite.pid);
  appendDetailMeta(meta, "图片数量", `${favorite.pageCount} 张`);
  appendDetailMeta(meta, "作者 ID", favorite.authorId || "-");
  appendDetailMeta(meta, "收藏时间", formatDate(favorite.addedAt));

  const note = document.createElement("label");
  note.className = "detail-note";
  const noteLabel = document.createElement("span");
  noteLabel.textContent = "备注";
  const noteInput = document.createElement("textarea");
  noteInput.placeholder = "点击输入备注（可选）";
  noteInput.rows = 3;
  note.append(noteLabel, noteInput);

  const actions = document.createElement("div");
  actions.className = "detail-actions";
  const open = document.createElement("button");
  open.type = "button";
  open.className = "primary-button";
  open.textContent = "打开工作台";
  open.addEventListener("click", () => openFavoriteInWorkspace(favorite));
  const openPixiv = document.createElement("button");
  openPixiv.type = "button";
  openPixiv.className = "secondary-button";
  openPixiv.textContent = "打开 Pixiv";
  openPixiv.addEventListener("click", () => chrome.tabs.create({ url: pixivArtworkUrl(favorite.pid) }));
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "secondary-button";
  remove.textContent = "移除收藏";
  remove.addEventListener("click", async () => {
    state.favorites = state.favorites.filter((item) => item.pid !== favorite.pid);
    state.selectedFavoritePid = state.favorites[0]?.pid ?? "";
    await saveFavorites();
    render();
  });
  const download = document.createElement("button");
  download.type = "button";
  download.className = "secondary-button";
  download.textContent = "下载";
  download.addEventListener("click", () => openDownloadChoice(favorite));
  actions.append(open, openPixiv, download, remove);

  elements.favoriteDetail.append(eyebrow, heading, image, title, author, meta, note, actions);
}

function appendDetailMeta(container, label, value) {
  const term = document.createElement("dt");
  term.textContent = label;
  const detail = document.createElement("dd");
  detail.textContent = value;
  container.append(term, detail);
}

function formatDate(value) {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function showFavoritesStatus(message) {
  elements.favoritesStatus.textContent = message;
  elements.favoritesStatus.hidden = !message || !state.openedAsTab;
}

function favoriteMatchesQuery(favorite, query) {
  return [
    favorite.pid,
    favorite.title,
    favorite.authorName,
    favorite.authorId
  ]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(query));
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
