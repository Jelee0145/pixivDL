import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { App, parseCookieText } from "./App";

function renderApp() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/api/settings")) {
        return new Response(
          JSON.stringify({
            download_path: "D:/Downloads/PixivDL",
            proxy_url: "",
            concurrency: 2,
            delay_ms: 800,
            cookie_saved: false,
            cookie_present: false
          }),
          { status: 200 }
        );
      }
      if (url.endsWith("/api/favorites")) {
        return new Response(JSON.stringify([]), { status: 200 });
      }
      return new Response(JSON.stringify({ detail: "not found" }), { status: 404 });
    })
  );
  return render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  );
}

describe("App", () => {
  it("renders the workspace controls", async () => {
    renderApp();
    expect(screen.getByRole("heading", { name: "本地 Pixiv 图片下载工作台" })).toBeInTheDocument();
    expect(await screen.findByText("Cookie 未设置")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("输入作品 PID")).toBeInTheDocument();
  });

  it("parses Netscape cookies.txt exports", () => {
    const text = [
      "# Netscape HTTP Cookie File",
      "#HttpOnly_.pixiv.net\tTRUE\t/\tTRUE\t1999999999\tPHPSESSID\tabc123",
      ".pixiv.net\tTRUE\t/\tFALSE\t1999999999\tdevice_token\tdev456",
      ".example.com\tTRUE\t/\tFALSE\t1999999999\tignored\tvalue"
    ].join("\n");

    expect(parseCookieText(text)).toBe("PHPSESSID=abc123; device_token=dev456");
  });

  it("keeps raw cookie header text", () => {
    expect(parseCookieText("Cookie: PHPSESSID=abc123; device_token=dev456")).toBe(
      "PHPSESSID=abc123; device_token=dev456"
    );
  });
});
