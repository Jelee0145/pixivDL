"use strict";

const PIXIV_ORIGIN = "https://www.pixiv.net";
const FAVORITES_KEY = "pixivdlFavorites";
const SETTINGS_KEY = "pixivdlSettings";
const DB_NAME = "pixivdlBrowser";
const DB_VERSION = 2;
const WORK_STORE = "works";
const IMAGE_STORE = "images";
const HANDLE_STORE = "handles";
const DOWNLOAD_FOLDER_HANDLE_KEY = "downloadFolder";

const DEFAULT_SETTINGS = {
  downloadTarget: "browser",
  downloadDirectory: "PixivDL",
  downloadFolderName: "",
  downloadAskEachTime: false,
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
  settings: { ...DEFAULT_SETTINGS },
  localDownloadFolderHandle: null,
  batch: null,
  lastFailedDownload: null,
  noteSaveTimers: new Map()
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
  batchDownloadFavoritesButton: document.querySelector("#batchDownloadFavoritesButton"),
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
  clearDownloadDirectoryButton: document.querySelector("#clearDownloadDirectoryButton"),
  askDownloadLocationInput: document.querySelector("#askDownloadLocationInput"),
  downloadDirectoryHint: document.querySelector("#downloadDirectoryHint"),
  proxyEnabledInput: document.querySelector("#proxyEnabledInput"),
  proxySchemeInput: document.querySelector("#proxySchemeInput"),
  proxyHostInput: document.querySelector("#proxyHostInput"),
  proxyPortInput: document.querySelector("#proxyPortInput"),
  saveSettingsButton: document.querySelector("#saveSettingsButton"),
  downloadButton: document.querySelector("#downloadButton"),
  retryDownloadButton: document.querySelector("#retryDownloadButton"),
  downloadMeta: document.querySelector("#downloadMeta"),
  progress: document.querySelector("#progress"),
  progressText: document.querySelector("#progressText"),
  progressBar: document.querySelector("#progressBar"),
  favoritesGrid: document.querySelector("#favoritesGrid"),
  downloadChoiceModal: document.querySelector("#downloadChoiceModal"),
  closeDownloadChoiceButton: document.querySelector("#closeDownloadChoiceButton"),
  downloadChoiceMeta: document.querySelector("#downloadChoiceMeta"),
  favoriteZipDownloadButton: document.querySelector("#favoriteZipDownloadButton"),
  favoriteFilesDownloadButton: document.querySelector("#favoriteFilesDownloadButton"),
  cacheSizeLabel: document.querySelector("#cacheSizeLabel"),
  clearCacheButton: document.querySelector("#clearCacheButton"),
  batchSummary: document.querySelector("#batchSummary"),
  batchSuccessCount: document.querySelector("#batchSuccessCount"),
  batchFailedCount: document.querySelector("#batchFailedCount"),
  batchProgressLabel: document.querySelector("#batchProgressLabel"),
  exitBatchButton: document.querySelector("#exitBatchButton"),
  batchQueueView: document.querySelector("#batchQueueView"),
  batchQueueGrid: document.querySelector("#batchQueueGrid")
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
  updateCacheSizeDisplay().catch(() => undefined);
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
  elements.batchDownloadFavoritesButton.addEventListener("click", () => startBatchMode(state.favorites));
  elements.importFavoritesInput.addEventListener("change", importFavoritesFromFile);
  elements.selectAllButton.addEventListener("click", toggleSelectAll);
  elements.favoriteButton.addEventListener("click", toggleFavorite);
  elements.openPixivButton.addEventListener("click", openCurrentWorkOnPixiv);
  elements.emptyPixivButton.addEventListener("click", openFailedWorkOnPixiv);
  elements.zipMode.addEventListener("click", () => setMode("zip"));
  elements.fileMode.addEventListener("click", () => setMode("files"));
  elements.downloadDirectoryInput.addEventListener("input", switchToBrowserDownloadDirectory);
  elements.browseDownloadDirectoryButton.addEventListener("click", chooseDownloadDirectory);
  elements.clearDownloadDirectoryButton.addEventListener("click", clearSelectedDownloadDirectory);
  elements.askDownloadLocationInput.addEventListener("change", toggleAskDownloadLocation);
  elements.settingsForm.addEventListener("submit", saveSettingsFromForm);
  elements.downloadButton.addEventListener("click", downloadSelected);
  elements.retryDownloadButton.addEventListener("click", retryFailedDownload);
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
  elements.clearCacheButton.addEventListener("click", clearCacheAction);
  elements.exitBatchButton.addEventListener("click", exitBatchMode);
}

