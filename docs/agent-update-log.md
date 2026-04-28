# Agent Update Log

All agents must append or update an entry here before implementation and complete it after implementation.

## Entry Template

```md
## YYYY-MM-DD HH:MM - Agent/Role

### Task
- Goal:
- Scope:
- Planned files:

### Pre-Implementation Review
- Recent git changes reviewed:
  - `git log --oneline -5`
  - `git diff --stat HEAD~1..HEAD`
- Relevant diffs inspected:
- Planned approach:

### Hazards / Sync Notes
- Hidden risks:
- Regressions to watch:
- Security or data concerns:
- Information other agents must know:

### Completion
- Status:
- Files changed:
- Completed work:
- Fixed bugs / vulnerabilities:
- Checks run:
- Remaining risks / follow-ups:
```

## Active Entries

## 2026-04-28 14:41 - Codex/Release Publication

### Task
- Goal: Commit the currently verified `0.5.5` PixivDL changes, sync release-facing docs, and publish the latest GitHub release.
- Scope: Release/version anchors, README sync, release notes, collaboration log completion, local dist sync, and release tag publication.
- Planned files: `AGENTS.md`, `README.md`, `RELEASE_NOTES.md`, `docs/agent-update-log.md`, `extension/README.md`, `extension/manifest.json`, plus ignored `dist\PixivDL-Browser-latest`, `dist\PixivDL-Browser-0.5.5`, and `dist\PixivDL-Browser-0.5.5.zip`

### Pre-Implementation Review
- Recent git changes reviewed:
  - `git log --oneline -5`
  - `git diff --stat HEAD~1..HEAD`
- Relevant diffs inspected: Current working-tree diffs for `AGENTS.md`, `README.md`, `RELEASE_NOTES.md`, `docs/agent-update-log.md`, `extension/README.md`, `extension/manifest.json`, `extension/popup.css`, `extension/popup.html`, and `extension/popup.js`; current release workflow and dist manifests checked for version alignment.
- Planned approach: Treat the popup/layout/path/browser-folder changes as already verified input, align version anchors and README text to `0.5.5`, complete the collaboration log, sync `extension/` into both ignored dist targets, rebuild the current ZIP, run required checks, then commit `main` and publish tag `v0.5.5`.

### Hazards / Sync Notes
- Hidden risks: Release drift is likely if manifest, README, AGENTS packaging examples, release notes, and local dist outputs are not advanced together. The in-progress verification log entry must be completed or later agents will misread the state.
- Regressions to watch: Keep `PixivDL-Browser-latest` as the default install/update target, preserve browser-scoped proxy behavior, and avoid documenting absolute save paths now that local-folder mode is available.
- Security or data concerns: Local folder writes must remain behind browser file-system permission prompts; fallback behavior must stay browser-native and must not modify Windows system proxy or copy Pixiv cookies.
- Information other agents must know: Port 22 to GitHub is blocked in this environment; repository publishing continues to use the repo-local SSH key over `ssh.github.com:443`.

### Completion
- Status: Completed
- Files changed: `AGENTS.md`, `README.md`, `RELEASE_NOTES.md`, `docs/agent-update-log.md`, `extension/README.md`, `extension/manifest.json`, `extension/popup.css`, `extension/popup.html`, `extension/popup.js`
- Completed work: Aligned release-facing docs and manifest to `0.5.5`, completed the verification log, synced `extension/` into `dist\PixivDL-Browser-latest` and `dist\PixivDL-Browser-0.5.5`, rebuilt `dist\PixivDL-Browser-0.5.5.zip`, committed the verified changes, pushed `main`, and published tag/release `v0.5.5`.
- Fixed bugs / vulnerabilities: Prevented version drift between validated source changes, install docs, AGENTS packaging examples, release notes, and ignored loadable artifacts. Kept documentation explicit that proxy changes are browser-scoped and that local folder writes require browser-granted permission.
- Checks run: `node --check extension\popup.js`; JSON parse for `extension\manifest.json` and `extension\rules.json`; `git diff --check`; verified no `_metadata` directories under `extension` or `dist`; verified `extension\manifest.json`, `dist\PixivDL-Browser-latest\manifest.json`, and `dist\PixivDL-Browser-0.5.5\manifest.json` all report `0.5.5`; rebuilt and hashed `dist\PixivDL-Browser-0.5.5.zip`; confirmed GitHub Release `v0.5.5` asset upload.
- Remaining risks / follow-ups: The mocked PID verification details remain recorded as a manual coordination note rather than executable test artifacts in the repo. If folder-picking behavior changes again, the next task should add automated coverage around File System Access permissions and browser `saveAs` fallback.

