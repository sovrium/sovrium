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

| Field | Value |
|-------|-------|
| **Date** | YYYY-MM-DD |
| **Severity** | critical / high / medium / low |
| **Affected Workflow(s)** | e.g., `claude-code.yml`, `pr-creator.yml` |
| **Error Symptoms** | Brief description of what was observed |

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

| Tag | Meaning |
|-----|---------|
| `[SDK]` | Claude Code Action SDK issue |
| `[VERSION-PIN]` | Version pinning related |
| `[YAML]` | Workflow YAML syntax or logic |
| `[COST]` | Cost protection or budget issue |
| `[STATE]` | Label/PR state management issue |
| `[RETRY]` | Retry logic or attempt counting |
| `[MODEL]` | Model escalation or compatibility |
| `[MERGE]` | Merge conflict or auto-merge issue |
| `[SCRIPT]` | TypeScript script bug |
| `[INFRA]` | GitHub Actions infrastructure issue |

---

## Issue Log

<!-- New entries go here, newest first -->

### ISSUE-2026-02-11-ajv-mode-execute-crash

| Field | Value |
|-------|-------|
| **Date** | 2026-02-11 |
| **Severity** | critical |
| **Affected Workflow(s)** | `claude-code.yml` |
| **Error Symptoms** | `[SDK]` `[VERSION-PIN]` `[YAML]` — TDD automation completely halted. Claude Code Action crashes with cryptic AJV validation error on every run. Multiple version pin attempts failed to resolve the issue. |

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
CLAUDE_ARGS: "--mode execute --verbose"
```

After:
```yaml
CLAUDE_ARGS: "--verbose"
```

**Files Modified**:
- `.github/workflows/claude-code.yml` — Removed `--mode execute` from CLAUDE_ARGS (line 486), updated comments
- `docs/development/tdd-sdk-version-management.md` — Added Lesson 7: GA v1.0 breaking changes (removed flags)
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