async function loadWork(pid) {
  setBusy(true);
  state.workspaceInput = pid;
  showNotice("正在读取 Pixiv 作品...");
  setProgress(0.18, "正在获取作品信息");
  clearFailure();
  clearPreviewUrls();
  try {
    let work;
    try {
      const metadata = await fetchMetadata(pid);
      setProgress(0.48, "正在获取页面列表");
      const pages = await fetchPages(pid);
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
    setProgress(1, `已获取 ${work.pageCount} P`);
    clearFailure();
    render();
    await loadPreviews(work);
  } catch (error) {
    state.work = null;
    state.selectedPages.clear();
    const message = error instanceof Error ? error.message : "获取作品失败";
    showNotice(message);
    setProgress(0.48, `P 数获取失败：${message}`, "error");
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
  const maxAttempts = 3;
  let lastError = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
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
      return await response.blob();
    } catch (error) {
      lastError = error;
      if (error.message.includes("401") || error.message.includes("403") || error.message.includes("Pixiv 拒绝")) {
        throw error;
      }
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
      }
    }
  }
  throw lastError || new Error("获取图片失败（已重试 3 次）");
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
  let completed = false;
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
    completed = true;
    state.lastFailedDownload = null;
    elements.retryDownloadButton.hidden = true;
    showNotice(downloadDoneMessage());
  } catch (error) {
    const message = error instanceof Error ? error.message : "下载失败";
    state.lastFailedDownload = {
      work: state.work,
      pages: state.work.pages.filter((page) => state.selectedPages.has(page.page)),
      mode: state.mode
    };
    elements.retryDownloadButton.hidden = false;
    showNotice(message);
    if (!elements.progress.classList.contains("error")) {
      setProgress(0, message, "error");
    }
  } finally {
    if (completed) {
      setProgress(0, "");
    }
    setBusy(false);
  }
}