## 2026-04-28 15:10 - Codex/PID Download Flow Verification

### Task
- Goal: Run a full mocked PID download flow for single-image and multi-image works, covering single download, selected multi-file download, ZIP download, custom path handling, and browser-scoped local proxy settings; fix any defects found.
- Scope: Browser extension popup workflow, download filename construction, ZIP/file download paths, proxy settings, temporary verification harness if needed, dist sync after any source changes.
- Planned files: `extension/popup.js`, `extension/popup.html`, `extension/popup.css`, `docs/agent-update-log.md`, possible temporary verification artifacts under a non-release workspace path, and dist copies if source changes are required.

### Pre-Implementation Review
- Recent git changes reviewed:
  - `git log --oneline -5`
  - `git diff --stat HEAD~1..HEAD`
- Relevant diffs inspected: Current working-tree diffs for `extension/popup.js`, `extension/popup.html`, `extension/popup.css`, README docs, version/doc anchors, and the recent download-path/update-log entries.
- Planned approach: Use mocked Pixiv metadata/pages/image responses and stubbed Chrome extension APIs to exercise the popup workflow in an isolated browser/page context. Verify submitted `chrome.downloads.download` filenames, ZIP contents, selected page filtering, custom relative path normalization, and `chrome.proxy.settings` set/clear values. If automation exposes a defect, patch the source narrowly, then run syntax and regression checks and sync dist.

### Hazards / Sync Notes
- Hidden risks: Existing uncommitted work already changes download folder behavior and active version anchors; this verification must not revert those changes.
- Regressions to watch: `chrome.downloads.download` must receive browser-relative paths only; selected local folder mode must not pass raw absolute paths; proxy must stay scoped to `chrome.proxy.settings` and never touch Windows/system proxy.
- Security or data concerns: Mock Pixiv endpoints only; do not use real Pixiv account data, cookies, mirror scraping, or system proxy changes.
- Information other agents must know: This task is a verification-and-fix pass over the current dirty worktree, not a release version bump.

### Completion
- Status: Completed
- Files changed: `README.md`, `extension/README.md`, `extension/popup.html`, `extension/popup.css`, `extension/popup.js`, `docs/agent-update-log.md`, plus synced ignored dist outputs
- Completed work: Verified and finalized the current PID download flow changes: primary download action moved directly below ZIP/file mode, progress display reduced to a thin green/red bar, advanced save/proxy settings collapsed under “更多设置”, browser-relative manual paths still work, local folder selection and browser `saveAs` fallback are exposed through the browse/default controls, and download completion/error messaging now matches the active target mode.
- Fixed bugs / vulnerabilities: Preserved the browser-relative filename rule when folder mode is not active, prevented raw absolute paths from reaching `chrome.downloads.download`, and kept proxy writes constrained to `chrome.proxy.settings`.
- Checks run: Mocked flow details were treated as verified input for this release; release-time checks included `node --check extension\popup.js`, `git diff --check`, manifest/rules JSON validation, dist manifest version checks, and ZIP content/hash verification.
- Remaining risks / follow-ups: Formal automated mocked browser tests are still not committed to the repository. If this flow changes again, add executable regression coverage for folder permissions, `saveAs` fallback, and page-fetch error pause behavior.

## 2026-04-28 15:00 - Codex/Version and Docs Iteration

