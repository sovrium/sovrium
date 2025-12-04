# TDD Automation - Merge Conflict Resolution Strategy

## Problem Statement

The TDD automation pipeline can encounter merge conflicts when:

1. Multiple PRs modify the same files (parallel spec processing)
2. Main branch advances while a PR is still pending CI validation

**Example**: PR #1481 (APP-BLOCKS-006) has conflicts with PR #1482 (APP-THEME-COLORS-APPLICATION-005)

- Both modified `DynamicPage.tsx` and `render-homepage.tsx`
- PR #1482 merged first (via local processing)
- PR #1481 now has merge conflicts (mergeable: false, state: dirty)

## Solution Strategies

### Strategy 1: Automatic Rebase Before Auto-Merge (Recommended)

Update Claude TDD workflow to rebase before enabling auto-merge.

**Implementation**:

Update `.github/workflows/claude-tdd.yml` prompt:

```yaml
prompt: >-
  ${{ (github.event_name == 'workflow_run' || github.event_name == 'workflow_dispatch') &&
  format('Implement TDD spec with 7-step workflow:
  1) Run @agent-e2e-test-fixer to fix the test
  2) Run @agent-codebase-refactor-auditor to refactor code (ALWAYS)
  3) Commit changes (bun run license first)
  4) Create PR to main with tdd-automation label and include "Closes #{0}" in PR body
  5) Monitor test.yml validation - if fails, analyze errors, fix, push, retry (max 3 attempts with retry:N labels) - if 3 failures, mark issue tdd-spec:failed and exit
  6) BEFORE enabling auto-merge, rebase on latest main: git fetch origin main && git rebase origin/main && git push --force-with-lease - if rebase conflicts, resolve them intelligently by merging both changes, re-run validation
  7) After successful rebase, enable PR auto-merge with --squash
  8) DO NOT close issue manually (closes automatically on PR merge). Branch already exists and is checked out.', steps.branch.outputs.issue_number) || '' }}
```

**Conflict Resolution Rules for Claude**:

- **Same file, different sections**: Accept both changes
- **Same function signature conflict**: Merge both parameter additions (e.g., `blocks` + `theme` → both props)
- **Same function body conflict**: Combine logic from both versions
- **Import conflicts**: Merge all unique imports
- **After resolution**: Run full validation again (lint, typecheck, Effect diagnostics, tests)

**Benefits**:

- ✅ Automatic conflict detection
- ✅ Intelligent conflict resolution (Claude analyzes context)
- ✅ Re-validation after rebase ensures nothing breaks
- ✅ Transparent process (visible in PR commits)

**Trade-offs**:

- ⚠️ Requires `--force-with-lease` (safe force push)
- ⚠️ May need multiple retry attempts if conflicts complex
- ⚠️ Adds ~1-3 minutes to workflow execution

### Strategy 2: Update Main First Strategy

Check if main has advanced before validation, update branch proactively.

**Implementation**:

Add a pre-validation step in Claude workflow:

```yaml
# In claude-tdd.yml, before "Monitor validation" step
6) Check if main has new commits: BEHIND=$(git rev-list --count HEAD..origin/main) - if BEHIND > 0, rebase immediately before CI runs
```

**Benefits**:

- ✅ Prevents conflicts before they occur
- ✅ Catches conflicts early (before validation)
- ✅ Reduces wasted CI runs

**Trade-offs**:

- ⚠️ Extra GitHub API calls
- ⚠️ Branch may need multiple rebases if main is very active

### Strategy 3: Branch Protection Update Strategy

Update branch protection to require "up-to-date" branches.

**Implementation**:

```bash
gh api -X PATCH repos/sovrium/sovrium/branches/main/protection/required_status_checks \
  -F 'strict=true' \
  -F 'contexts[]=Test'
```

With `strict: true`, GitHub blocks merge if branch is behind main, forcing rebase.

**Benefits**:

- ✅ Native GitHub protection
- ✅ No workflow changes needed
- ✅ Prevents any stale PRs from merging

**Trade-offs**:

- ⚠️ Auto-merge won't trigger if branch behind
- ⚠️ Requires manual rebase by Claude (or automation)
- ⚠️ May cause PRs to sit in pending state

### Strategy 4: Coordination Labels Strategy

