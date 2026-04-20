import { FormEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Archive,
  Check,
  Download,
  Folder,
  Heart,
  Image,
  Loader2,
  Search,
  Settings as SettingsIcon,
  Trash2,
  Upload,
  X
} from "lucide-react";
import { api, Favorite, PixivWork, Settings } from "./api";

type Tab = "workspace" | "favorites" | "settings";

export function App() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("workspace");
  const [pidInput, setPidInput] = useState("");
  const [activePid, setActivePid] = useState("");
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [mode, setMode] = useState<"files" | "zip">("zip");
  const [notice, setNotice] = useState<string | null>(null);

  const settingsQuery = useQuery({ queryKey: ["settings"], queryFn: api.getSettings });
  const workQuery = useQuery({
    queryKey: ["work", activePid],
    queryFn: () => api.getWork(activePid),
    enabled: activePid.length > 0
  });
  const favoritesQuery = useQuery({ queryKey: ["favorites"], queryFn: api.listFavorites });
  useEffect(() => {
    if (workQuery.data) {
      setSelectedPages(new Set(workQuery.data.pages.map((page) => page.page)));
    }
  }, [workQuery.data]);

  const downloadMutation = useMutation({
    mutationFn: () =>
      api.browserDownload({
        pid: activePid,
        pages: Array.from(selectedPages).sort((a, b) => a - b),
        mode
      }),
    onSuccess: ({ blob, filename }) => {
      triggerBrowserDownload(blob, filename);
      setNotice("浏览器下载已发起");
    },
    onError: (error) => setNotice(error instanceof Error ? error.message : "下载失败")
  });

  const favoriteMutation = useMutation({
    mutationFn: (pid: string) => api.addFavorite(pid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["favorites"] });
      setNotice("已加入收藏");
    },
    onError: (error) => setNotice(error instanceof Error ? error.message : "收藏失败")
  });

  const deleteFavoriteMutation = useMutation({
    mutationFn: (pid: string) => api.deleteFavorite(pid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["favorites"] });
      setNotice("已取消收藏");
    },
    onError: (error) => setNotice(error instanceof Error ? error.message : "取消收藏失败")
  });

  const selectedCount = selectedPages.size;
  const allSelected = workQuery.data ? selectedCount === workQuery.data.pages.length : false;
  const favoritePids = useMemo(
    () => new Set((favoritesQuery.data ?? []).map((favorite) => favorite.pid)),
    [favoritesQuery.data]
  );
  const isCurrentFavorite = activePid ? favoritePids.has(activePid) : false;

  function submitPid(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const pid = pidInput.trim();
    if (!/^\d+$/.test(pid)) {
      setNotice("PID 只能包含数字");
      return;
    }
    setActivePid(pid);
    setTab("workspace");
    setNotice(null);
  }

  function openFavorite(favorite: Favorite) {
    setPidInput(favorite.pid);
    setActivePid(favorite.pid);
    setTab("workspace");
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">PixivDL</p>
          <h1>本地 Pixiv 图片下载工作台</h1>
        </div>
        <form className="pid-form" onSubmit={submitPid}>
          <Search size={18} />
          <input
            value={pidInput}
            onChange={(event) => setPidInput(event.target.value)}
            placeholder="输入作品 PID"
            inputMode="numeric"
          />
          <button type="submit">获取</button>
        </form>
      </header>

      <nav className="tabs" aria-label="主导航">
        <button className={tab === "workspace" ? "active" : ""} onClick={() => setTab("workspace")}>
          <Image size={17} /> 工作台
        </button>
        <button className={tab === "favorites" ? "active" : ""} onClick={() => setTab("favorites")}>
          <Heart size={17} /> 收藏夹
        </button>
        <button className={tab === "settings" ? "active" : ""} onClick={() => setTab("settings")}>
          <SettingsIcon size={17} /> 设置
        </button>
        <StatusPills settings={settingsQuery.data} />
      </nav>

      {notice ? (
        <div className="notice">
          <span>{notice}</span>
          <button aria-label="关闭提示" onClick={() => setNotice(null)}>
            <X size={16} />
          </button>
        </div>
      ) : null}

      {tab === "workspace" ? (
        <Workspace
          work={workQuery.data}
          isLoading={workQuery.isFetching}
          error={workQuery.error}
          selectedPages={selectedPages}
          setSelectedPages={setSelectedPages}
          allSelected={allSelected}
          mode={mode}
          setMode={setMode}
          selectedCount={selectedCount}
          onDownload={() => downloadMutation.mutate()}
          downloading={downloadMutation.isPending}
          isFavorite={isCurrentFavorite}
          onFavorite={() => {
            if (!activePid) {
              return;
            }
            if (isCurrentFavorite) {
              deleteFavoriteMutation.mutate(activePid);
            } else {
              favoriteMutation.mutate(activePid);
            }
          }}
          favoritePending={favoriteMutation.isPending || deleteFavoriteMutation.isPending}
        />
      ) : null}

      {tab === "favorites" ? (
        <Favorites
          favorites={favoritesQuery.data ?? []}
          loading={favoritesQuery.isLoading}
          onOpen={openFavorite}
          onDelete={(pid) => deleteFavoriteMutation.mutate(pid)}
        />
      ) : null}

      {tab === "settings" ? (
        <SettingsPanel
          settings={settingsQuery.data}
          onSaved={(message) => {
            queryClient.invalidateQueries({ queryKey: ["settings"] });
            setNotice(message);
          }}
        />
      ) : null}
    </main>
  );
}