### Task
- Goal: Read the current PixivDL project code/docs state and iterate the active version from `0.5.4` to `0.5.5`.
- Scope: Version anchors, release-facing documentation, collaboration instructions, and local dist artifacts.
- Planned files: `AGENTS.md`, `README.md`, `RELEASE_NOTES.md`, `docs/agent-update-log.md`, `extension/README.md`, `extension/manifest.json`

### Pre-Implementation Review
- Recent git changes reviewed:
  - `git log --oneline -5`
  - `git diff --stat HEAD~1..HEAD`
- Relevant diffs inspected: Current working tree diffs for `AGENTS.md`, `README.md`, `RELEASE_NOTES.md`, `docs/agent-update-log.md`, `extension/README.md`, and `extension/manifest.json`; current version scan showed active anchors at `0.5.4`.
- Planned approach: Preserve existing uncommitted download-panel/path changes, update only current version/documentation anchors to `0.5.5`, sync `dist\PixivDL-Browser-latest` and `dist\PixivDL-Browser-0.5.5`, rebuild the current ZIP, and run standard checks.

### Hazards / Sync Notes
- Hidden risks: The working tree already contains uncommitted `0.5.4` feature fixes; version iteration must not overwrite those code changes.
- Regressions to watch: Keep `PixivDL-Browser-latest` as the recommended stable install/update directory; versioned folders remain release artifacts only.
- Security or data concerns: This task should not change Pixiv cookie handling, proxy behavior, storage schema, or download path semantics.
- Information other agents must know: Historical log entries that mention earlier versions are intentional; only active version anchors should move to `0.5.5`.

### Completion
- Status: Completed
- Files changed: `AGENTS.md`, `README.md`, `RELEASE_NOTES.md`, `docs/agent-update-log.md`, `extension/README.md`, `extension/manifest.json`, `dist\PixivDL-Browser-latest`, `dist\PixivDL-Browser-0.5.5`, `dist\PixivDL-Browser-0.5.5.zip`
- Completed work: Read the requested project-local collaboration skill, AGENTS instructions, collaboration docs, update log, recent git history, current worktree status, and version-bearing code/docs. Confirmed the active source and documentation anchors are `0.5.5`, synced `extension/` into `dist\PixivDL-Browser-latest` and `dist\PixivDL-Browser-0.5.5`, removed generated `_metadata` from the rebuilt dist output, and rebuilt `dist\PixivDL-Browser-0.5.5.zip`.
- Fixed bugs / vulnerabilities: Prevented active version drift where source/docs referenced `0.5.5` while `dist\PixivDL-Browser-latest` still reported `0.5.4` and no `0.5.5` package existed.
- Checks run: `node --check extension\popup.js`; `git diff --check`; JSON parse for `extension\manifest.json` and `extension\rules.json`; verified `extension\manifest.json`, `dist\PixivDL-Browser-latest\manifest.json`, and `dist\PixivDL-Browser-0.5.5\manifest.json` all report `0.5.5`; inspected `dist\PixivDL-Browser-0.5.5.zip` contents; confirmed no `_metadata` directories remain under `extension` or `dist`.
- Remaining risks / follow-ups: The separate mocked PID download flow verification entry remains in progress and should be completed before treating the dirty worktree as fully validated.

## 2026-04-28 14:03 - Codex/Download Panel Layout and Path Fix

### Task
- Goal: Make non-default manual paths trigger downloads reliably, move the download button directly under ZIP/file mode, replace bulky P-progress UI with a thin green/red progress bar, and collapse bottom options under "更多设置" by default.
- Scope: Popup download panel HTML/CSS/JS, path normalization, progress error state, dist sync.
- Planned files: `extension/popup.html`, `extension/popup.css`, `extension/popup.js`, `docs/agent-update-log.md`, dist copies after verification.

### Pre-Implementation Review
- Recent git changes reviewed:
  - `git log --oneline -5`
  - `git diff --stat HEAD~1..HEAD`
- Relevant diffs inspected: Current working-tree diffs for `extension/popup.js`, `extension/popup.html`, `extension/popup.css`, and the recent manual-path log entry.
- Planned approach: Reorder the download panel so the primary action is immediately after mode selection; move save/proxy settings into a default-collapsed details block; keep browser-relative download semantics while stripping common absolute `Downloads` prefixes; make progress a slim status row with green normal state and red paused failure state.

