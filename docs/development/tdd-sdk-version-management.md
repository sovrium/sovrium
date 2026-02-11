# TDD Pipeline — SDK Version Management

## Overview

This document captures operational lessons learned from debugging Claude Code Action SDK crashes in the TDD automation pipeline. It serves as the reference guide for version pinning decisions, model compatibility, and SDK stability monitoring.

**Primary audience**: The `tdd-pipeline-maintainer` agent and human operators maintaining the TDD pipeline.

**Related docs**:

- `@docs/development/tdd-automation-pipeline.md` — Pipeline architecture (single source of truth)
- `.github/workflows/claude-code.yml` — Workflow implementation

## SDK Bug Identification

Before diagnosing an issue as an SDK bug, verify it is not:

| Potential Cause       | How to Check                                                      |
| --------------------- | ----------------------------------------------------------------- |
| Configuration issue   | Verify GitHub Actions permissions, secrets, environment variables |
| Model incompatibility | Confirm the model is supported by the pinned SDK version          |
| Cost limit violation  | Check workflow logs for budget warnings                           |
| User error            | Review spec file syntax and `@tdd-*` annotations                  |

**Confirmed SDK bugs** exhibit these characteristics:

- Consistent crashes with specific SDK versions (e.g., AJV validation errors in SDK 0.2.22+)
- Traceable to SDK source code changes (not workflow configuration)
- Documented in GitHub issues (anthropics/claude-code-action)
- Resolved by downgrading to a previous SDK version

## Lesson 1: Verify "Safe" Versions Are Actually Safe

When pinning to avoid a bug:

- **DON'T** trust GitHub issue comments blindly — they may report a version as "working" based on limited testing
- **DO** test the pinned version in CI before considering it "fixed"
- **DO** check the actual SDK version bundled in that SHA (not just the action version)
- **DO** verify the pinned version doesn't have the same bug you're avoiding

**Real example**: Issue #892 recommended SDK 0.2.25 (SHA `01e756b`) as "working", but it STILL crashed with the same AJV validation error. We had to find SDK 0.2.9 (SHA `75f52e5`) which predates the bug entirely.

## Lesson 2: Model Compatibility Must Be Verified

When pinning to older action versions:

- **DON'T** assume newer models work with older SDK versions
- **DO** check when the model was released vs. when the SDK was published
- **DO** downgrade the model if the pinned SDK version doesn't support it

**Real example**: We pinned to SDK 0.2.9 (Claude Code v2.1.9, Jan 16) but used `claude-opus-4-6` (released Feb 5, requires v2.1.32+). Had to downgrade to `claude-opus-4-5`. Later, after upgrading the pin to v1.0.47 (SDK 0.2.38), we restored `claude-opus-4-6` since SDK 0.2.38 >= 0.2.32 minimum.

### Model Compatibility Matrix

| Model             | Minimum Claude Code Version | Minimum SDK Version | Release Date |
| ----------------- | --------------------------- | ------------------- | ------------ |
| `claude-opus-4-5` | v2.1.9+                     | 0.2.9+              | Jan 16, 2025 |
| `claude-opus-4-6` | v2.1.32+                    | 0.2.32+             | Feb 5, 2025  |

> Update this matrix when new models are released or version requirements change.

## Lesson 3: GitHub Actions Step Outcome vs Conclusion

When using `continue-on-error: true` in GitHub Actions:

- **DON'T** check `.conclusion` — it is always `success` when `continue-on-error: true`
- **DO** check `.outcome` — it reflects the actual result (`success`, `failure`, `cancelled`, `skipped`)

```yaml
- name: Run Claude Code (Attempt 1)
  id: claude_code_1
  continue-on-error: true
  uses: anthropics/claude-code-action@75f52e5

# WRONG: .conclusion is always 'success' with continue-on-error
- if: steps.claude_code_1.conclusion == 'failure'

# CORRECT: .outcome reflects actual result
- if: steps.claude_code_1.outcome == 'failure'
```

## Lesson 4: Version Pinning Verification Process

Follow these 6 steps when pinning a GitHub Action to a specific SHA:

### Step 1: Identify the Root Cause

- Read error logs carefully (don't assume the first error is the root cause)
- Distinguish between SDK bugs, model incompatibility, workflow configuration errors, and cost limit issues (see "SDK Bug Identification" above)

### Step 2: Research the Bug

- Search GitHub issues at anthropics/claude-code-action
- Determine when the bug was introduced (which SDK/action version)
- Find the version that predates the bug entirely (not just one that "claims to fix it")

### Step 3: Select a Safe Version

- Choose a version that predates the bug (not a "fixed" version reported in issues)
- Verify the bundled SDK version in that SHA's `package.json`
- Check the action's release date and notes

### Step 4: Verify Model Compatibility

- Check the Model Compatibility Matrix above
- If the pinned version doesn't support the desired model, downgrade the model
- Document the model constraint in workflow comments

### Step 5: Document with TODO Comments

Include all context a future maintainer needs:

```yaml
# TODO: Unpin once anthropics/claude-code-action#892 is resolved
# BUG: SDK 0.2.39+ has AJV validation crash
# PINNED TO: SHA b433f16 (v1.0.47, SDK 0.2.38, Feb 10 2026)
# MODEL: claude-opus-4-6 supported (SDK 0.2.38 >= 0.2.32 minimum)
# UNPIN CONDITIONS:
#   1. Issue #892 closed AND fix verified in new SDK version
#   2. Test new version in CI (check for AJV crashes)
- uses: anthropics/claude-code-action@b433f16b30d54063fd3bab6b12f46f3da00e41b6
```

### Step 6: Test in CI

- Push the pinned version to a test branch
- Run `bun run license` on any modified .ts files
- Verify the workflow runs successfully without crashes
- Check logs for warnings or unexpected behavior
- Confirm cost tracking still works correctly

## Lesson 5: GitHub Issues to Monitor

Track these issues for SDK stability:

- [#852: AJV validation errors](https://github.com/anthropics/claude-code-action/issues/852)
- [#892: maxLength/minLength crash](https://github.com/anthropics/claude-code-action/issues/892)
- [#872: Model compatibility issues](https://github.com/anthropics/claude-code-action/issues/872)
- [#779: SDK versioning problems](https://github.com/anthropics/claude-code-action/issues/779)

### Monitoring Workflow

1. Subscribe to these issues for notifications
2. When a fix is released, test it in a separate branch BEFORE unpinning in main
3. Verify the fix works across all workflow scenarios (not just one test case)
4. Update `@tdd-automation-pipeline.md` with the unpinning decision and rationale

### New Issue Discovery

When encountering a new SDK bug:

1. Search anthropics/claude-code-action issues for existing reports
2. Document the bug in `@tdd-automation-pipeline.md` (include issue number if reported)
3. Add the issue to the monitoring list above
4. Follow the Version Pinning Verification Process (Lesson 4)

## Lesson 6: Cost of Ignoring Version Stability

When SDK crashes occur:

- TDD automation completely halts (no specs can be implemented)
- Developers must manually implement tests (defeats TDD automation purpose)
- Pipeline state becomes inconsistent (PRs stuck in `in-progress`)
- Cost tracking fails (see cost protection in `@tdd-automation-pipeline.md` for limits)
- Debugging wastes hours (AJV errors are cryptic and misleading)

### Prevention Strategy

- Pin to stable versions proactively — but always follow the documentation-first workflow
- Test new SDK versions in isolation before rolling out
- Keep a rollback plan documented in `@tdd-automation-pipeline.md` (safe SHA + model combination)
- Maintain the Model Compatibility Matrix above
