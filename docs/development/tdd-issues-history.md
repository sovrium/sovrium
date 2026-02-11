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

### ISSUE-2026-02-11-dedup-author-mismatch

| Field                    | Value                                                                                                                                                                                                                             |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Date**                 | 2026-02-11                                                                                                                                                                                                                        |
| **Severity**             | medium                                                                                                                                                                                                                            |
| **Affected Workflow(s)** | `test.yml`                                                                                                                                                                                                                        |
| **Error Symptoms**       | `[STATE]` `[RETRY]` -- Comment deduplication check in Step 3 of the atomic check-and-post block never found existing `@claude` comments because it filtered by `.user.login == "github-actions[bot]"`, but comments are posted via `GH_PAT_WORKFLOW` (author is PAT owner, not `github-actions[bot]`). The check was effectively a no-op. |

**Error Message / Log Excerpt**:

```
# The jq filter that never matched:
[.[] | select(.user.login == "github-actions[bot]" and (.body | contains("@claude")) and (.body | contains("Attempt: 3/5")))] | length
# Always returned 0 because comments were posted by "thomas-jeanneau", not "github-actions[bot]"
```

**Root Cause Analysis**:

The `@claude` comments are posted using `GH_PAT_WORKFLOW`, a personal access token belonging to the repository owner. GitHub attributes comments posted via PAT to the PAT owner's account, not to `github-actions[bot]`. The deduplication jq filter included `.user.login == "github-actions[bot]"` as an author check, which never matched the actual comment author. This was originally identified as a secondary finding in ISSUE-2026-02-11-branch-sync-claude-cascade but not fixed at that time.

**Solution Applied**:

Removed the `.user.login == "github-actions[bot]"` author filter from the jq query. The remaining content filters (`@claude` + exact `Attempt: N/M` string) are sufficiently unique -- no legitimate comment would contain both strings unless it was an actual TDD trigger comment. Added inline comments explaining why the author filter is omitted.

**Files Modified**:

- `.github/workflows/test.yml` -- Removed author filter from Step 3 deduplication jq query
- `docs/development/tdd-issues-history.md` -- Added this entry; updated secondary finding in ISSUE-2026-02-11-branch-sync-claude-cascade to reference this fix

**Lessons Learned**:

- **Always verify which token posts comments and what author that produces.** `GITHUB_TOKEN` posts as `github-actions[bot]`, but personal access tokens (`GH_PAT_WORKFLOW`) post as the PAT owner. Filtering by author is fragile when the posting token may change.
- **Content-based deduplication is more robust than author-based.** When the content itself is sufficiently unique (specific trigger keyword + exact attempt string), adding an author filter creates unnecessary coupling to the authentication mechanism.
- **"Secondary findings" documented for future fix should be tracked as actionable items.** This bug was identified on 2026-02-11 in a previous entry but only documented as a note. Creating a separate tracking item would have prevented it from being forgotten.

**Related Issues**: ISSUE-2026-02-11-branch-sync-claude-cascade (secondary finding), ISSUE-2026-02-11-duplicate-claude-comment-race (original dedup implementation)

---

### ISSUE-2026-02-11-branch-sync-claude-cascade

| Field                    | Value                                                                                                                                                                                                                                                                                                    |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Date**                 | 2026-02-11                                                                                                                                                                                                                                                                                               |
| **Severity**             | high                                                                                                                                                                                                                                                                                                     |
| **Affected Workflow(s)** | `branch-sync.yml`, `test.yml`, `claude-code.yml`                                                                                                                                                                                                                                                         |
| **Error Symptoms**       | `[INFRA]` `[STATE]` `[RETRY]` -- `branch-sync.yml` pushes to a TDD branch while Claude Code is actively implementing, triggering a `test.yml` run that cancels the Claude Code workflow and posts a duplicate `@claude` comment with an incremented attempt counter, wasting an attempt and API credits. |

**Error Message / Log Excerpt**:

```
PR #7233 timeline:
15:06:59 — test.yml TDD Handle Failure posts @claude comment (Attempt 3/5) → Claude Code starts
15:47:11 — branch-sync.yml fires (push to main triggers it)
15:47:26 — branch-sync merges main into tdd/app-tables-field-types-relationship-015, pushes
15:47:29 — Push triggers test.yml (pull_request: synchronize). Previous Claude Code cancelled.
15:50:42 — Duplicate @claude comment posted (Attempt 4/5) — wasted attempt + API credits
```

**Root Cause Analysis**:

`branch-sync.yml` pushes merge commits to TDD branches unconditionally. When Claude Code is actively implementing on that branch, the push creates a cascade:

1. Push to TDD branch triggers `test.yml` (via `pull_request: synchronize` event)
2. The `test.yml` concurrency group or the new test run cancels/supersedes the running Claude Code workflow
3. Tests fail (Claude hadn't finished implementing yet) -- `tdd-handle-failure` runs
4. The Claude Code running check finds no active runs (the previous was cancelled by the cascade)
5. A new `@claude` comment is posted with an incremented attempt counter (3/5 becomes 4/5)

This wastes one attempt slot AND the cost of a new Claude Code run ($10-15).

**Secondary Finding (Fixed in ISSUE-2026-02-11-dedup-author-mismatch)**: The comment deduplication check in test.yml Step 3 filtered by `.user.login == "github-actions[bot]"`, but comments are posted using `GH_PAT_WORKFLOW` (a personal access token), so the actual author is the PAT owner, not `github-actions[bot]`. This meant the deduplication check never found existing comments. Fixed by removing the author filter -- the content match (`@claude` + exact `Attempt: N/M` string) is sufficiently unique.

**Solution Applied**:

Added a Claude Code guard in `branch-sync.yml` that checks for active/queued Claude Code TDD runs before pushing merge commits to TDD branches. The guard:

1. Runs after the `BEHIND_COUNT` check (branch is behind main) and before the merge attempt
2. Uses `gh run list --workflow="Claude Code" --status=in_progress --status=queued` with jq filter for `[TDD]` in `displayTitle` (same pattern as test.yml layer 4)
3. If active runs are detected, skips the sync with a log message and `continue`
4. The branch will be synced on the next cycle (15-minute cron or next push to main)

**Files Modified**:

- `.github/workflows/branch-sync.yml` -- Added Claude Code guard check before merge step
- `docs/development/tdd-automation-pipeline.md` -- Updated Branch Sync Workflow section with guard documentation; added layer 8 to Race Condition Protections

**Lessons Learned**:

- **Any workflow that pushes to TDD branches must check for active Claude Code runs first.** Pushing to a TDD branch triggers `test.yml`, which can cancel running Claude Code and trigger duplicate runs. This is the same class of problem as ISSUE-2026-02-11-duplicate-claude-comment-race but via a different vector (branch-sync instead of concurrent test runs).
- **The `[TDD]` title-filtered global query pattern is now used in 3 places**: test.yml (layer 4), staleness-check.ts, and branch-sync.yml (layer 8). If the pattern needs to change, all 3 must be updated.
- **Deferring sync to the next cycle is safe.** Branch-sync runs every 15 minutes (cron) plus on every push to main. Skipping one cycle when Claude Code is active has no negative impact -- the branch will be synced after Claude Code completes and pushes its changes.

**Related Issues**: PR #7233

---

### ISSUE-2026-02-11-spec-progress-unstaged-user-stories

| Field                    | Value                                                                                                                                                                                                                             |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Date**                 | 2026-02-11                                                                                                                                                                                                                        |
| **Severity**             | medium                                                                                                                                                                                                                            |
| **Affected Workflow(s)** | `test.yml`                                                                                                                                                                                                                        |
| **Error Symptoms**       | `[YAML]` `[INFRA]` — "Update Spec Progress" job fails with exit code 128. `git pull --rebase` refuses to run due to unstaged changes in `docs/user-stories/`. `git rebase --abort` then fails because no rebase was ever started. |

**Error Message / Log Excerpt**:

```
📝 Committing spec progress updates...
[main 35f81076] chore: update spec progress [skip ci]
 1 file changed, 58 insertions(+), 58 deletions(-)
🔄 Pulling latest changes from main...
error: cannot pull with rebase: You have unstaged changes.
error: Please commit or stash them.
⚠️ Rebase conflict detected - aborting push
fatal: no rebase in progress
##[error]Process completed with exit code 128.
```

**Root Cause Analysis**:

The `bun run progress --no-error --update-stories` command modifies three types of files:

1. `SPEC-PROGRESS.md` — spec progress tracking
2. `README.md` — badge updates
3. `docs/user-stories/**/*.md` — acceptance criteria tables updated with test status columns

However, the commit step only checked and staged the first two files (`git diff --quiet SPEC-PROGRESS.md README.md` and `git add SPEC-PROGRESS.md README.md`). The user story files were left as unstaged changes in the working tree.

When `git pull --rebase origin main` ran, git refused to start the rebase because of the unstaged changes in `docs/user-stories/`. The error handler then called `git rebase --abort`, which failed with exit code 128 because no rebase was ever in progress (git rejected the operation before starting it).

**Solution Applied**:

Three minimal changes to the "Commit spec progress updates" step in `test.yml`:

1. Added `docs/user-stories/` to the `git diff --quiet` check so changes to user story files are detected
2. Added `docs/user-stories/` to the `git add` command so user story changes are committed
3. Guarded `git rebase --abort` with `2>/dev/null || true` to handle the case where git refuses to start the rebase (no rebase in progress to abort)

**Files Modified**:

- `.github/workflows/test.yml` — Updated git diff check, git add, and rebase abort error handling in the "Commit spec progress updates" step

**Lessons Learned**:

- **When adding new flags that produce file changes, update the commit step to track ALL output files.** The `--update-stories` flag was added to `bun run progress` but the commit step was not updated to include user story files. Any command that modifies files in CI must have its git add step updated to match.
- **`git pull --rebase` fails before starting the rebase when there are unstaged changes.** This means `git rebase --abort` will fail with "no rebase in progress". Always guard `git rebase --abort` with `|| true` when it's in an error recovery path.
- **Test the full git workflow locally when adding new file outputs.** The three-step sequence (diff check, add, commit, pull, push) must account for every file that could be modified by the preceding step.

---

### ISSUE-2026-02-11-duplicate-claude-comment-race

| Field                    | Value                                                                                                                                                                                                                                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Date**                 | 2026-02-11                                                                                                                                                                                                                                                                                 |
| **Severity**             | high                                                                                                                                                                                                                                                                                       |
| **Affected Workflow(s)** | `test.yml`, `staleness-check.ts`                                                                                                                                                                                                                                                           |
| **Error Symptoms**       | `[STATE]` `[RETRY]` `[INFRA]` — Two concurrent `test.yml` runs both post `@claude` comments on the same TDD PR, causing duplicate Claude Code workflow triggers for the same attempt. Additionally, the "Claude Code running check" in Step 2 **never worked** due to a branch filter bug. |

**Error Message / Log Excerpt**:

```
PR #7225: Two @claude e2e-test-fixer comments posted within seconds of each other,
both for the same attempt number. Both triggered separate claude-code.yml runs.

# Step 2 (Claude Code running check) always returned 0:
gh run list --workflow="Claude Code" --branch="tdd/implement-SPEC-001" --status=in_progress
# Returns 0 because claude-code.yml (triggered by issue_comment) reports head_branch="main"
```

**Root Cause Analysis (Two-Phase Discovery)**:

**Phase 1 — Race condition between sequential steps**: The `tdd-handle-failure` job in `test.yml` had 3 sequential steps with a timing gap between them:

1. `check-last-run` (staleness check) - ~10 seconds
2. `check-claude-code` (Claude Code workflow running check) - ~5 seconds
3. `Trigger Claude Code on failure` (posts the `@claude` comment)

Between step 1 and step 3, another concurrent `test.yml` run could pass the same checks and post its own `@claude` comment.

**Phase 2 — Branch filter bug (the deeper issue)**: The "Claude Code running check" in Step 2 used `gh run list --workflow="Claude Code" --branch="$BRANCH" --status=in_progress` to detect running Claude Code workflows. This check **never returned results** because `claude-code.yml` is triggered by `issue_comment` events, and GitHub Actions always reports `head_branch: "main"` for `issue_comment`-triggered workflows, regardless of the PR's actual branch. So filtering by the TDD branch name (e.g., `tdd/implement-SPEC-001`) always returned 0.

The same bug affected `staleness-check.ts` (`scripts/tdd-automation/programs/staleness-check.ts`), which queries Claude Code runs using the branch parameter from the environment. All Claude Code run queries returned empty results, making the staleness check's `activeClaude` count always 0.

**Solution Applied (Two Phases)**:

**Phase 1 fix — Atomic step**: Merged the 3 separate steps into a single atomic step with 4 internal phases:

1. Staleness check (via TypeScript program)
2. Claude Code workflow running check (via `gh run list`)
3. Attempt-specific comment deduplication (queries PR comments for existing `Attempt: N/M`)
4. Comment posting (if all checks pass)

**Phase 2 fix — Branch filter removal + [TDD] title filter**:

1. In `test.yml` Step 2, replaced `gh run list --branch="$BRANCH"` with a global query filtered by `[TDD]` in `displayTitle` via jq. Also added `--status=queued` to catch runs waiting in the concurrency queue.
2. In `staleness-check.ts`, removed the branch parameter from `claude-code.yml` queries and added `display_title` filtering for `[TDD]` prefix instead. Also added `queued` status checks.
3. This is safe because serial processing guarantees only one active TDD PR at a time, making a global `[TDD]` check equivalent to a per-PR branch check.

**Files Modified**:

- `.github/workflows/test.yml` — Phase 1: Merged 5 steps into atomic step. Phase 2: Replaced branch-filtered `gh run list` with global `[TDD]` title-filtered query
- `scripts/tdd-automation/programs/staleness-check.ts` — Phase 2: Removed branch filter for `claude-code.yml` queries, added `display_title` filtering and `queued` status
- `scripts/tdd-automation/services/github-api.ts` — Phase 2: Added `displayTitle` field to `WorkflowRun` interface
- `docs/development/tdd-automation-pipeline.md` — Updated race condition protection layer 4 and staleness filter documentation

**Lessons Learned**:

- **`issue_comment`-triggered workflows always report `head_branch: "main"`.** This is a GitHub Actions platform behavior, not a bug. Any check that filters by the PR's branch name will fail for workflows triggered by `issue_comment` events. Always verify your branch filter assumptions by checking the actual workflow trigger type.
- **Sequential workflow steps with timing gaps create race windows.** Merging check + action into a single step minimizes the race window from minutes to milliseconds.
- **Attempt-specific deduplication is safer than generic matching.** The deduplication must match the specific `Attempt: N/M` string to allow legitimate retries.
- **Serial processing guarantees simplify global checks.** When the pipeline enforces 1 active TDD PR at a time, global queries filtered by `[TDD]` title are equivalent to per-PR branch queries, and more reliable.
- **A check that always returns 0 is worse than no check.** The branch-filtered Claude Code query gave false confidence that no runs were active, effectively bypassing the protection entirely.

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