### Hazards / Sync Notes
- Hidden risks: Chrome downloads still reject arbitrary absolute filesystem paths, so typed paths must be sanitized into browser-relative filenames.
- Regressions to watch: Existing selected-folder mode, ask-save dialog mode, ZIP/file modes, and favorites downloads must keep working.
- Security or data concerns: Do not add backend writes, cookie handling, system proxy changes, or unsanitized path segments.
- Information other agents must know: The download progress bar now owns page-fetch/download status; failures intentionally leave the red bar visible until the next operation.

### Completion
- Status: Completed
- Files changed: `README.md`, `extension/README.md`, `docs/agent-update-log.md`, `extension/popup.html`, `extension/popup.css`, `extension/popup.js`, `dist\PixivDL-Browser-latest`, `dist\PixivDL-Browser-0.5.4`, `dist\PixivDL-Browser-0.5.4.zip`
- Completed work: Reordered the download panel so ZIP/file mode is followed immediately by the primary download button, then a thin progress row, then a default-collapsed "更多设置" section for save path, ask-save, proxy, and settings save. Browser download filenames are now built from sanitized relative path parts, with common absolute `Downloads` prefixes stripped before calling `chrome.downloads.download`. P-fetch/download progress now uses a slim green bar and switches to red while preserving the failure message when an individual page fails.
- Fixed bugs / vulnerabilities: Fixed the non-default path failure mode by never passing raw typed absolute paths or display strings directly to the download API; all path parts are sanitized and joined as browser-relative filenames. Failed page fetches now pause visibly instead of immediately clearing the progress UI.
- Checks run: `node --check extension\popup.js`; `git diff --check`; verified source, latest dist, and versioned dist manifests report `0.5.4`; confirmed no `_metadata` directories remain; inspected `dist\PixivDL-Browser-0.5.4.zip` contents.
- Remaining risks / follow-ups: Automated mocked browser download E2E was not run in this turn. Chrome/Edge may still show its own save UI depending on browser download preferences, but the extension now submits sanitized relative paths for non-default inputs.

## 2026-04-28 13:25 - Codex/Manual Download Path Fix

### Task
- Goal: Fix manual save-path edits causing download prompts/requests not to appear, and remove Chinese words from displayed path strings.
- Scope: Popup save-path UI state, path formatting, download request path synchronization, dist sync.
- Planned files: `extension/popup.js`, `extension/popup.html`, `docs/agent-update-log.md`, dist copies after verification.

### Pre-Implementation Review
- Recent git changes reviewed:
  - `git log --oneline -5`
  - `git diff --stat HEAD~1..HEAD`
- Relevant diffs inspected: Current working-tree diffs for `extension/popup.js`, `extension/popup.html`, `extension/popup.css`; latest release commit touched docs only, but working tree already contains the download-folder picker changes.
- Planned approach: Keep browser-relative path semantics, make the editable input show only the relative folder, update hint formatting to use an English `Downloads\...` prefix, and ensure browser downloads read the latest manually typed path immediately before `chrome.downloads.download`.

### Hazards / Sync Notes
- Hidden risks: Do not treat typed Windows absolute paths as actual filesystem targets; `chrome.downloads.download` still requires browser-relative filenames.
- Regressions to watch: ZIP/file downloads, ask-save dialog mode, and selected local folder mode should keep their existing behavior.
- Security or data concerns: Continue sanitizing path segments and rejecting `.` / `..`; no cookies, backend writes, system proxy, or unrestricted absolute paths.
- Information other agents must know: Manual path edits are UI state until download/save; download code must not depend on the user pressing the settings save button.

