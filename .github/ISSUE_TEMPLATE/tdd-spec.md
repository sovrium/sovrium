---
name: TDD Spec Implementation
about: Auto-generated issue for implementing a single E2E test specification
title: '🤖 [SPEC-ID]: [Description]'
labels: 'tdd-spec:queued,tdd-automation'
assignees: ''
---

## 🤖 [SPEC-ID]: [Description]

**File**: `specs/path/to/test.spec.ts:123`
**Feature**: feature/path

### Automated Implementation

The TDD queue system will automatically post implementation instructions as a comment on this issue with `@claude` mention. The Claude Code workflow will trigger automatically when the comment is posted.

**What happens automatically**:

1. Queue processor posts a comment with `@claude` mention and detailed instructions
2. Claude Code workflow triggers from the mention
3. Claude Code creates branch automatically: `claude/issue-{ISSUE_NUMBER}-{timestamp}`
4. Agent invokes e2e-test-fixer to implement test
5. Agent invokes codebase-refactor-auditor for quality review
6. Agent commits and pushes (triggers validation workflow)
7. Validation workflow runs tests and quality checks
8. **On success**: Agent enables auto-merge, PR merges, issue closes
9. **On failure**: Agent retries (up to 3 attempts total)
10. **After 3 failures**: Marked as `tdd-spec:failed` for human review
11. **Queue continues**: Other specs processed while this one waits/retries

**Failure Handling & Retries**:

- Specs automatically retry up to **3 times** if validation fails
- Labels show retry count: `retry:1`, `retry:2`, `retry:3`
- After max retries, spec marked as `tdd-spec:failed` (requires human intervention)
- **Queue never blocks**: Failed specs don't stop other specs from being processed

**Manual Intervention Options**:

1. **Skip automation** (if too complex):
   - Add label: `skip-automated`
   - Queue will skip this spec automatically
   - Implement manually (create your own branch)
   - Create PR with `tdd-automation` label

2. **Manual retry** (after reviewing failure):
   - Change label from `failed` back to `queued`
   - Remove retry labels to reset counter
   - Queue will pick it up again

3. **Direct implementation**:
   - Find Claude-created branch: `git fetch && git branch -r | grep "claude/issue-{ISSUE_NUMBER}"`
   - Checkout branch: `git checkout <branch-name>`
   - Implement code manually
   - Push to trigger validation

Validation runs automatically on every push.

---

**Note**: This issue is part of the TDD automation queue. The system processes specs one at a time by **priority** (APP → MIG → STATIC → API → ADMIN, then alphabetically within each domain).
