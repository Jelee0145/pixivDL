# PixivDL Agent Collaboration Framework

This document defines the collaboration contract for agents working in this repository, especially when work is split across multiple chat windows or roles.

## Goals

- Keep all agents aligned on the latest repository state.
- Make security fixes, bug fixes, and architectural decisions visible to later agents.
- Reduce accidental regressions caused by stale context.

## Required Pre-Task Sync

Before implementation, every agent must:

1. Read `AGENTS.md`.
2. Read `docs/agent-update-log.md`.
3. Review recent git history:
   - `git log --oneline -5`
   - `git diff --stat HEAD~1..HEAD`
4. If the current task touches files changed recently, inspect the relevant diff before editing.

Do not start implementation until this sync is complete.

## Required Pre-Implementation Thinking

Before changing code, each agent must record a new entry in `docs/agent-update-log.md` with:

- Task goal
- Expected files or modules to touch
- Planned implementation approach
- Risks, hidden hazards, and likely regressions
- Information other agents should know before they continue

At minimum, consider:

- Security impact
- State/data migration impact
- UI/UX behavior regressions
- Download/proxy/storage side effects
- Dist sync or documentation follow-up

## Required Completion Update

After implementation, update the same log entry with:

- What was completed
- Files actually changed
- Fixed bugs or vulnerabilities
- Tests/checks run
- Remaining risks, follow-ups, or coordination notes

If a bug or vulnerability was fixed, state the old behavior, the new rule, and where the regression is now guarded.

## Shared Memory Guidance

When the task creates a reusable pattern, cross-agent constraint, or security lesson, use the `memory-management` skill if available to store the pattern after completion.

Good candidates:

- Security constraints that later feature work must respect
- Stable implementation patterns for downloads, storage, or proxy handling
- Repeated failure modes and their fixes

## Conflict Avoidance

- Read the most recent log entry before extending related work.
- If another agent has claimed a file or subsystem recently, adapt to that work rather than overwriting it.
- If the latest log reveals a changed invariant, treat it as authoritative until superseded by a newer entry.
