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

*No issues logged yet. The first entry will be added when the tdd-pipeline-maintainer agent encounters and resolves an issue.*
