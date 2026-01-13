# TDD Automation - Claude Code Instructions

> **When to load this doc**: Only when you see a GitHub issue titled "🤖 [SPEC-ID]: [description]" with labels `tdd-spec:queued` or `tdd-spec:in-progress`.

## Quick Reference

| Step | Action                                 | Command                                              |
| ---- | -------------------------------------- | ---------------------------------------------------- |
| 1    | Branch created automatically           | `claude/issue-{NUMBER}-{timestamp}`                  |
| 2    | Run e2e-test-fixer agent               | Remove `.fixme()`, implement code                    |
| 3    | Check for test-only change             | `git diff --name-only HEAD \| grep '^src/' \| wc -l` |
| 4    | Run refactor-auditor (if src/ changed) | Review implementation quality                        |
| 5    | Quality check                          | `bun run quality`                                    |
| 6    | Add license headers                    | `bun run license`                                    |
| 7    | Commit                                 | `git commit -m "fix: implement {SPEC-ID}"`           |
| 8    | Pre-PR checks                          | See below                                            |
| 9    | Create PR                              | **MANDATORY** - with `tdd-automation` label          |

## Pre-PR Checks (MANDATORY)

```bash
ISSUE_NUMBER=<ISSUE_NUMBER>
CURRENT_BRANCH=$(git branch --show-current)

# Check 1: Issue still open
ISSUE_STATE=$(gh issue view $ISSUE_NUMBER --json state --jq '.state')
[ "$ISSUE_STATE" = "CLOSED" ] && echo "✅ Issue closed - skip PR" && exit 0

# Check 2: No existing PRs
EXISTING_PRS=$(gh pr list --label tdd-automation --state all --json number,body,state \
  --jq '.[] | select(.body | contains("Closes #'$ISSUE_NUMBER'")) | "#\(.number) (\(.state))"')
[ -n "$EXISTING_PRS" ] && echo "✅ PR exists: $EXISTING_PRS - skip PR" && exit 0

# Check 3: No PR from current branch
BRANCH_PR=$(gh pr list --head "$CURRENT_BRANCH" --state all --json number,state \
  --jq '.[] | "#\(.number) (\(.state))"')
[ -n "$BRANCH_PR" ] && echo "✅ Branch PR exists: $BRANCH_PR - skip PR" && exit 0

echo "✅ All checks passed - create PR"
```

## Create PR (REQUIRED)

```bash
gh pr create \
  --title "fix: implement {SPEC-ID}" \
  --body "Closes #{ISSUE_NUMBER}" \
  --label "tdd-automation"
```

**PR Body Format**: `Closes #1234` (no extra text after number - breaks auto-close)

## Early Exit (Test-Only Change)

Skip refactor-auditor if:

- Test passes after removing `.fixme()` only
- No `src/` files modified
- Run `bun run quality` and proceed to commit

## TDD Labels

| Category    | Labels                                                                             |
| ----------- | ---------------------------------------------------------------------------------- |
| **State**   | `tdd-spec:queued`, `tdd-spec:in-progress`, `tdd-spec:completed`, `tdd-spec:failed` |
| **Failure** | `failure:spec`, `failure:regression`, `failure:infra`                              |
| **Retry**   | `retry:spec:1/2/3`, `retry:infra:1/2/3`                                            |

## Retry Logic

- Max 3 attempts per spec
- Labels track retries: `retry:spec:N` (code errors), `retry:infra:N` (infra errors)
- After 3 failures: Mark `tdd-spec:failed`, pipeline continues

## Regression Handling

**Failure Classification**:
| Type | Target Spec | Other Specs | Label |
|------|-------------|-------------|-------|
| `target_only` | ❌ | ✅ | `failure:spec` |
| `regression_only` | ✅ | ❌ | `failure:regression` |
| `mixed` | ❌ | ❌ | `failure:regression` |

**Fix Protocol**:

1. Run failing regression specs
2. Analyze changes: `git diff HEAD~1 --name-only`
3. Fix without modifying tests
4. Verify: `bun test:e2e -- <target_spec> && bun test:e2e:regression`
5. Commit and push

## Completion Checklist

- [ ] `.fixme()` removed
- [ ] Target test passes: `bun test:e2e -- <test-file>`
- [ ] `bun run quality` passes (ZERO errors)
- [ ] All tests in file pass
- [ ] `bun test:e2e:regression` passes
- [ ] `bun run license` (copyright headers)
- [ ] Committed and pushed
- [ ] Pre-PR checks pass
- [ ] **PR created** with `tdd-automation` label

## Critical Rules

### DO

- Run BOTH agents (e2e-test-fixer then refactor-auditor)
- Check for existing PRs before creating
- Create PR even if only `.fixme()` removal
- Commit format: `fix: implement {SPEC-ID}`
- Retry up to 3 times on validation failures

### DON'T

- Modify multiple specs at once
- Modify test logic
- Close issues manually
- Create PR if issue closed or PR exists
- Modify API endpoint paths in specs

### Endpoint Path Rules (PR #6564 Lesson)

- **NEVER** modify API endpoint paths in spec files
- Method name ≠ URL path: `setActiveOrganization` → `/api/auth/organization/set-active`
- 404 error = wrong endpoint

## Queue Architecture

```
Push tests → Scan → Create issues → Queue
                                     ↓
           Processor picks HIGHEST PRIORITY (every 15 min)
           Priority: APP → MIG → STATIC → API → ADMIN
                                     ↓
                    Mark in-progress + @claude mention
                                     ↓
           Claude Code: e2e-test-fixer → refactor-auditor
                                     ↓
                         Commit → Create PR
                                     ↓
                    test.yml validation (retry 3x)
                                     ↓
            Pass → Auto-merge → Issue closes → Next
            Fail (3x) → Mark failed → Next
```

## Priority System

```
Priority = Domain Base + Feature Priority + Test Offset

Domain bases:
- APP: 0 (runs first)
- MIG: 1,000,000
- STATIC: 2,000,000
- API: 3,000,000
- ADMIN: 4,000,000 (runs last)
```

## Configuration

| Setting         | Value        |
| --------------- | ------------ |
| Queue Processor | Every 15 min |
| Max concurrent  | 1 spec       |
| Claude timeout  | 90 min       |
| Max budget      | $10.00/spec  |
| Stuck recovery  | 105 min      |

## Usage Limits (Blocking)

| Limit  | Value    |
| ------ | -------- |
| Daily  | $200.00  |
| Weekly | $1000.00 |

Check usage: `bun run scripts/tdd-automation/check-claude-code-usage.ts --check`

## Troubleshooting

**PR validation fails**: Auto-retries (3x), check test.yml CI status

**Spec stuck in-progress**: Check PR created, recovery workflow re-queues at 90+ min

**Queue not processing**: Check `gh issue list --label "tdd-spec:in-progress"`, wait 15 min
