export type Settings = {
  download_path: string;
  proxy_url: string;
  concurrency: number;
  delay_ms: number;
  cookie_saved: boolean;
  cookie_present: boolean;
};

export type PixivImagePage = {
  page: number;
  original_url: string;
  regular_url?: string | null;
  thumb_url?: string | null;
  extension: string;
  preview_url: string;
};

export type PixivWork = {
  pid: string;
  title: string;
  author_id: string;
  author_name: string;
  page_count: number;
  cover_url: string;
  pages: PixivImagePage[];
};

export type DownloadJob = {
  id: string;
  pid: string;
  mode: "files" | "zip";
  status: "queued" | "running" | "done" | "failed";
  total: number;
  completed: number;
  failed_pages: number[];
  files: string[];
  error?: string | null;
};

export type Favorite = {
  pid: string;
  title: string;
  author_id: string;
  author_name: string;
  page_count: number;
  cover_url: string;
  cover_cache_path?: string | null;
  added_at: string;
  updated_at: string;
  metadata: PixivWork;
};

type Method = "GET" | "POST" | "PUT" | "DELETE";

async function request<T>(path: string, options: { method?: Method; body?: unknown } = {}): Promise<T> {
  const response = await fetch(path, {
    method: options.method ?? "GET",
    headers: options.body === undefined ? undefined : { "Content-Type": "application/json" },
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  if (!response.ok) {
    let message = response.statusText;
    try {
      const data = (await response.json()) as { detail?: string };
      message = data.detail ?? message;
    } catch {
      // Keep the HTTP status text.
    }
    throw new Error(message);
  }
  return response.json() as Promise<T>;
}

async function downloadRequest(path: string, body: unknown): Promise<{ blob: Blob; filename: string }> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    let message = response.statusText;
    try {
      const data = (await response.json()) as { detail?: string };
      message = data.detail ?? message;
    } catch {
      // Keep the HTTP status text.
    }
    throw new Error(message);
  }
  const disposition = response.headers.get("content-disposition") ?? "";
  return {
    blob: await response.blob(),
    filename: parseContentDispositionFilename(disposition) ?? "pixivdl-download"
  };
}

function parseContentDispositionFilename(value: string): string | null {
  const encoded = value.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (encoded) {
    return decodeURIComponent(encoded);
  }
  return value.match(/filename="([^"]+)"/i)?.[1] ?? null;
}

export const api = {
  getSettings: () => request<Settings>("/api/settings"),
  updateSettings: (payload: Partial<Settings>) => request<Settings>("/api/settings", { method: "PUT", body: payload }),
  testPath: (path: string) => request<{ ok: boolean; message: string }>("/api/settings/test-path", { method: "POST", body: { path } }),
  testProxy: (proxy_url?: string) => request<{ ok: boolean; message: string }>("/api/settings/test-proxy", { method: "POST", body: { proxy_url } }),
  setCookie: (cookie: string, save: boolean) => request<{ ok: boolean; message: string }>("/api/auth/cookie", { method: "POST", body: { cookie, save } }),
  clearCookie: () => request<{ ok: boolean; message: string }>("/api/auth/cookie", { method: "DELETE" }),
  getWork: (pid: string) => request<PixivWork>(`/api/works/${encodeURIComponent(pid)}`),
  createDownload: (payload: { pid: string; pages: number[]; mode: "files" | "zip"; target_dir?: string }) =>
    request<DownloadJob>("/api/downloads", { method: "POST", body: payload }),
  browserDownload: (payload: { pid: string; pages: number[]; mode: "files" | "zip" }) =>
    downloadRequest("/api/downloads/browser", payload),
  getDownload: (id: string) => request<DownloadJob>(`/api/downloads/${encodeURIComponent(id)}`),
  listFavorites: () => request<Favorite[]>("/api/favorites"),
  addFavorite: (pid: string) => request<Favorite>(`/api/favorites/${encodeURIComponent(pid)}`, { method: "POST" }),
  deleteFavorite: (pid: string) => request<{ ok: boolean; message: string }>(`/api/favorites/${encodeURIComponent(pid)}`, { method: "DELETE" })
};