async function retryFailedDownload() {
  const saved = state.lastFailedDownload;
  if (!saved || state.busy) {
    return;
  }
  elements.retryDownloadButton.hidden = true;
  state.work = saved.work;
  state.selectedPages = new Set(saved.pages.map((p) => p.page));
  state.mode = saved.mode;
  setBusy(true);
  let completed = false;
  try {
    if (saved.mode === "files") {
      if (saved.pages.length === 1) {
        await downloadSinglePage(saved.work, saved.pages[0]);
      } else {
        await downloadFiles(saved.work, saved.pages);
      }
    } else {
      await downloadZip(saved.work, saved.pages);
    }
    completed = true;
    state.lastFailedDownload = null;
    showNotice(downloadDoneMessage());
  } catch (error) {
    const message = error instanceof Error ? error.message : "重试下载失败";
    showNotice(message);
    if (!elements.progress.classList.contains("error")) {
      setProgress(0, message, "error");
    }
  } finally {
    if (completed) {
      setProgress(0, "");
    }
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
  let completed = false;
  try {
    showFavoritesStatus(`正在准备下载 ${favorite.title}...`);
    const work = await loadWorkForDownload(favorite);
    if (mode === "files") {
      await downloadFiles(work, work.pages);
    } else {
      await downloadZip(work, work.pages);
    }
    completed = true;
    showFavoritesStatus(downloadDoneMessage());
  } catch (error) {
    const message = error instanceof Error ? error.message : "下载失败";
    showFavoritesStatus(message);
    if (!elements.progress.classList.contains("error")) {
      setProgress(0, message, "error");
    }
  } finally {
    if (completed) {
      setProgress(0, "");
    }
    setBusy(false);
  }
}

function isBatchMode() {
  return Boolean(state.batch);
}

function startBatchMode(favorites) {
  if (!favorites || favorites.length === 0 || state.busy) {
    return;
  }
  state.batch = {
    queue: favorites.map((f) => ({ favorite: f, status: "pending", error: null })),
    index: 0,
    success: 0,
    failed: 0,
    mode: state.mode,
    running: false
  };
  setTab("workspace");
  renderBatch();
  runBatchDownload();
}

function exitBatchMode() {
  state.batch = null;
  renderBatch();
  render();
}

function renderBatch() {
  if (!elements.batchSummary) return;
  const batch = state.batch;
  elements.batchSummary.hidden = !batch;
  elements.workSummary.hidden = Boolean(batch);
  elements.imageGrid.closest("section").hidden = Boolean(batch);
  elements.batchQueueView.hidden = !batch;
  if (elements.batchDownloadFavoritesButton) {
    elements.batchDownloadFavoritesButton.hidden = Boolean(batch);
  }
  if (!batch) {
    elements.batchQueueGrid.textContent = "";
    return;
  }
  elements.batchSuccessCount.textContent = String(batch.success);
  elements.batchFailedCount.textContent = String(batch.failed);
  const total = batch.queue.length;
  const done = batch.success + batch.failed;
  elements.batchProgressLabel.textContent = `${done} / ${total}`;
  renderBatchQueue();
}

function renderBatchQueue() {
  if (!elements.batchQueueGrid) return;
  if (!state.batch) {
    elements.batchQueueGrid.textContent = "";
    return;
  }
  const pidToElement = new Map();
  for (const child of elements.batchQueueGrid.children) {
    if (child.dataset.pid) {
      pidToElement.set(child.dataset.pid, child);
    }
  }
  const expectedPids = new Set();
  for (const item of state.batch.queue) {
    const pid = item.favorite.pid;
    expectedPids.add(pid);
    let card = pidToElement.get(pid);
    if (!card) {
      card = document.createElement("div");
      card.dataset.pid = pid;
      elements.batchQueueGrid.append(card);
    }
    const expectedClass = `batch-queue-item status-${item.status}`;
    if (card.className !== expectedClass) {
      card.className = expectedClass;
    }
    let titleEl = card.querySelector(".batch-queue-title");
    let pidEl = card.querySelector(".batch-queue-pid");
    let statusEl = card.querySelector(".batch-queue-status");
    if (!titleEl) {
      const title = document.createElement("span");
      title.className = "batch-queue-title";
      title.textContent = item.favorite.title;
      pidEl = document.createElement("span");
      pidEl.className = "batch-queue-pid";
      pidEl.textContent = `PID: ${item.favorite.pid}`;
      statusEl = document.createElement("span");
      statusEl.className = "batch-queue-status";
      card.append(title, pidEl, statusEl);
      titleEl = title;
    }
    titleEl.textContent = item.favorite.title;
    pidEl.textContent = `PID: ${item.favorite.pid}`;
    if (item.status === "pending") statusEl.textContent = "等待中";
    else if (item.status === "downloading") statusEl.textContent = "下载中...";
    else if (item.status === "success") statusEl.textContent = "成功";
    else if (item.status === "failed") statusEl.textContent = `失败: ${item.error || "未知"}`;
  }
  for (const child of Array.from(elements.batchQueueGrid.children)) {
    if (!expectedPids.has(child.dataset.pid)) {
      elements.batchQueueGrid.removeChild(child);
    }
  }
  const active = elements.batchQueueGrid.querySelector(".status-downloading");
  if (active) {
    active.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }
}

async function runBatchDownload() {
  const batch = state.batch;
  if (!batch || batch.running) return;
  batch.running = true;
  setBusy(true);
  try {
    for (let i = batch.index; i < batch.queue.length; i += 1) {
      if (!state.batch) break;
      const item = batch.queue[i];
      batch.index = i;
      item.status = "downloading";
      renderBatchQueue();
      try {
        const work = await loadWorkForDownload(item.favorite);
        const pages = work.pages;
        if (batch.mode === "files") {
          await downloadFiles(work, pages);
        } else {
          await downloadZip(work, pages);
        }
        item.status = "success";
        batch.success += 1;
      } catch (error) {
        item.status = "failed";
        const message = error instanceof Error ? error.message : "下载失败";
        item.error = message;
        batch.failed += 1;
        if (message.includes("部分") || message.includes("成功")) {
          showNotice(`批量下载：${item.favorite.title} 部分成功 - ${message}`);
        }
      }
      renderBatch();
      if (state.batch && i < batch.queue.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }
  } finally {
    setBusy(false);
    if (state.batch) {
      state.batch.running = false;
    }
  }
}

async function downloadSinglePage(work, page) {
  if (!isBatchMode()) setProgress(0.2, `正在下载 p${page.page}`);
  try {
    const blob = await fetchImageBlobCached(
      page.originalUrl,
      work.pid,
      cacheImageKey(work.pid, page.page, "original")
    );
    const filename = `${work.pid}_p${page.page}.${page.extension}`;
    await browserDownloadBlob(blob, filename);
  } catch (error) {
    if (!isBatchMode()) pauseProgressOnPageError(page, 0, 1, error);
    throw error;
  }
  if (!isBatchMode()) setProgress(1, "完成");
}

async function downloadFiles(work, pages) {
  const failures = [];
  for (let index = 0; index < pages.length; index += 1) {
    const page = pages[index];
    if (!isBatchMode()) setProgress(index / pages.length, `正在下载 p${page.page}`);
    try {
      const blob = await fetchImageBlobCached(
        page.originalUrl,
        work.pid,
        cacheImageKey(work.pid, page.page, "original")
      );
      const filename = `${work.pid}_${sanitizeFilename(work.title)}/${work.pid}_p${page.page}.${page.extension}`;
      await browserDownloadBlob(blob, filename);
    } catch (error) {
      if (!isBatchMode()) pauseProgressOnPageError(page, index, pages.length, error);
      failures.push({ page: page.page, error });
    }
  }
  if (failures.length > 0) {
    const failedPages = failures.map(f => `p${f.page}`).join(", ");
    if (!isBatchMode()) setProgress(
      (pages.length - failures.length) / pages.length,
      `下载结束：成功 ${pages.length - failures.length} 张，失败 ${failures.length} 张 (${failedPages})`,
      "error"
    );
    throw new Error(`部分图片下载失败: ${failedPages}`);
  } else {
    if (!isBatchMode()) setProgress(1, "完成");
  }
}

async function downloadZip(work, pages) {
  const zip = new ZipBuilder();
  const failures = [];
  for (let index = 0; index < pages.length; index += 1) {
    const page = pages[index];
    if (!isBatchMode()) setProgress(index / pages.length, `正在获取 p${page.page}`);
    try {
      const blob = await fetchImageBlobCached(
        page.originalUrl,
        work.pid,
        cacheImageKey(work.pid, page.page, "original")
      );
      const bytes = new Uint8Array(await blob.arrayBuffer());
      zip.addFile(`${work.pid}_p${page.page}.${page.extension}`, bytes);
    } catch (error) {
      if (!isBatchMode()) pauseProgressOnPageError(page, index, pages.length, error);
      failures.push({ page: page.page, error });
    }
  }
  if (zip.files.length === 0) {
    const failedPages = failures.map(f => `p${f.page}`).join(", ");
    if (!isBatchMode()) setProgress(0, `生成 ZIP 失败：所有页面均获取失败 (${failedPages})`, "error");
    throw new Error(`所有图片获取失败: ${failedPages}`);
  }
  if (!isBatchMode()) setProgress(0.92, "正在生成 ZIP");
  const zipBlob = zip.toBlob();
  const filename = `${work.pid}_${sanitizeFilename(work.title)}.zip`;
  await browserDownloadBlob(zipBlob, filename);
  if (failures.length > 0) {
    const failedPages = failures.map(f => `p${f.page}`).join(", ");
    if (!isBatchMode()) setProgress(
      (pages.length - failures.length) / pages.length,
      `打包完成，但有部分失败：成功 ${pages.length - failures.length} 张，失败 ${failures.length} 张 (${failedPages})`,
      "error"
    );
    throw new Error(`部分图片打包失败: ${failedPages}`);
  } else {
    if (!isBatchMode()) setProgress(1, "完成");
  }
}

async function browserDownloadBlob(blob, filename) {
  if (state.settings.downloadTarget === "folder") {
    await writeBlobToSelectedFolder(blob, filename);
    return null;
  }
  syncBrowserDownloadSettingsFromForm();
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const downloadFilename = buildBrowserDownloadFilename(filename);
    chrome.downloads.download(
      {
        url,
        filename: downloadFilename,
        saveAs: state.settings.downloadAskEachTime,
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

function pauseProgressOnPageError(page, index, total, error) {
  const message = error instanceof Error ? error.message : "未知错误";
  const value = total > 0 ? index / total : 0;
  setProgress(value, `p${page.page} 获取失败，已暂停：${message}`, "error");
}

function buildBrowserDownloadFilename(filename) {
  const safeFileParts = String(filename)
    .split(/[\\/]+/)
    .map((part) => sanitizePathPart(part))
    .filter(Boolean);
  const directory = getDownloadDirectory();
  const safeDirectoryParts = directory
    ? directory.split("/").map((part) => sanitizePathPart(part)).filter(Boolean)
    : [];
  return [...safeDirectoryParts, ...safeFileParts].join("/") || "download";
}

function downloadDoneMessage() {
  if (state.settings.downloadTarget === "folder") {
    return "已保存到选择的本地文件夹";
  }
  return state.settings.downloadAskEachTime ? "已通过浏览器保存对话框确认下载" : "浏览器下载已发起";
}

async function writeBlobToSelectedFolder(blob, filename) {
  const root = await getWritableDownloadFolderHandle();
  const parts = filename
    .split(/[\\/]+/)
    .map((part) => sanitizePathPart(part))
    .filter(Boolean);
  if (parts.length === 0) {
    throw new Error("下载文件名无效");
  }

  let directory = root;
  for (const part of parts.slice(0, -1)) {
    directory = await directory.getDirectoryHandle(part, { create: true });
  }

  const fileName = await getAvailableFileName(directory, parts.at(-1));
  const fileHandle = await directory.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  try {
    await writable.write(blob);
  } finally {
    await writable.close();
  }
}

async function getWritableDownloadFolderHandle() {
  const handle = state.localDownloadFolderHandle ?? await getStoredDownloadFolderHandle();
  if (!handle) {
    state.settings = normalizeSettings({ ...state.settings, downloadTarget: "browser" });
    await storageSet({ [SETTINGS_KEY]: state.settings });
    syncSettingsForm();
    throw new Error("未选择本地保存文件夹，请点击“浏览”重新选择。");
  }
  const permitted = await hasDirectoryPermission(handle, false);
  if (!permitted) {
    throw new Error("本地保存文件夹权限已失效，请点击“浏览”重新选择。");
  }
  state.localDownloadFolderHandle = handle;
  return handle;
}

async function getAvailableFileName(directory, fileName) {
  const safeName = sanitizePathPart(fileName) || "download";
  const dotIndex = safeName.lastIndexOf(".");
  const stem = dotIndex > 0 ? safeName.slice(0, dotIndex) : safeName;
  const extension = dotIndex > 0 ? safeName.slice(dotIndex) : "";
  for (let index = 0; index < 1000; index += 1) {
    const candidate = index === 0 ? safeName : `${stem} (${index})${extension}`;
    try {
      await directory.getFileHandle(candidate, { create: false });
    } catch (error) {
      if (error instanceof DOMException && error.name === "NotFoundError") {
        return candidate;
      }
      throw error;
    }
  }
  throw new Error("无法生成不重复的下载文件名");
}

function clearNoteSaveTimer(pid) {
  const existingTimer = state.noteSaveTimers.get(pid);
  if (existingTimer) {
    clearTimeout(existingTimer);
    state.noteSaveTimers.delete(pid);
  }
}

async function toggleFavorite() {
  if (!state.work) {
    return;
  }
  const existingIndex = state.favorites.findIndex((favorite) => favorite.pid === state.work.pid);
  if (existingIndex >= 0) {
    clearNoteSaveTimer(state.work.pid);
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
  if (state.settings.downloadTarget === "folder") {
    const item = await getStoredDownloadFolderItem();
    state.localDownloadFolderHandle = item?.handle ?? null;
    state.settings.downloadFolderName = item?.name ?? state.settings.downloadFolderName;
    if (!state.localDownloadFolderHandle) {
      state.settings = normalizeSettings({ ...state.settings, downloadTarget: "browser" });
      await storageSet({ [SETTINGS_KEY]: state.settings });
    }
  }
}

async function saveSettingsFromForm(event) {
  event.preventDefault();
  try {
    state.settings = normalizeSettings({
      downloadTarget: state.settings.downloadTarget,
      downloadDirectory: state.settings.downloadTarget === "folder"
        ? state.settings.downloadDirectory
        : elements.downloadDirectoryInput.value,
      downloadFolderName: state.settings.downloadFolderName,
      downloadAskEachTime: state.settings.downloadTarget === "folder"
        ? false
        : elements.askDownloadLocationInput.checked,
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
  const downloadTarget = source.downloadTarget === "folder" ? "folder" : DEFAULT_SETTINGS.downloadTarget;
  const downloadAskEachTime = downloadTarget === "folder" ? false : Boolean(source.downloadAskEachTime);
  const proxyScheme = ["http", "https", "socks4", "socks5"].includes(source.proxyScheme)
    ? source.proxyScheme
    : DEFAULT_SETTINGS.proxyScheme;
  const proxyHost = String(source.proxyHost ?? DEFAULT_SETTINGS.proxyHost).trim() || DEFAULT_SETTINGS.proxyHost;
  const proxyPort = String(source.proxyPort ?? DEFAULT_SETTINGS.proxyPort).trim();
  const portNumber = Number.parseInt(proxyPort, 10);
  return {
    downloadTarget,
    downloadDirectory: normalizeDownloadDirectory(source.downloadDirectory ?? DEFAULT_SETTINGS.downloadDirectory),
    downloadFolderName: String(source.downloadFolderName ?? "").trim().slice(0, 120),
    downloadAskEachTime,
    proxyEnabled: Boolean(source.proxyEnabled),
    proxyScheme,
    proxyHost,
    proxyPort: Number.isInteger(portNumber) && portNumber >= 1 && portNumber <= 65535
      ? String(portNumber)
      : DEFAULT_SETTINGS.proxyPort
  };
}

function syncSettingsForm() {
  if (state.settings.downloadTarget === "folder") {
    elements.downloadDirectoryInput.value = state.settings.downloadFolderName
      ? `Folder: ${state.settings.downloadFolderName}`
      : "Folder selected";
    elements.downloadDirectoryInput.readOnly = true;
    elements.downloadDirectoryInput.title = "下载会直接保存到已授权的本地文件夹";
    elements.clearDownloadDirectoryButton.hidden = false;
    elements.askDownloadLocationInput.checked = false;
    elements.askDownloadLocationInput.disabled = true;
  } else {
    elements.downloadDirectoryInput.value = formatEditableDownloadDirectory(state.settings.downloadDirectory);
    elements.downloadDirectoryInput.readOnly = false;
    elements.downloadDirectoryInput.title = "保存目录是 Downloads 下的相对路径";
    elements.clearDownloadDirectoryButton.hidden = true;
    elements.askDownloadLocationInput.checked = state.settings.downloadAskEachTime;
    elements.askDownloadLocationInput.disabled = false;
  }
  elements.browseDownloadDirectoryButton.textContent = canPickDirectory() ? "浏览" : "询问";
  elements.browseDownloadDirectoryButton.title = canPickDirectory()
    ? "选择一个本地保存文件夹"
    : "当前扩展环境不支持直接选择文件夹，点击后改为下载时询问保存位置";
  updateDownloadDirectoryDisplay();
  elements.proxyEnabledInput.checked = state.settings.proxyEnabled;
  elements.proxySchemeInput.value = state.settings.proxyScheme;
  elements.proxyHostInput.value = state.settings.proxyHost;
  elements.proxyPortInput.value = state.settings.proxyPort;
}

function getDownloadDirectory() {
  return normalizeDownloadDirectory(state.settings.downloadDirectory);
}

function syncBrowserDownloadSettingsFromForm() {
  if (state.settings.downloadTarget === "folder") {
    return;
  }
  state.settings = normalizeSettings({
    ...state.settings,
    downloadDirectory: elements.downloadDirectoryInput.value,
    downloadAskEachTime: elements.askDownloadLocationInput.checked
  });
  elements.downloadDirectoryInput.value = formatEditableDownloadDirectory(state.settings.downloadDirectory);
  updateDownloadDirectoryDisplay();
  storageSet({ [SETTINGS_KEY]: state.settings }).catch(() => undefined);
}

function switchToBrowserDownloadDirectory() {
  if (state.settings.downloadTarget === "folder") {
    state.settings = normalizeSettings({ ...state.settings, downloadTarget: "browser" });
    state.localDownloadFolderHandle = null;
    elements.downloadDirectoryInput.readOnly = false;
    elements.clearDownloadDirectoryButton.hidden = true;
    elements.askDownloadLocationInput.disabled = false;
  }
  updateDownloadDirectoryDisplay();
}

function updateDownloadDirectoryDisplay() {
  if (state.settings.downloadTarget === "folder") {
    elements.downloadDirectoryHint.textContent = `Saved to: ${state.settings.downloadFolderName || "selected folder"}`;
    return;
  }
  const directory = normalizeDownloadDirectory(elements.downloadDirectoryInput.value);
  elements.downloadDirectoryHint.textContent = state.settings.downloadAskEachTime
    ? `下载时选择保存位置；默认子目录：${formatDownloadDirectoryPath(directory)}`
    : `实际保存：${formatDownloadDirectoryPath(directory)}`;
  elements.downloadDirectoryInput.title = "保存目录是 Downloads 下的相对路径";
}

function formatDownloadDirectoryPath(value) {
  const directory = normalizeDownloadDirectory(value).replace(/\//g, "\\");
  return `Downloads\\${directory}`;
}

function formatEditableDownloadDirectory(value) {
  return normalizeDownloadDirectory(value).replace(/\//g, "\\");
}

async function chooseDownloadDirectory() {
  if (!canPickDirectory()) {
    state.settings = normalizeSettings({
      ...state.settings,
      downloadTarget: "browser",
      downloadAskEachTime: true
    });
    await storageSet({ [SETTINGS_KEY]: state.settings });
    syncSettingsForm();
    showNotice("当前扩展环境不支持直接选择文件夹，已改为下载时弹出保存位置选择框。");
    return;
  }
  try {
    const handle = await window.showDirectoryPicker({
      id: "pixivdl-downloads",
      mode: "readwrite"
    });
    const permitted = await hasDirectoryPermission(handle, true);
    if (!permitted) {
      showNotice("未获得文件夹写入权限，保存位置未改变。");
      return;
    }
    await putDownloadFolderHandle(handle);
    state.localDownloadFolderHandle = handle;
    state.settings = normalizeSettings({
      ...state.settings,
      downloadTarget: "folder",
      downloadFolderName: handle.name,
      downloadAskEachTime: false
    });
    await storageSet({ [SETTINGS_KEY]: state.settings });
    syncSettingsForm();
    showNotice(`已选择本地保存文件夹：${handle.name}`);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      showNotice("已取消选择保存文件夹");
      return;
    }
    showNotice(error instanceof Error ? error.message : "选择保存文件夹失败");
  }
}

async function clearSelectedDownloadDirectory() {
  state.localDownloadFolderHandle = null;
  state.settings = normalizeSettings({
    ...state.settings,
    downloadTarget: "browser",
    downloadFolderName: "",
    downloadAskEachTime: false
  });
  await deleteStoredDownloadFolderHandle().catch(() => undefined);
  await storageSet({ [SETTINGS_KEY]: state.settings });
  syncSettingsForm();
  showNotice(`已恢复为 ${formatDownloadDirectoryPath(state.settings.downloadDirectory)}`);
}

async function toggleAskDownloadLocation() {
  state.settings = normalizeSettings({
    ...state.settings,
    downloadTarget: "browser",
    downloadAskEachTime: elements.askDownloadLocationInput.checked
  });
  state.localDownloadFolderHandle = null;
  await storageSet({ [SETTINGS_KEY]: state.settings });
  syncSettingsForm();
  showNotice(state.settings.downloadAskEachTime
    ? "下载时会弹出保存位置选择框"
    : `已恢复为 ${formatDownloadDirectoryPath(state.settings.downloadDirectory)}`);
}

function canPickDirectory() {
  return typeof window.showDirectoryPicker === "function";
}

async function hasDirectoryPermission(handle, request) {
  const options = { mode: "readwrite" };
  if ((await handle.queryPermission(options)) === "granted") {
    return true;
  }
  return request && (await handle.requestPermission(options)) === "granted";
}

function normalizeDownloadDirectory(value) {
  let raw = String(value ?? "")
    .trim()
    .replace(/^(?:浏览器下载目录|Downloads)[\\/]+/i, "");
  if (!raw) {
    return DEFAULT_SETTINGS.downloadDirectory;
  }
  raw = raw.replace(/^[a-zA-Z]:[\\/]+/, "");
  const downloadsMatch = raw.match(/(?:^|[\\/])Downloads[\\/]+(.+)$/i);
  if (downloadsMatch?.[1]) {
    raw = downloadsMatch[1];
  }
  const parts = raw
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
      addedAt: favorite.addedAt,
      note: favorite.note || ""
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
      addedAt: validDateString(item?.addedAt) ? item.addedAt : new Date().toISOString(),
      note: typeof item?.note === "string" ? item.note.slice(0, 1000) : ""
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

function setProgress(value, text, tone = "normal") {
  elements.progress.hidden = !text;
  elements.progressText.textContent = text;
  elements.progressBar.style.width = `${Math.max(0, Math.min(1, value)) * 100}%`;
  elements.progress.classList.toggle("error", tone === "error");
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
  elements.batchDownloadFavoritesButton.hidden = !state.openedAsTab || state.favorites.length === 0;
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
  if (favorite && state.selectedFavoritePid !== favorite.pid) {
    clearNoteSaveTimer(state.selectedFavoritePid);
  }
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
  noteInput.value = favorite.note || "";
  noteInput.addEventListener("input", () => {
    favorite.note = noteInput.value;
    const existingTimer = state.noteSaveTimers.get(favorite.pid);
    if (existingTimer) clearTimeout(existingTimer);
    const timer = setTimeout(() => {
      state.noteSaveTimers.delete(favorite.pid);
      saveFavorites();
    }, 500);
    state.noteSaveTimers.set(favorite.pid, timer);
  });
  noteInput.addEventListener("blur", () => {
    const existingTimer = state.noteSaveTimers.get(favorite.pid);
    if (existingTimer) {
      clearTimeout(existingTimer);
      state.noteSaveTimers.delete(favorite.pid);
    }
    saveFavorites();
  });
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

let activeDbConnection = null;

async function getDatabase() {
  if (activeDbConnection) {
    return activeDbConnection;
  }
  activeDbConnection = await openDatabase();
  activeDbConnection.onclose = () => {
    activeDbConnection = null;
  };
  return activeDbConnection;
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
      if (!db.objectStoreNames.contains(HANDLE_STORE)) {
        db.createObjectStore(HANDLE_STORE, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("打开本地缓存失败"));
  });
}

async function idbTransaction(storeName, mode, callback) {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    let request;
    try {
      request = callback(store);
    } catch (error) {
      reject(error);
      return;
    }
    transaction.oncomplete = () => {
      resolve(request?.result);
    };
    transaction.onerror = () => {
      reject(transaction.error ?? new Error("本地缓存操作失败"));
    };
    transaction.onabort = () => {
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

async function putDownloadFolderHandle(handle) {
  await idbTransaction(HANDLE_STORE, "readwrite", (store) =>
    store.put({ key: DOWNLOAD_FOLDER_HANDLE_KEY, handle, name: handle.name, savedAt: new Date().toISOString() })
  );
}

async function getStoredDownloadFolderItem() {
  return idbTransaction(HANDLE_STORE, "readonly", (store) => store.get(DOWNLOAD_FOLDER_HANDLE_KEY));
}

async function getStoredDownloadFolderHandle() {
  const item = await getStoredDownloadFolderItem();
  return item?.handle ?? null;
}

async function deleteStoredDownloadFolderHandle() {
  await idbTransaction(HANDLE_STORE, "readwrite", (store) => store.delete(DOWNLOAD_FOLDER_HANDLE_KEY));
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

async function updateCacheSizeDisplay() {
  if (!elements.cacheSizeLabel) return;
  try {
    const estimate = await navigator.storage.estimate();
    const usage = estimate.usage || 0;
    elements.cacheSizeLabel.textContent = `已用空间: ${formatBytes(usage)}`;
  } catch (error) {
    elements.cacheSizeLabel.textContent = "缓存空间: 无法读取";
  }
}

async function clearCacheAction() {
  if (!confirm("确定要清除所有缓存的作品和图片数据吗？\n清除后，离线查看或重新下载将需要重新获取网络数据。")) {
    return;
  }
  setBusy(true);
  try {
    await clearCacheStores();
    showNotice("本地缓存已成功清理");
    await updateCacheSizeDisplay();
  } catch (error) {
    showNotice("缓存清理失败：" + (error instanceof Error ? error.message : "未知错误"));
  } finally {
    setBusy(false);
  }
}

function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