function StatusPills({ settings }: { settings?: Settings }) {
  return (
    <div className="status-pills">
      <span className={settings?.cookie_present ? "pill good" : "pill warn"}>
        {settings?.cookie_present ? "Cookie 已设置" : "Cookie 未设置"}
      </span>
      <span className={settings?.proxy_url ? "pill good" : "pill"}>{settings?.proxy_url ? "代理已启用" : "未设置代理"}</span>
    </div>
  );
}

function Workspace(props: {
  work?: PixivWork;
  isLoading: boolean;
  error: unknown;
  selectedPages: Set<number>;
  setSelectedPages: (value: Set<number>) => void;
  allSelected: boolean;
  mode: "files" | "zip";
  setMode: (mode: "files" | "zip") => void;
  selectedCount: number;
  onDownload: () => void;
  downloading: boolean;
  isFavorite: boolean;
  onFavorite: () => void;
  favoritePending: boolean;
}) {
  const errorMessage = props.error instanceof Error ? props.error.message : null;
  return (
    <section className="workspace-grid">
      <aside className="work-summary">
        {props.work ? (
          <>
            <img src={props.work.cover_url} alt={props.work.title} />
            <h2>{props.work.title}</h2>
            <p>{props.work.author_name}</p>
            <div className="meta-row">
              <span>PID {props.work.pid}</span>
              <span>{props.work.page_count} 张</span>
            </div>
            <button
              className={`ghost-button favorite-action ${props.isFavorite ? "favorited" : ""}`}
              onClick={props.onFavorite}
              disabled={props.favoritePending}
            >
              <Heart size={17} fill={props.isFavorite ? "currentColor" : "none"} />
              {props.isFavorite ? "已收藏" : "收藏"}
            </button>
          </>
        ) : (
          <div className="empty-state">
            <Image size={34} />
            <h2>输入 PID 获取作品</h2>
            <p>作品页会在这里显示封面、作者和图片数量。</p>
          </div>
        )}
      </aside>

      <section className="image-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Images</p>
            <h2>图片选择</h2>
          </div>
          {props.work ? (
            <button
              className="text-button"
              onClick={() =>
                props.setSelectedPages(
                  props.allSelected ? new Set() : new Set(props.work!.pages.map((page) => page.page))
                )
              }
            >
              {props.allSelected ? "取消全选" : "全选"}
            </button>
          ) : null}
        </div>
        {props.isLoading ? <LoadingState label="正在获取 Pixiv 作品" /> : null}
        {errorMessage ? <p className="error-text">{errorMessage}</p> : null}
        <div className="image-grid">
          {props.work?.pages.map((page) => {
            const checked = props.selectedPages.has(page.page);
            return (
              <button
                className={`image-tile ${checked ? "selected" : ""}`}
                key={page.page}
                onClick={() => {
                  const next = new Set(props.selectedPages);
                  if (next.has(page.page)) {
                    next.delete(page.page);
                  } else {
                    next.add(page.page);
                  }
                  props.setSelectedPages(next);
                }}
              >
                <img src={page.preview_url} alt={`p${page.page}`} loading="lazy" />
                <span>p{page.page}</span>
                <i>{checked ? <Check size={16} /> : null}</i>
              </button>
            );
          })}
        </div>
      </section>

      <aside className="download-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Download</p>
            <h2>下载</h2>
          </div>
          <Download size={20} />
        </div>
        <p className="browser-download-note">文件会由浏览器直接保存到默认下载目录；多张图片会自动打包成 ZIP。</p>
        <div className="segmented">
          <button className={props.mode === "zip" ? "active" : ""} onClick={() => props.setMode("zip")}>
            <Archive size={16} /> ZIP
          </button>
          <button className={props.mode === "files" ? "active" : ""} onClick={() => props.setMode("files")}>
            <Folder size={16} /> 文件
          </button>
        </div>
        <button
          className="primary-button"
          disabled={!props.work || props.selectedCount === 0 || props.downloading}
          onClick={props.onDownload}
        >
          {props.downloading ? <Loader2 className="spin" size={17} /> : <Download size={17} />}
          下载 {props.selectedCount} 张
        </button>
      </aside>
    </section>
  );
}