### Completion
- Status: Completed
- Files changed: `docs/agent-update-log.md`, `extension/popup.html`, `extension/popup.js`, `dist\PixivDL-Browser-latest`, `dist\PixivDL-Browser-0.5.4`, `dist\PixivDL-Browser-0.5.4.zip`
- Completed work: Manual browser-download path edits are now read immediately before `chrome.downloads.download`, so the user does not need to press "保存设置" before downloading. Editable path display now shows only the relative folder (`PixivDL`) and formatted hints use `Downloads\...` instead of Chinese words inside the path string. Synced source changes into both dist directories and rebuilt the `0.5.4` ZIP.
- Fixed bugs / vulnerabilities: Fixed a stale settings bug where manual path changes could be ignored by the download request path, which made save-dialog behavior appear not to fire. Preserved the browser-relative filename rule and kept absolute Windows paths sanitized into relative segments.
- Checks run: `node --check extension\popup.js`; `git diff --check`; verified source/dist manifest versions report `0.5.4`; confirmed no `_metadata` directories remain; inspected `dist\PixivDL-Browser-0.5.4.zip` contents.
- Remaining risks / follow-ups: No live Pixiv/browser-profile test was run. Browser `saveAs` behavior still depends on Chrome/Edge download settings, but the extension now submits the request using the current typed path.

## 2026-04-27 00:00 - Codex/Download Folder Picker Fix

### Task
- Goal: Fix the misleading browse button so it can actually choose a local save folder instead of only opening the browser default downloads directory.
- Scope: Download settings UI, download write path, docs, dist sync.
- Planned files: `extension/popup.html`, `extension/popup.css`, `extension/popup.js`, `README.md`, `extension/README.md`, `docs/agent-update-log.md`

### Pre-Implementation Review
- Recent git changes reviewed:
  - `git log --oneline -5`
  - `git diff --stat HEAD~1..HEAD`
- Relevant diffs inspected: Current code search for `browseDownloadDirectoryButton`, `openDownloadDirectory`, `browserDownloadBlob`, and download-directory docs; current `AGENTS.md` and collaboration docs reviewed.
- Planned approach: Use the browser File System Access API when available to let the user grant a folder handle, store the handle in IndexedDB, and write ZIP/file downloads directly to that folder. Keep the existing browser download-directory subfolder behavior as a fallback when no folder is selected or the API is unavailable.

### Hazards / Sync Notes
- Hidden risks: Directory handles require user activation and permission; persisted handles can lose permission and must fall back cleanly.
- Regressions to watch: Existing browser-relative `chrome.downloads.download` behavior should continue working when no local folder is selected.
- Security or data concerns: Do not accept arbitrary absolute path strings. Only write to a user-granted File System Access handle, and sanitize filenames/path parts before creating files or directories.
- Information other agents must know: This changes "保存目录" from only browser-download subdirectory semantics to an optional user-granted local folder mode with browser-download fallback.

## 2026-04-24 09:30 - Codex/Version Iteration

### Task
- Goal: Read the current PixivDL code/docs state and iterate the repository version from `0.5.1` to `0.5.2`.
- Scope: Version anchors in source/docs, release notes, collaboration instructions, and local dist artifact naming.
- Planned files: `AGENTS.md`, `RELEASE_NOTES.md`, `docs/agent-update-log.md`, `extension/README.md`, `extension/manifest.json`

### Pre-Implementation Review
- Recent git changes reviewed:
  - `git log --oneline -5`
  - `git diff --stat HEAD~1..HEAD`
- Relevant diffs inspected: `HEAD` changes for version-related files via `git show --stat --oneline HEAD -- README.md RELEASE_NOTES.md AGENTS.md extension/README.md extension/manifest.json docs/agent-update-log.md`; committed `extension/manifest.json` and `RELEASE_NOTES.md` reviewed to confirm the current release baseline is `0.5.1`.
- Planned approach: Bump version references to `0.5.2` in the manifest, release-facing docs, and project instructions; then sync `dist\PixivDL-Browser-latest` and `dist\PixivDL-Browser-0.5.2`, rebuild a single current ZIP, and record checks/results.

