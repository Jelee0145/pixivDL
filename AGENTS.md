# PixivDL Agent Instructions

This repository contains a Chrome/Edge Manifest V3 browser extension for downloading Pixiv artwork by PID. Follow these instructions for all files under this directory.

## Project Shape

- Source lives in `extension/`.
- `dist/` contains generated release/loadable artifacts and is ignored by Git.
- The extension has no local backend. Pixiv metadata and image requests run in the browser with the user's existing Pixiv login state.
- Do not add code that imports, stores, or asks for Pixiv cookies.
- Current product direction is a Chrome/Edge Manifest V3 extension, not the earlier FastAPI + React local web app.
- The default user install/update target is `dist\PixivDL-Browser-latest`; preserve this stable directory name so Chrome keeps the same unpacked-extension identity and can retain `chrome.storage.local` and IndexedDB data.
- Versioned folders such as `dist\PixivDL-Browser-0.5.1` are useful release artifacts, but should not replace `PixivDL-Browser-latest` as the main recommended local install path.
- User data belongs in Chrome extension storage:
  - Favorites: `chrome.storage.local`.
  - Work/image cache: extension IndexedDB.
  - Pixiv login state: normal browser `pixiv.net` cookies, never copied into this extension.

## Development Guidelines

- Prefer small, direct changes in `extension/popup.html`, `extension/popup.css`, `extension/popup.js`, `extension/manifest.json`, and docs.
- Keep browser APIs wrapped in small helpers when behavior is reused, especially for `chrome.downloads`, `chrome.storage`, `chrome.proxy`, and IndexedDB.
- Download paths passed to `chrome.downloads.download` must be browser-relative paths. Sanitize user-controlled path segments and do not allow `.` or `..` segments.
- Proxy settings must be browser-extension scoped through `chrome.proxy.settings`. Do not modify Windows system proxy, environment variables, Winsock, drivers, WSL/Docker, or global runtimes without explicit user approval for the exact command.
- If the extension is loaded unpacked during testing, Chrome may create `_metadata/`. Treat it as a generated artifact and do not keep it in source or dist output.
- Prefer browser-native downloads through `chrome.downloads.download`; avoid reintroducing backend file writing or arbitrary absolute filesystem paths.
- Keep custom save paths browser-relative and easy to reason about. The UI may expose a subdirectory under the browser download directory, not an unrestricted Windows path picker.
- When a Pixiv API request fails, prefer a clear fallback that offers to open the original Pixiv artwork page instead of adding mirror-site scraping.
- Do not add mirror-site integrations unless the user explicitly reopens that decision; the current desired fallback is "前往 Pixiv 查看".
- Duplicate favorite protection is expected. Adding the same PID again should not create duplicate favorite records.
- For favorite downloads, use the saved PID to fetch current metadata/pages, fall back to local cache if available, and let the user choose ZIP or file mode before starting.

## User Preferences

- Communicate progress and tradeoffs in Chinese, with concrete status and verification results.
- The user prefers stepwise completion, but expects the selected step to be finished end-to-end in the same turn when practical: implement, sync build artifacts, run checks, then report what changed.
- Avoid speculative Windows/network repairs. Before blaming TUN, proxy, Python, FastAPI, virtual adapters, or games/apps, run read-only checks first; ask before any admin, registry, DISM/SFC, netsh, driver, global runtime, or persistent proxy change.
- Do not leave long-lived system or Codex proxy changes enabled as a convenience workaround.
- The user values clean, layered UI over dense tool accumulation. Keep the extension blue/white, visually simple, and functionally separated:
  - Popup workspace: PID search, preview, selection, settings, download.
  - Popup favorites tab: search existing favorites without losing the top search affordance.
  - New-tab favorites warehouse: pure favorites gallery, import/export near the title, search, right-side detail panel, per-card download/delete actions.
- Avoid keeping irrelevant controls after a workflow changes. For example, do not keep "清缓存" or generic "新标签页打开" controls in places where they no longer match the user's current flow.
- State changes should be visible immediately: favorited works should show an "已收藏" state; selected cards and status messages should update without requiring reload.
- For packaging, keep outputs easy for a non-developer to understand. Prefer one obvious release ZIP plus the stable `PixivDL-Browser-latest` directory.

## Multi-Agent Collaboration

- Treat cross-window or multi-role work as a shared-state problem. Do not assume another agent has seen your chat history.
- Before implementation, every agent must read:
  - `AGENTS.md`
  - `docs/agent-collaboration.md`
  - `docs/agent-update-log.md`
- Before implementation, every agent must review recent git activity:
  - `git log --oneline -5`
  - `git diff --stat HEAD~1..HEAD`
- If the task touches files changed recently, inspect the relevant diff before editing.
- Before implementation, add or update an entry in `docs/agent-update-log.md` describing:
  - The task goal and scope
  - Planned files
  - Planned implementation approach
  - Risks, hidden hazards, regressions, and any information worth syncing to other agents
- After implementation, update the same log entry with:
  - Completed work
  - Files changed
  - Fixed bugs or vulnerabilities
  - Checks run
  - Remaining risks or follow-up notes
- Security fixes and cross-cutting bug fixes must be documented clearly enough that later feature work can follow the new rule without needing prior chat context.
- When a durable coordination rule or implementation pattern emerges, use `memory-management` to store it when available.
- The project-local skill `.codex/skills/pixivdl-agent-collaboration` should be used for tasks where cross-agent coordination matters.

## Verification

- Run a syntax check after JavaScript changes:

```powershell
node --check extension\popup.js
```

- For end-to-end PID download validation, prefer an isolated Playwright/Chromium profile that loads `extension/` unpacked and mocks Pixiv endpoints:
  - `https://www.pixiv.net/ajax/illust/{pid}`
  - `https://www.pixiv.net/ajax/illust/{pid}/pages`
  - `https://i.pximg.net/**`
- Cover these flows when download behavior changes:
  - Single-image PID, file mode, one image downloaded.
  - Multi-image PID, select a subset, file mode downloads only selected pages.
  - Multi-image PID, ZIP mode, ZIP contains all selected entries.
  - Custom download subdirectory affects submitted `chrome.downloads.download` filenames.
  - Local proxy enable writes `fixed_servers`; disabling returns proxy mode away from `fixed_servers`.
- Do not rely on the user's real browser profile or Pixiv account for automated tests unless the user explicitly asks for live verification.

## Dist Artifacts

When a change should be reflected in the local loadable build, sync source into:

```text
dist\PixivDL-Browser-latest
dist\PixivDL-Browser-0.5.1
```

Then rebuild:

```powershell
Compress-Archive -Path dist\PixivDL-Browser-latest -DestinationPath dist\PixivDL-Browser-0.5.1.zip -Force
```

Before compressing, remove generated `_metadata/` directories from both source and dist folders if present.
- If older versioned dist folders are already loaded in the user's browser, sync them too when practical so a browser refresh picks up fixes without forcing a reinstall. Do not create new long-term recommended install paths for each patch.
- Keep only the current obvious release ZIP in `dist/` unless the user asks for multiple archived packages.

## Documentation

- Keep `README.md` and `extension/README.md` aligned with user-facing behavior. If `RELEASE_NOTES.md` is restored or used for a release, keep it aligned too.
- Mention browser-scoped proxy behavior clearly when documenting proxy settings.
- Mention that custom save paths are relative to the browser download directory, not arbitrary absolute filesystem paths.