function Favorites(props: {
  favorites: Favorite[];
  loading: boolean;
  onOpen: (favorite: Favorite) => void;
  onDelete: (pid: string) => void;
}) {
  if (props.loading) {
    return <LoadingState label="正在读取收藏夹" />;
  }
  return (
    <section className="favorites-grid">
      {props.favorites.map((favorite) => (
        <article className="favorite-item" key={favorite.pid}>
          <button className="cover-button" onClick={() => props.onOpen(favorite)}>
            <img src={favorite.cover_url} alt={favorite.title} />
            <span>{favorite.page_count} 张</span>
          </button>
          <div>
            <h2>{favorite.title}</h2>
            <p>{favorite.author_name} · PID {favorite.pid}</p>
          </div>
          <button className="icon-button" aria-label="删除收藏" onClick={() => props.onDelete(favorite.pid)}>
            <Trash2 size={17} />
          </button>
        </article>
      ))}
      {!props.favorites.length ? (
        <div className="empty-state wide">
          <Heart size={34} />
          <h2>暂无收藏</h2>
          <p>在工作台获取作品后点击收藏，封面和图片数量会显示在这里。</p>
        </div>
      ) : null}
    </section>
  );
}

function triggerBrowserDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function SettingsPanel({ settings, onSaved }: { settings?: Settings; onSaved: (message: string) => void }) {
  const [downloadPath, setDownloadPath] = useState(settings?.download_path ?? "");
  const [proxyUrl, setProxyUrl] = useState(settings?.proxy_url ?? "");
  const [concurrency, setConcurrency] = useState(settings?.concurrency ?? 2);
  const [delayMs, setDelayMs] = useState(settings?.delay_ms ?? 800);
  const [cookie, setCookie] = useState("");
  const [saveCookie, setSaveCookie] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (settings) {
      setDownloadPath(settings.download_path);
      setProxyUrl(settings.proxy_url);
      setConcurrency(settings.concurrency);
      setDelayMs(settings.delay_ms);
    }
  }, [settings]);

  const saveSettings = useMutation({
    mutationFn: () =>
      api.updateSettings({
        download_path: downloadPath,
        proxy_url: proxyUrl,
        concurrency,
        delay_ms: delayMs
      }),
    onSuccess: () => onSaved("设置已保存"),
    onError: (error) => setMessage(error instanceof Error ? error.message : "保存失败")
  });
  const cookieMutation = useMutation({
    mutationFn: () => api.setCookie(cookie, saveCookie),
    onSuccess: (result) => {
      setCookie("");
      onSaved(result.message);
    },
    onError: (error) => setMessage(error instanceof Error ? error.message : "Cookie 保存失败")
  });
  const clearCookie = useMutation({
    mutationFn: api.clearCookie,
    onSuccess: () => onSaved("Cookie 已清除")
  });
  const pathTest = useMutation({
    mutationFn: () => api.testPath(downloadPath),
    onSuccess: (result) => setMessage(result.message),
    onError: (error) => setMessage(error instanceof Error ? error.message : "路径不可用")
  });
  const proxyTest = useMutation({
    mutationFn: () => api.testProxy(proxyUrl),
    onSuccess: (result) => setMessage(result.message),
    onError: (error) => setMessage(error instanceof Error ? error.message : "代理不可用")
  });

  async function importCookieFile(file: File | undefined) {
    if (!file) {
      return;
    }
    if (!file.name.toLowerCase().endsWith(".txt")) {
      setMessage("请选择 .txt 文件");
      return;
    }
    try {
      const text = await file.text();
      const parsed = parseCookieText(text);
      if (!parsed) {
        setMessage("未能从文件中识别 Pixiv Cookie");
        return;
      }
      setCookie(parsed);
      setMessage(`已导入 ${parsed.split(";").length} 个 Cookie`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Cookie 文件读取失败");
    }
  }

  return (
    <section className="settings-grid">
      <div className="settings-section">
        <h2>下载与代理</h2>
        <label>
          下载路径
          <input value={downloadPath} onChange={(event) => setDownloadPath(event.target.value)} />
        </label>
        <label>
          本地代理
          <input value={proxyUrl} onChange={(event) => setProxyUrl(event.target.value)} placeholder="http://127.0.0.1:7890" />
        </label>
        <div className="inline-fields">
          <label>
            并发
            <input type="number" min={1} max={6} value={concurrency} onChange={(event) => setConcurrency(Number(event.target.value))} />
          </label>
          <label>
            间隔 ms
            <input type="number" min={0} max={10000} value={delayMs} onChange={(event) => setDelayMs(Number(event.target.value))} />
          </label>
        </div>
        <div className="button-row">
          <button onClick={() => pathTest.mutate()}>测试路径</button>
          <button onClick={() => proxyTest.mutate()}>测试代理</button>
          <button className="primary-button compact" onClick={() => saveSettings.mutate()}>
            保存设置
          </button>
        </div>
      </div>

      <div className="settings-section">
        <h2>Pixiv Cookie</h2>
        <label className="file-import">
          <Upload size={17} />
          导入 Get cookies.txt
          <input
            type="file"
            accept=".txt,text/plain"
            onChange={(event) => {
              importCookieFile(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </label>
        <textarea
          value={cookie}
          onChange={(event) => setCookie(event.target.value)}
          placeholder="PHPSESSID=...; ... 或导入 cookies.txt"
          rows={7}
        />
        <label className="check-row">
          <input type="checkbox" checked={saveCookie} onChange={(event) => setSaveCookie(event.target.checked)} />
          保存到系统凭据库
        </label>
        <div className="button-row">
          <button className="primary-button compact" onClick={() => cookieMutation.mutate()} disabled={!cookie.trim()}>
            保存 Cookie
          </button>
          <button onClick={() => clearCookie.mutate()}>清除 Cookie</button>
        </div>
      </div>
      {message ? <p className="settings-message">{message}</p> : null}
    </section>
  );
}

export function parseCookieText(text: string): string {
  const cookies = new Map<string, string>();
  const lines = text.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    let normalized = trimmed;
    if (normalized.startsWith("#HttpOnly_")) {
      normalized = normalized.slice("#HttpOnly_".length);
    } else if (normalized.startsWith("#")) {
      continue;
    }

    const parts = normalized.split(/\t+/);
    if (parts.length >= 7) {
      const domain = parts[0].toLowerCase();
      const name = parts[5]?.trim();
      const value = parts.slice(6).join("\t").trim();
      if (domain.includes("pixiv.net") && name && value) {
        cookies.set(name, value);
      }
    }
  }

  if (cookies.size > 0) {
    return Array.from(cookies, ([name, value]) => `${name}=${value}`).join("; ");
  }

  const raw = text
    .replace(/^cookie:\s*/i, "")
    .split(/[;\r\n]+/)
    .map((part) => part.trim())
    .filter((part) => part && !part.startsWith("#") && part.includes("="));

  return raw.join("; ");
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="loading-state">
      <Loader2 className="spin" size={20} />
      <span>{label}</span>
    </div>
  );
}