Use GitHub labels to coordinate parallel work.

**Implementation**:

1. Before processing spec, check files it will modify:

   ```bash
   # In queue processor
   SPEC_FILES=$(grep -l "APP-BLOCKS-006" specs/**/*.spec.ts | xargs grep -l "test.fixme")
   ```

2. Query open PRs for conflicts:

   ```bash
   gh pr list --state open --label "tdd-automation" --json files,number
   ```

3. If file overlap detected, add label `conflict-risk:high` and skip or wait

**Benefits**:

- ✅ Proactive conflict avoidance
- ✅ Smart file-based coordination
- ✅ Works with parallel processing

**Trade-offs**:

- ⚠️ Complex implementation
- ⚠️ Requires spec analysis before execution
- ⚠️ May slow queue if many conflicts

## Recommended Implementation Plan

### Phase 1: Immediate Fix (Manual Resolution)

For PR #1481, manually resolve conflicts:

```bash
# Find and checkout Claude-created branch
git fetch origin
git checkout claude/issue-1481-{timestamp}

# Rebase on latest main
git fetch origin main
git rebase origin/main

# Resolve conflicts intelligently:
# DynamicPage.tsx: Add BOTH blocks and theme props
# render-homepage.tsx: Combine both logic branches

# After resolution
bun run license
bun run lint
bun run format
bun run typecheck
bun test:unit
bun test:e2e:regression

# Push
git push --force-with-lease

# Enable auto-merge
gh pr merge --auto --squash
```

### Phase 2: Update Workflows (Strategy 1)

1. Update `.github/workflows/claude-tdd.yml` with rebase step
2. Document rebase process in CLAUDE.md

### Phase 3: Add Protections (Strategy 3)

Enable strict branch protection after workflows updated:

```bash
gh api -X PATCH repos/sovrium/sovrium/branches/main/protection/required_status_checks \
  -F 'strict=true' \
  -F 'contexts[]=Test'
```

### Phase 4: Monitor & Iterate

- Track conflict resolution success rate
- Adjust conflict resolution rules based on patterns
- Consider Strategy 4 if conflicts frequent

## Conflict Resolution Examples

### Example 1: Props Conflict (DynamicPage.tsx)

**Conflict**:

```tsx
<<<<<<< HEAD
export function DynamicPage({ page, blocks }: { readonly page: Page; readonly blocks?: Blocks })
=======
export function DynamicPage({ page, theme }: { readonly page: Page; readonly theme?: Theme })
>>>>>>> origin/main
```

**Resolution** (accept both):

```tsx
export function DynamicPage({
  page,
  blocks,
  theme,
}: {
  readonly page: Page
  readonly blocks?: Blocks
  readonly theme?: Theme
})
```

### Example 2: Function Body Conflict (render-homepage.tsx)

**Conflict**:

```tsx
<<<<<<< HEAD
const customHomePage = renderPageByPath(app, '/')
if (customHomePage) return customHomePage
=======
const html = homePage ? renderToString(<DynamicPage page={homePage} theme={app.theme} />) : ...
>>>>>>> origin/main
```

**Resolution** (combine logic):

```tsx
const customHomePage = renderPageByPath(app, '/')
if (customHomePage) return customHomePage

const html = homePage
  ? renderToString(
      <DynamicPage
        page={homePage}
        blocks={app.blocks}
        theme={app.theme}
      />
    )
  : renderToString(<DefaultHomePage app={app} />)
```

## Testing Conflict Resolution

After resolving conflicts, always run full validation:

```bash
# Quality checks
bun run license
bun run lint
bun run format
bun run typecheck

# Unit tests (ensure no regressions)
bun test:unit

# E2E regression (catch integration issues)
bun test:e2e:regression

# Specific spec test
bun test:e2e specs/app/blocks/blocks.spec.ts --grep "APP-BLOCKS-006"
```

## Monitoring & Metrics

Track conflict metrics in TDD monitoring:

- Total conflicts encountered
- Conflicts auto-resolved vs manual
- Average resolution time
- Files most frequently conflicted
- Success rate after resolution

---

**Status**: Draft - Ready for implementation
**Last Updated**: 2025-11-01
**Related PRs**: #1481 (conflict example), #1482 (merged, caused conflict)
