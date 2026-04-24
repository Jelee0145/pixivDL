---
name: pixivdl-agent-collaboration
description: Use when working in the PixivDL repository and coordination across multiple agents or chat windows matters. Enforces pre-task git review, shared update logging, hazard analysis before implementation, completion handoff notes, and optional memory-management storage for durable patterns.
---

# PixivDL Agent Collaboration

Use this skill for work in `D:\pixivdl` when the task may span multiple chat windows, roles, or iterations.

## Workflow

Before implementation:

1. Read `AGENTS.md`.
2. Read `docs/agent-collaboration.md`.
3. Read `docs/agent-update-log.md`.
4. Review recent git activity:
   - `git log --oneline -5`
   - `git diff --stat HEAD~1..HEAD`
5. If the task touches recently changed files, inspect the relevant diff in detail.

Then create or update an entry in `docs/agent-update-log.md` with:

- The task goal and scope
- Planned files
- Proposed implementation approach
- Risks, regressions, and hidden hazards
- Anything later agents need to know before continuing

After implementation, update the same entry with:

- What changed
- Which files changed
- Bugs or vulnerabilities fixed
- Checks run
- Remaining risks or follow-up work

## Required Thinking

Before implementing, explicitly consider:

- Security and permission risks
- Storage, cache, and proxy side effects
- Release/dist sync implications
- Documentation updates
- Cross-agent coordination notes

## Memory Storage

If the task creates a durable rule or reusable pattern, use `memory-management` after completion to store it.

Examples:

- Security rules that later feature work must respect
- Stable patterns for downloads, storage, or proxy behavior
- Coordination lessons worth reusing in later sessions