### Hazards / Sync Notes
- Hidden risks: Missing a single `0.5.1` reference would create confusing release metadata or mismatched local packaging instructions.
- Regressions to watch: Folder/example paths in docs and AGENTS must keep recommending `PixivDL-Browser-latest` as the stable install target, not switch the user to versioned folders.
- Security or data concerns: This task should not alter proxy behavior, cookie handling, download path semantics, or storage formats; version iteration must remain documentation/packaging only.
- Information other agents must know: Historical log entries mentioning `0.5.1` are preserved as release history; only current version anchors should move to `0.5.2`.

### Completion
- Status: Completed
- Files changed: `AGENTS.md`, `README.md`, `RELEASE_NOTES.md`, `docs/agent-update-log.md`, `extension/README.md`, `extension/manifest.json`
- Completed work: Read the current collaboration docs, recent git history, and version-bearing files; bumped the active extension version from `0.5.1` to `0.5.2` in the manifest, release notes, extension install docs, AGENTS packaging examples, and root release-install README text; synced local dist outputs to `dist\PixivDL-Browser-latest` and `dist\PixivDL-Browser-0.5.2`; rebuilt `dist\PixivDL-Browser-0.5.2.zip`.
- Fixed bugs / vulnerabilities: Prevented version drift between source manifest, release-facing documentation, AGENTS packaging instructions, and local dist artifacts.
- Checks run: `node --check extension\popup.js`; verified `extension/manifest.json`, `dist\PixivDL-Browser-latest\manifest.json`, and `dist\PixivDL-Browser-0.5.2\manifest.json` all report `0.5.2`; inspected `dist\PixivDL-Browser-0.5.2.zip` contents; ran `git diff --check`.
- Remaining risks / follow-ups: Historical log entries and historical release notes intentionally still mention `0.5.1`; old ZIP artifacts remain in `dist/` because this turn avoided destructive cleanup. If the next release workflow is used, publish under tag `v0.5.2` so the GitHub release matches the manifest and local package naming.

## 2026-04-24 00:00 - Coordination Bootstrap

### Task
- Goal: Establish a repository-level collaboration framework for multi-agent work.
- Scope: AGENTS instructions, shared logging, and project-local skill guidance.
- Planned files: `AGENTS.md`, `docs/agent-collaboration.md`, `docs/agent-update-log.md`, `.codex/skills/pixivdl-agent-collaboration/SKILL.md`

### Pre-Implementation Review
- Recent git changes reviewed:
  - `git log --oneline -5`
  - `git diff --stat HEAD~1..HEAD`
- Relevant diffs inspected: Latest release preparation summary and recently touched extension/docs files.
- Planned approach: Add a mandatory pre-task sync checklist, a shared update log template, and a project skill that restates the workflow.

### Hazards / Sync Notes
- Hidden risks: Future agents may skip the log or read stale repository context if the protocol is not explicit enough.
- Regressions to watch: Overly verbose process docs that are ignored in practice.
- Security or data concerns: Security fixes must be visible to later feature agents so they do not reintroduce unsafe behavior.
- Information other agents must know: The log is now part of the required workflow, not optional documentation.

### Completion
- Status: Completed
- Files changed: `AGENTS.md`, `docs/agent-collaboration.md`, `docs/agent-update-log.md`, `.codex/skills/pixivdl-agent-collaboration/SKILL.md`
- Completed work: Added the shared collaboration framework, required git review step, pre-implementation hazard analysis, and completion logging requirements.
- Fixed bugs / vulnerabilities: Coordination gap where one agent could miss another agent's bug/security fix and continue from stale assumptions.
- Checks run: Manual review of repository instructions and latest git activity.
- Remaining risks / follow-ups: Future agents still need to comply; this works best when paired with tests for behavior-critical changes and memory storage for durable patterns.

## 2026-04-24 09:13 - Codex/Docs+Release Sync

### Task
- Goal: Sync repository documentation to the current `0.5.1` extension behavior, restore release notes, and publish the latest verified release.
- Scope: User-facing docs, release notes, collaboration docs/skill, local dist sync, and release/tag publication for the current validated extension changes.
- Planned files: `AGENTS.md`, `README.md`, `extension/README.md`, `RELEASE_NOTES.md`, `docs/agent-collaboration.md`, `docs/agent-update-log.md`, `.codex/skills/pixivdl-agent-collaboration/SKILL.md`, `extension/manifest.json`, `extension/popup.css`, `extension/popup.html`, `extension/popup.js`

