# TDD Pipeline Issues History

> **Purpose**: Persistent log of every TDD pipeline issue encountered, its root cause, and the solution applied. This file is the agent's institutional memory -- read it BEFORE investigating any new problem.
>
> **Maintained by**: `tdd-pipeline-maintainer` agent
>
> **Format**: Entries are ordered newest-first. Each entry uses a consistent structure for searchability.

---

## How to Use This File

**Before fixing a new issue**: Search this file for keywords from the error message, affected workflow file, or symptom description. Look for:

- Identical errors (same root cause, reuse the solution)
- Similar patterns (related root cause, adapt the solution)
- Recurring themes (systemic issue, consider a deeper architectural fix)

**After fixing an issue**: Add a new entry at the top of the "Issue Log" section below, following the template.

---

## Entry Template

Copy this template when adding a new entry:

```markdown
### ISSUE-YYYY-MM-DD-<short-slug>

| Field                    | Value                                     |
| ------------------------ | ----------------------------------------- |
| **Date**                 | YYYY-MM-DD                                |
| **Severity**             | critical / high / medium / low            |
| **Affected Workflow(s)** | e.g., `claude-code.yml`, `pr-creator.yml` |
| **Error Symptoms**       | Brief description of what was observed    |

**Error Message / Log Excerpt**:
\`\`\`
Paste relevant error output here
\`\`\`

**Root Cause Analysis**:
Explanation of why the error occurred.

**Solution Applied**:
What was changed to fix the issue.

**Files Modified**:

- `path/to/file1`
- `path/to/file2`

**Lessons Learned**:

- Key takeaway 1
- Key takeaway 2

**Related Issues**: #link-to-github-issue (if applicable)
```

---

## Tags Reference

Use these tags in error symptoms or root cause to improve searchability:

| Tag             | Meaning                             |
| --------------- | ----------------------------------- |
| `[SDK]`         | Claude Code Action SDK issue        |
| `[VERSION-PIN]` | Version pinning related             |
| `[YAML]`        | Workflow YAML syntax or logic       |
| `[COST]`        | Cost protection or budget issue     |
| `[STATE]`       | Label/PR state management issue     |
| `[RETRY]`       | Retry logic or attempt counting     |
| `[MODEL]`       | Model escalation or compatibility   |
| `[MERGE]`       | Merge conflict or auto-merge issue  |
| `[SCRIPT]`      | TypeScript script bug               |
| `[INFRA]`       | GitHub Actions infrastructure issue |

---

## Issue Log

<!-- New entries go here, newest first -->

### ISSUE-2026-02-11-duplicate-claude-comment-race

| Field                    | Value                                                                                                                                                                       |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Date**                 | 2026-02-11                                                                                                                                                                  |
| **Severity**             | high                                                                                                                                                                        |
| **Affected Workflow(s)** | `test.yml`                                                                                                                                                                  |
| **Error Symptoms**       | `[STATE]` `[RETRY]` — Two concurrent `test.yml` runs both post `@claude` comments on the same TDD PR, causing duplicate Claude Code workflow triggers for the same attempt. |

**Error Message / Log Excerpt**:

```
PR #7225: Two @claude e2e-test-fixer comments posted within seconds of each other,
both for the same attempt number. Both triggered separate claude-code.yml runs.
```

**Root Cause Analysis**:

The `tdd-handle-failure` job in `test.yml` had 3 sequential steps with a timing gap between them:

1. `check-last-run` (staleness check) - ~10 seconds
2. `check-claude-code` (Claude Code workflow running check) - ~5 seconds
3. `Trigger Claude Code on failure` (posts the `@claude` comment)

Between step 1 and step 3, another concurrent `test.yml` run (triggered by the same push or a rapid succession of pushes) could also pass the same checks and post its own `@claude` comment. The `concurrency` config in `test.yml` uses `cancel-in-progress: true` for PRs, but this only cancels when a **new** run starts -- if two runs start nearly simultaneously (e.g., from the same `synchronize` event), both can proceed through the check steps before either posts.

The `claude-code.yml` concurrency group (`claude-code-{PR#}`) prevents parallel execution, but it does not prevent duplicate comments from being posted. The second comment would queue a second Claude Code run that starts after the first completes, wasting credits and creating confusing state.

**Solution Applied**:

Merged the 3 separate steps into a **single atomic step** with 4 internal phases:

1. **Staleness check** (via existing TypeScript program)
2. **Claude Code workflow running check** (via `gh run list`)
3. **Attempt-specific comment deduplication** (new): queries PR comments to check if a `@claude` comment with the same `Attempt: N/M` string already exists for this attempt number
4. **Comment posting** (if all checks pass)

By combining all checks and the post into one step, the race window is reduced from minutes (time between separate steps) to milliseconds (time between the deduplication query and the `gh pr comment` call).

The skip notification logic was also merged into the same step, eliminating the orphaned notification steps.

**Files Modified**:

- `.github/workflows/test.yml` — Merged 5 steps (check-last-run, 2 skip notifications, check-claude-code, trigger comment) into single "Check conditions and trigger Claude Code" step
- `docs/development/tdd-automation-pipeline.md` — Added 7th race condition protection layer documenting the atomic check-and-post pattern

**Lessons Learned**:

- **Sequential workflow steps with timing gaps create race windows.** When two concurrent runs execute the same job, each step acts as a separate "gate" — but the gates are not atomic with the final action. Merging check + action into a single step minimizes the race window.
- **Attempt-specific deduplication is safer than generic `@claude` matching.** Using generic matching (e.g., "any `@claude` comment exists") would block legitimate retries for different attempt numbers. The deduplication must match the specific `Attempt: N/M` string.
- **The `claude-code.yml` concurrency group is still the safety net.** Even if a duplicate comment slips through, the concurrency group ensures only one Claude Code workflow runs at a time per PR. The deduplication prevents wasteful queuing, not parallel execution.
- **GitHub Actions `cancel-in-progress` does not prevent near-simultaneous runs.** Two runs triggered within the same second can both start executing before the cancellation mechanism detects the duplicate.

