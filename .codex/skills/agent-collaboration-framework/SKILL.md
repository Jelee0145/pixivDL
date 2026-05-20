---
name: agent-collaboration-framework
description: Use in development repositories when coordination across multiple agents or chat windows matters. Enforces pre-task git review, shared update logging, hazard analysis before implementation, completion handoff notes, and optional memory-management storage for durable patterns.
---

# Agent Collaboration Framework

Use this skill when work may span multiple chat windows, roles, or iterations.

## Workflow

Before implementation:

1. Read the repository's agent instructions, usually `AGENTS.md`.
2. Read `docs/agent-collaboration.md` if present.
3. Read `docs/agent-update-log.md` if present.
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
- State, cache, storage, and data migration side effects
- Build, release, and artifact sync implications
- Documentation updates
- Cross-agent coordination notes

## Memory Storage

If the task creates a durable rule or reusable pattern, use `memory-management` after completion to store it.

Examples:

- Security rules that later feature work must respect
- Stable implementation patterns for repository-specific workflows
- Coordination lessons worth reusing in later sessions