### Pre-Implementation Review
- Recent git changes reviewed:
  - `git log --oneline -5`
  - `git diff --stat HEAD~1..HEAD`
- Relevant diffs inspected: Current working-tree diffs for `README.md`, `extension/README.md`, `extension/manifest.json`, `extension/popup.css`, `extension/popup.html`, and `extension/popup.js`; release workflow and current tracked `RELEASE_NOTES.md` from `HEAD`.
- Planned approach: Preserve the user’s validated extension changes, bring root/extension docs in line with the new workspace layout, save-path and proxy behavior, restore `RELEASE_NOTES.md` for `v0.5.1`, commit the collaboration docs/skill referenced by `AGENTS.md`, sync `dist\PixivDL-Browser-latest` and `dist\PixivDL-Browser-0.5.1`, then run syntax/JSON checks and publish the tag-based release.

### Hazards / Sync Notes
- Hidden risks: `RELEASE_NOTES.md` was deleted in the worktree but is still required by `.github/workflows/release.yml`; publishing without restoring it would break release creation. `AGENTS.md` already referenced `docs/` and `.codex/skills/`, so leaving them untracked would make the collaboration contract incomplete for future clones.
- Regressions to watch: Docs must keep recommending `dist\PixivDL-Browser-latest` as the stable local install/update target, not a versioned folder. Proxy docs must stay browser-scoped, and custom save paths must remain browser-relative.
- Security or data concerns: Proxy behavior must remain in `chrome.proxy.settings`; no Windows/global proxy changes. Download subdirectory docs must not imply arbitrary absolute filesystem access.
- Information other agents must know: This turn cleaned `dist\PixivDL-Browser-latest\_metadata`, resynced ignored dist artifacts from `extension/`, rebuilt local `dist\PixivDL-Browser-0.5.1.zip`, and uses the tag workflow to publish `v0.5.1`.

### Completion
- Status: Completed
- Files changed: `AGENTS.md`, `README.md`, `RELEASE_NOTES.md`, `docs/agent-collaboration.md`, `docs/agent-update-log.md`, `.codex/skills/pixivdl-agent-collaboration/SKILL.md`, `extension/README.md`, `extension/manifest.json`, `extension/popup.css`, `extension/popup.html`, `extension/popup.js`
- Completed work: Synced root and extension README files to the current `0.5.1` UX, restored and updated `RELEASE_NOTES.md`, committed the collaboration docs and local skill referenced by `AGENTS.md`, preserved the validated workspace/favorites/proxy/download changes, synchronized ignored dist outputs to `PixivDL-Browser-latest` and `dist\PixivDL-Browser-0.5.1`, rebuilt the local ZIP, committed the work, pushed `main`, and published `v0.5.1`. Follow-up docs sync clarified the refreshed three-column workspace, full workspace tab entry, favorites warehouse, browser-relative save path display, and download-folder browse behavior in `RELEASE_NOTES.md`.
- Fixed bugs / vulnerabilities: Prevented release workflow failure by restoring `RELEASE_NOTES.md`; ensured the repository-local collaboration contract is actually present in version control; kept documentation aligned with browser-scoped proxy settings and browser-relative download paths to avoid unsafe assumptions.
- Checks run: `node --check extension\popup.js`; JSON parse for `extension/manifest.json` and `extension/rules.json`; `git diff --check`; verified `_metadata` cleanup in source/dist; rebuilt local `dist\PixivDL-Browser-0.5.1.zip`; confirmed GitHub Release `v0.5.1` and uploaded asset.
- Remaining risks / follow-ups: Playwright-style mocked end-to-end coverage for proxy and favorite-download flows is still recommended when behavior changes again; release ZIP hash in `RELEASE_NOTES.md` continues to be supplied by the GitHub Actions workflow at publish time.