**Related Issues**: PR #7225

---

### ISSUE-2026-02-11-ajv-mode-execute-crash

| Field                    | Value                                                                                                                                                                                                      |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Date**                 | 2026-02-11                                                                                                                                                                                                 |
| **Severity**             | critical                                                                                                                                                                                                   |
| **Affected Workflow(s)** | `claude-code.yml`                                                                                                                                                                                          |
| **Error Symptoms**       | `[SDK]` `[VERSION-PIN]` `[YAML]` — TDD automation completely halted. Claude Code Action crashes with cryptic AJV validation error on every run. Multiple version pin attempts failed to resolve the issue. |

**Error Message / Log Excerpt**:

```
SDK execution error: 14 | depsCount: ${Q},
   |                         ^
  error: Unexpected end of input
      at (native):14:24
```

This is a minified AJV (JSON schema validator) error from the Claude Code Action SDK. The cryptic output is due to compiled/minified code in `sdk.mjs`.

**Timeline of Events**:

1. **Feb 10 ~19:12 UTC** — Claude Code Action worked fine using `@v1` tag (which pointed to v1.0.47, SDK 0.2.38).
2. **Feb 10 ~23:12 UTC** — Anthropic pushed v1.0.48 (SDK 0.2.39) to the `@v1` tag, introducing the AJV validation crash.
3. **Feb 11 — First pin attempt (FAILED)** — Pinned to SHA `75f52e56b2a277d60f7b9b382d6564c28fc6420f` (SDK 0.2.9). Crashed with "exit code 1" — this SDK version was too old for the current runtime.
4. **Feb 11 — Second pin attempt (FAILED)** — Re-pinned to SHA `b433f16b30d54063fd3bab6b12f46f3da00e41b6` (v1.0.47, SDK 0.2.38) and restored Opus 4.6 model. Still crashed with the same AJV error.
5. **Feb 11 — Root cause discovered** — Compared config against official docs at `https://code.claude.com/docs/en/github-actions`. Found that `--mode execute` was being passed via `claude_args`, but `mode` was REMOVED in GA v1.0 (auto-detected from context). The SDK's AJV schema validator rejects it as an unknown field.
6. **Feb 11 — Fix applied** — Removed `--mode execute` from `CLAUDE_ARGS` in `claude-code.yml`.

**Root Cause Analysis**:

The crash had **two contributing factors** that made diagnosis difficult:

1. **Anthropic's GA v1.0 release removed the `--mode` flag**: When Claude Code Action went GA, the `mode` parameter was removed from the accepted schema. Mode is now auto-detected (execute mode when `direct_prompt` is provided, interactive mode otherwise). The SDK's AJV schema validator enforces this and rejects unknown fields.

2. **The timing coincidence with v1.0.48**: The crash appeared to be caused by the SDK update from v1.0.47 to v1.0.48, which led us down the version-pinning path. However, v1.0.47 had the same AJV schema — the `--mode` flag was already invalid. The reason it worked before was likely due to a less strict validation path or a race condition in how args were parsed.

The key insight was that **pinning the version could never fix this** because the root cause was in our workflow configuration (`--mode execute` in `CLAUDE_ARGS`), not in the SDK version.

**Solution Applied**:

Removed `--mode execute` from the `CLAUDE_ARGS` environment variable in `claude-code.yml`. The mode is now auto-detected by the action: it uses execute mode because `direct_prompt` is provided.

Before:

```yaml
CLAUDE_ARGS: '--mode execute --verbose'
```

After:

```yaml
CLAUDE_ARGS: '--verbose'
```

**Files Modified**:

- `.github/workflows/claude-code.yml` — Removed `--mode execute` from CLAUDE_ARGS (line 486), updated comments
- `docs/development/tdd-sdk-version-management.md` — (removed; lessons captured in this issue entry)
- `docs/development/tdd-automation-pipeline.md` — Updated version pin note from SDK 0.2.9 to v1.0.47

**Lessons Learned**:

- **Always compare workflow config against official documentation when SDK validation errors occur.** AJV schema errors mean "your input doesn't match the expected schema" — the fix is often in the input, not the validator.
- **Timing coincidences are dangerous.** The crash appeared right after v1.0.48 was pushed, creating a false correlation. The real cause (invalid `--mode` flag) was pre-existing but only enforced by stricter validation.
- **Version pinning is not a universal fix.** When the root cause is in your configuration, no amount of version pinning will help. Pin versions to avoid SDK bugs, not to avoid fixing your own config.
- **GA releases can silently remove flags.** When a tool transitions from beta to GA, review ALL flags and parameters against the new documentation. Removed flags may trigger validation errors rather than being silently ignored.
- **Minified AJV errors are near-impossible to read.** The error `depsCount: ${Q}` gives no indication that the issue is an unknown `--mode` field. When you see AJV errors, systematically compare your full config against the schema rather than trying to decode the minified output.

**Affected Runs**:

- Failing: [Run 21902037318](https://github.com/sovrium/sovrium/actions/runs/21902037318/job/63232643320)
- Failing: [Run 21900752893](https://github.com/sovrium/sovrium/actions/runs/21900752893/job/63228205575)

**Related Issues**:

- [anthropics/claude-code-action#892](https://github.com/anthropics/claude-code-action/issues/892) — AJV validation crash reports
- [anthropics/claude-code-action#852](https://github.com/anthropics/claude-code-action/issues/852) — SDK stability tracking
