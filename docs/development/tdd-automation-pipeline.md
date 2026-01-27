# TDD Automation Pipeline - Specification

> **Status**: ✅ EFFECT IMPLEMENTATION COMPLETE
> **Last Updated**: 2025-01-27
> **Scope**: 230 pending specs over ~6-8 days
>
> **Implementation Note**: Effect-based services in `scripts/tdd-automation/` are now implemented. See the "Effect-Based Implementation Architecture" section for file references. YAML workflows (`.github/workflows/`) are being migrated to call these TypeScript entry points.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Quick Reference](#quick-reference)
3. [Architecture](#architecture)
4. [Workflow Specifications](#workflow-specifications)
5. [State Management](#state-management)
6. [Cost Protection](#cost-protection)
7. [Implementation Plan](#implementation-plan)
8. [Risks & Mitigations](#risks--mitigations)
9. [Design Decisions](#design-decisions)
10. [Effect-Based Implementation Architecture](#effect-based-implementation-architecture)

---

## Executive Summary

This pipeline automates TDD implementation using **GitHub's native features** (PRs, labels, comments) for state management - no custom JSON state file required.

**Key Design Decisions:**

- ✅ **Serial processing** (1 spec at a time) - eliminates race conditions
- ✅ **PR titles for attempt tracking** (immutable) - reliable counting
- ✅ **Branch names as backup ID** - label accident recovery
- ✅ **Merge strategy** for main sync - safer than rebase
- ✅ **5 max attempts** (configurable per-spec) - reasonable for 230 specs
- ✅ **$100/day, $500/week limits** with 80% warning alerts

---

## Quick Reference

### Labels

| Label                                | Purpose             | Added By                   | Removed By            |
| ------------------------------------ | ------------------- | -------------------------- | --------------------- |
| `tdd-automation`                     | Identifies TDD PR   | PR Creator                 | Auto-merge (on close) |
| `tdd-automation:manual-intervention` | Needs human review  | Test Workflow (5 failures) | Human                 |
| `tdd-automation:had-conflict`        | Had merge conflicts | Claude Code                | Human (after review)  |

### Branch Naming

```
tdd/<spec-id>
Example: tdd/API-TABLES-CREATE-001
```

### PR Title Format

```
[TDD] Implement <spec-id> | Attempt X/5
Example: [TDD] Implement API-TABLES-CREATE-001 | Attempt 2/5
```

### Workflows Summary

| Workflow       | File                                   | Trigger                                |
| -------------- | -------------------------------------- | -------------------------------------- |
| PR Creator     | `.github/workflows/pr-creator.yml`     | Hourly cron + test.yml success on main |
| Test           | `.github/workflows/test.yml`           | Push to any branch                     |
| Claude Code    | `.github/workflows/claude-code.yml`    | @claude comment on PR                  |
| Merge Watchdog | `.github/workflows/merge-watchdog.yml` | Every 30 min                           |

### Cost Limits

| Threshold  | Daily | Weekly | Action        |
| ---------- | ----- | ------ | ------------- |
| Warning    | $80   | $400   | Log warning   |
| Hard Limit | $100  | $500   | Skip workflow |

### Claude Code GitHub Action

**Uses:** `anthropics/claude-code-action@v1` ([Repository](https://github.com/anthropics/claude-code-action))

**Required Secret:**

```
CLAUDE_CODE_OAUTH_TOKEN  # Settings → Secrets and variables → Actions
```

**Action Inputs:**

| Input                     | Value                                    | Purpose                                         |
| ------------------------- | ---------------------------------------- | ----------------------------------------------- |
| `claude_code_oauth_token` | `${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}` | OAuth token authentication                      |
| `track_progress`          | `true`                                   | Built-in progress tracking (replaces heartbeat) |
| `use_sticky_comment`      | `true`                                   | Updates single comment instead of creating new  |
| `claude_args`             | See agent configurations below           | CLI-compatible arguments                        |
| `timeout_minutes`         | `45` (default), configurable per-spec    | Read from `@tdd-timeout` comment in spec file   |

**Required Permissions:**

```yaml
permissions:
  contents: write # Push commits
  pull-requests: write # Comment on PRs
  issues: write # Create issues
  actions: read # Read workflow runs
```

---

### Agent Configurations

Both agents use Claude Sonnet 4.5 for optimal reasoning-to-cost balance. The agents are configured for **fully autonomous operation** in the TDD pipeline.

#### e2e-test-fixer Agent Configuration

**Purpose:** Make failing E2E tests pass through minimal, correct implementation.

**claude_args:**

```bash
--max-turns 50
--model claude-sonnet-4-5
--allowedTools "Bash,Read,Write,Edit,Glob,Grep,Task,TodoWrite,LSP,Skill"
--disallowedTools "WebFetch,WebSearch,AskUserQuestion,NotebookEdit"
```

| Parameter           | Value               | Rationale                                                                                   |
| ------------------- | ------------------- | ------------------------------------------------------------------------------------------- |
| `--max-turns`       | `50`                | Complex TDD cycles require multiple iterations (quality check → fix → test → repeat)        |
| `--model`           | `claude-sonnet-4-5` | Best reasoning-to-cost balance for TDD implementation                                       |
| `--allowedTools`    | Core tools + Skill  | Read/Write/Edit for code, Bash for tests, Glob/Grep for search, Skill for schema generation |
| `--disallowedTools` | Web + Interactive   | WebFetch/WebSearch blocked for CI reproducibility, AskUserQuestion blocked for autonomy     |

**Autonomous Behaviors:**

- ✅ Creates schemas via Skill tool when missing (explicitly allowed)
- ✅ Runs quality checks and tests iteratively
- ✅ Commits and pushes changes without confirmation
- ✅ Handles merge conflicts via merge strategy
- ❌ Never asks clarifying questions (autonomous mode)
- ❌ Never fetches external documentation (CI reproducibility)

#### codebase-refactor-auditor Agent Configuration

**Purpose:** Optimize implementations after tests pass (code quality, DRY, architecture).

**claude_args:**

```bash
--max-turns 40
--model claude-sonnet-4-5
--allowedTools "Bash,Read,Write,Edit,Glob,Grep,Task,TodoWrite,LSP"
--disallowedTools "WebFetch,WebSearch,Skill,AskUserQuestion,NotebookEdit"
```

| Parameter           | Value                     | Rationale                                                          |
| ------------------- | ------------------------- | ------------------------------------------------------------------ |
| `--max-turns`       | `40`                      | Refactoring is bounded; fewer iterations than implementation       |
| `--model`           | `claude-sonnet-4-5`       | Architectural reasoning requires Sonnet-level capability           |
| `--allowedTools`    | Core tools (no Skill)     | Same base tools, but Skill excluded (schema creation not its job)  |
| `--disallowedTools` | Web + Skill + Interactive | Skill blocked (schema creation is e2e-test-fixer's responsibility) |

**Autonomous Behaviors:**

- ✅ Removes eslint-disable comments and fixes violations
- ✅ Refactors recent commits (Phase 1.1) immediately
- ✅ Generates recommendations for older code (Phase 1.2)
- ✅ Validates with regression tests before committing
- ❌ Does not implement Phase 1.2 recommendations without approval
- ❌ Never creates new schemas (e2e-test-fixer's responsibility)

---

### Agent Selection Logic

The workflow dynamically selects the appropriate agent based on failure context:

```
@claude comment received
        │
        ▼
┌───────────────────────────┐
│ Parse comment context     │
└───────────┬───────────────┘
            │
    ┌───────┴───────┐
    │               │
    ▼               ▼
┌────────┐    ┌────────────┐
│ Test   │    │ Quality    │
│ Failure│    │ Only Fail  │
└────┬───┘    └──────┬─────┘
     │               │
     ▼               ▼
┌────────────┐  ┌─────────────────────┐
│ e2e-test-  │  │ codebase-refactor-  │
│ fixer      │  │ auditor             │
└────────────┘  └─────────────────────┘
```

**Selection Rules:**

| Condition                                            | Agent                          | Prompt Includes                       |
| ---------------------------------------------------- | ------------------------------ | ------------------------------------- |
| Test failure (assertions, timeouts, HTTP errors)     | `e2e-test-fixer`               | Spec ID, file path, failure details   |
| Quality failure only (lint, typecheck, no test fail) | `codebase-refactor-auditor`    | Quality output, files affected        |
| Merge conflict detected                              | Either + conflict instructions | Conflict markers, resolution guidance |
| 3+ tests fixed, handoff triggered                    | `codebase-refactor-auditor`    | Baseline results, duplication notes   |

---

### System Prompt Templates

#### For e2e-test-fixer (Test Failures)

```markdown
You are operating in the TDD automation pipeline. Use the e2e-test-fixer agent workflow.

**Context:**

- Spec: ${SPEC_ID}
- File: ${SPEC_FILE}
- Attempt: ${ATTEMPT}/${MAX_ATTEMPTS}
- Branch: tdd/${SPEC_ID}

**Failure Details:**
${TEST_OUTPUT}

**Instructions:**

1. Remove .fixme() from the failing test
2. Analyze the failure (MANDATORY - document root cause)
3. Verify required schemas exist (escalate if missing)
4. Implement minimal code to pass the test
5. Run `bun run quality` AND `bun test:e2e -- ${SPEC_FILE}` (iterate until BOTH pass)
6. Run `bun test:e2e:regression` to verify no regressions
7. Commit with message: "fix: implement ${SPEC_ID}"
8. Push to origin (MANDATORY for pipeline to continue)

**Constraints:**

- NEVER modify test logic or assertions
- NEVER ask clarifying questions (autonomous mode)
- Maximum 3 iterations before reporting failure
- Follow functional programming patterns (no push/mutation)
```

#### For codebase-refactor-auditor (Quality Failures)

```markdown
You are operating in the TDD automation pipeline. Use the codebase-refactor-auditor agent workflow.

**Context:**

- Branch: tdd/${SPEC_ID}
- Trigger: Quality failure (tests passing)

**Quality Output:**
${QUALITY_OUTPUT}

**Instructions:**

1. Establish Phase 0 baseline: `bun run quality --include-effect` and `bun test:e2e:regression`
2. Phase 1.1: Analyze and fix issues in recent commits
3. Phase 5: Validate no regressions with same commands
4. Commit with message: "refactor: optimize ${SPEC_ID} implementation"
5. Push to origin

**Constraints:**

- `bun run quality` MUST pass - any failure blocks commit
- Layer architecture MUST be correct
- Maximum 2 fix attempts per issue
- NEVER run @spec tests (too slow for CI)
```

---

### Timeout Configuration

Complex specs may require extended timeouts. Configure via:

1. **Per-Spec Annotation** (in spec file):

   ```typescript
   // @tdd-timeout 60
   test.fixme('Complex integration test', async () => { ... })
   ```

2. **Workflow Default** (in claude-code.yml):
   ```yaml
   - uses: anthropics/claude-code-action@v1
     timeout-minutes: ${{ inputs.timeout || 45 }}
   ```

| Spec Type           | Recommended Timeout | Rationale                        |
| ------------------- | ------------------- | -------------------------------- |
| Simple UI           | 30 min              | Single component, few iterations |
| API endpoint        | 45 min (default)    | Requires route + schema + tests  |
| Complex integration | 60 min              | Multiple layers, database, auth  |
| Multi-file feature  | 75 min              | Cross-cutting implementation     |

---

## Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         TDD AUTOMATION PIPELINE                              │
│                                                                              │
│  ┌─────────────┐         ┌─────────────┐         ┌─────────────┐           │
│  │ PR Creator  │────────▶│    Test     │────────▶│ Claude Code │           │
│  │  Workflow   │         │  Workflow   │         │  Workflow   │           │
│  └─────────────┘         └─────────────┘         └─────────────┘           │
│        │                       │                       │                    │
│        ▼                       ▼                       ▼                    │
│  ┌─────────────┐         ┌─────────────┐         ┌─────────────┐           │
│  │ Creates PR  │         │ Runs tests  │         │ Fixes code  │           │
│  │ with label  │         │ Posts @claude│        │ Pushes fix  │           │
│  └─────────────┘         └─────────────┘         └─────────────┘           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Detailed Workflow Pipeline Schema

This section provides a **complete, unabridged view** of the TDD automation pipeline with all decision points, error handling paths, state transitions, and workflow interconnections.

#### Complete Pipeline Flow with All Decision Points

```
╔══════════════════════════════════════════════════════════════════════════════════════════════════════╗
║                                    TDD AUTOMATION PIPELINE                                            ║
║                                    ══════════════════════                                             ║
╠══════════════════════════════════════════════════════════════════════════════════════════════════════╣
║                                                                                                       ║
║  ════════════════════════════════════════════════════════════════════════════════════════════════    ║
║  ENTRY POINTS (3 possible triggers for PR Creator)                                                   ║
║  ════════════════════════════════════════════════════════════════════════════════════════════════    ║
║                                                                                                       ║
║      ┌────────────────────┐      ┌────────────────────┐      ┌────────────────────┐                  ║
║      │  TRIGGER 1         │      │  TRIGGER 2         │      │  TRIGGER 3         │                  ║
║      │  Cron Schedule     │      │  workflow_run      │      │  workflow_dispatch │                  ║
║      │  (every hour)      │      │  test.yml pass on  │      │  (manual trigger)  │                  ║
║      │  0 * * * *         │      │  main branch       │      │                    │                  ║
║      └─────────┬──────────┘      └─────────┬──────────┘      └─────────┬──────────┘                  ║
║                │                           │                           │                              ║
║                └───────────────────────────┼───────────────────────────┘                              ║
║                                            │                                                          ║
║                                            ▼                                                          ║
║  ════════════════════════════════════════════════════════════════════════════════════════════════    ║
║  WORKFLOW 1: PR CREATOR (.github/workflows/pr-creator.yml)                                           ║
║  ════════════════════════════════════════════════════════════════════════════════════════════════    ║
║                                                                                                       ║
║                              ┌─────────────────────────────┐                                          ║
║                              │   JOB 1: check-credits      │                                          ║
║                              │   ─────────────────────     │                                          ║
║                              │   Query workflow runs from: │                                          ║
║                              │   - Last 24 hours (daily)   │                                          ║
║                              │   - Last 7 days (weekly)    │                                          ║
║                              └─────────────┬───────────────┘                                          ║
║                                            │                                                          ║
║                              ┌─────────────▼───────────────┐                                          ║
║                              │  Parse cost from logs:      │                                          ║
║                              │  1. "Total cost: $X.XX"     │                                          ║
║                              │  2. "Cost: $X.XX"           │                                          ║
║                              │  3. "Session cost: X.XX USD"│                                          ║
║                              │  4. Fallback: $15/run       │                                          ║
║                              └─────────────┬───────────────┘                                          ║
║                                            │                                                          ║
║                    ┌───────────────────────┼───────────────────────┐                                  ║
║                    │                       │                       │                                  ║
║                    ▼                       ▼                       ▼                                  ║
║           ┌───────────────┐       ┌───────────────┐       ┌───────────────┐                          ║
║           │ daily >= $100 │       │ daily >= $80  │       │ daily < $80   │                          ║
║           │ HARD LIMIT    │       │ WARNING       │       │ OK            │                          ║
║           └───────┬───────┘       └───────┬───────┘       └───────┬───────┘                          ║
║                   │                       │                       │                                   ║
║                   ▼                       ▼                       │                                   ║
║           ┌───────────────┐       ┌───────────────┐               │                                   ║
║           │ STOP          │       │ Log warning   │               │                                   ║
║           │ can-proceed:  │       │ Continue      │               │                                   ║
║           │ false         │       │               │               │                                   ║
║           └───────────────┘       └───────┬───────┘               │                                   ║
║                   │                       │                       │                                   ║
║                   │                       └───────────────────────┤                                   ║
║                   │                                               │                                   ║
║                   │              (same check for weekly: $500/$400)                                   ║
║                   │                                               │                                   ║
║                   │               ┌───────────────────────────────┘                                   ║
║                   │               │                                                                   ║
║                   │               ▼                                                                   ║
║                   │  ┌─────────────────────────────┐                                                  ║
║                   │  │   JOB 2: check-active-pr    │                                                  ║
║                   │  │   (needs: check-credits)    │                                                  ║
║                   │  │   ─────────────────────     │                                                  ║
║                   │  │   Query GitHub for PRs:     │                                                  ║
║                   │  │   - state: open             │                                                  ║
║                   │  │   - label: tdd-automation   │                                                  ║
║                   │  │   - NOT label: manual-      │                                                  ║
║                   │  │     intervention            │                                                  ║
║                   │  └─────────────┬───────────────┘                                                  ║
║                   │                │                                                                  ║
║                   │    ┌───────────┴───────────┐                                                      ║
║                   │    │                       │                                                      ║
║                   │    ▼                       ▼                                                      ║
║                   │ ┌────────────┐       ┌────────────┐                                               ║
║                   │ │ Active PR  │       │ No active  │                                               ║
║                   │ │ exists     │       │ PR found   │                                               ║
║                   │ └─────┬──────┘       └─────┬──────┘                                               ║
║                   │       │                    │                                                      ║
║                   │       ▼                    │                                                      ║
║                   │ ┌────────────┐             │                                                      ║
║                   │ │ STOP       │             │                                                      ║
║                   │ │ has-active:│             │                                                      ║
║                   │ │ true       │             │                                                      ║
║                   │ │ (wait for  │             │                                                      ║
║                   │ │ current PR)│             │                                                      ║
║                   │ └────────────┘             │                                                      ║
║                   │                            │                                                      ║
║                   │               ┌────────────┘                                                      ║
║                   │               │                                                                   ║
║                   │               ▼                                                                   ║
║                   │  ┌─────────────────────────────┐                                                  ║
║                   │  │   JOB 3: find-spec          │                                                  ║
║                   │  │   (needs: check-active-pr)  │                                                  ║
║                   │  │   ─────────────────────     │                                                  ║
║                   │  │   Run priority calculator:  │                                                  ║
║                   │  │   scripts/tdd-automation/   │                                                  ║
║                   │  │   core/schema-priority-     │                                                  ║
║                   │  │   calculator.ts             │                                                  ║
║                   │  └─────────────┬───────────────┘                                                  ║
║                   │                │                                                                  ║
║                   │    ┌───────────▼───────────┐                                                      ║
║                   │    │ Scan specs/ directory │                                                      ║
║                   │    │ for .fixme() tests    │                                                      ║
║                   │    └───────────┬───────────┘                                                      ║
║                   │                │                                                                  ║
║                   │    ┌───────────┴───────────┐                                                      ║
║                   │    │                       │                                                      ║
║                   │    ▼                       ▼                                                      ║
║                   │ ┌────────────┐       ┌────────────────────┐                                       ║
║                   │ │ No .fixme()│       │ Found .fixme()     │                                       ║
║                   │ │ specs found│       │ Priority order:    │                                       ║
║                   │ └─────┬──────┘       │ 1. Schema deps     │                                       ║
║                   │       │              │ 2. API endpoints   │                                       ║
║                   │       ▼              │ 3. UI components   │                                       ║
║                   │ ┌────────────┐       └─────────┬──────────┘                                       ║
║                   │ │ STOP       │                 │                                                  ║
║                   │ │ All specs  │                 │                                                  ║
║                   │ │ complete!  │                 │                                                  ║
║                   │ └────────────┘                 │                                                  ║
║                   │                                │                                                  ║
║                   │               ┌────────────────┘                                                  ║
║                   │               │                                                                   ║
║                   │               ▼                                                                   ║
║                   │  ┌─────────────────────────────┐                                                  ║
║                   │  │   JOB 4: create-pr          │                                                  ║
║                   │  │   (needs: find-spec)        │                                                  ║
║                   │  └─────────────┬───────────────┘                                                  ║
║                   │                │                                                                  ║
║                   │                ▼                                                                  ║
║                   │  ┌─────────────────────────────┐                                                  ║
║                   │  │ STEP 1: Create branch       │                                                  ║
║                   │  │ git checkout -b tdd/<id>    │                                                  ║
║                   │  │ git push -u origin tdd/<id> │                                                  ║
║                   │  └─────────────┬───────────────┘                                                  ║
║                   │                │                                                                  ║
║                   │                ▼                                                                  ║
║                   │  ┌─────────────────────────────┐                                                  ║
║                   │  │ STEP 2: Create PR           │                                                  ║
║                   │  │ gh pr create                │                                                  ║
║                   │  │ --title "[TDD] Implement    │                                                  ║
║                   │  │   <spec-id> | Attempt 1/5"  │                                                  ║
║                   │  │ --label "tdd-automation"    │                                                  ║
║                   │  │ --base main                 │                                                  ║
║                   │  └─────────────┬───────────────┘                                                  ║
║                   │                │                                                                  ║
║                   │                ▼                                                                  ║
║                   │  ┌─────────────────────────────┐                                                  ║
║                   │  │ STEP 3: Enable auto-merge   │                                                  ║
║                   │  │ gh pr merge --auto --squash │                                                  ║
║                   │  │ <pr-number>                 │                                                  ║
║                   │  └─────────────┬───────────────┘                                                  ║
║                   │                │                                                                  ║
║                   │                │  ← PR CREATED, triggers test.yml via push event                 ║
║                   │                │                                                                  ║
║                   │                ▼                                                                  ║
║  ════════════════════════════════════════════════════════════════════════════════════════════════    ║
║  WORKFLOW 2: TEST (.github/workflows/test.yml)                                                       ║
║  ════════════════════════════════════════════════════════════════════════════════════════════════    ║
║                   │                                                                                   ║
║                   │  ┌─────────────────────────────┐                                                  ║
║                   │  │   JOB: test                 │                                                  ║
║                   │  │   ─────────────────         │                                                  ║
║                   │  │   Triggers: push, PR        │                                                  ║
║                   │  └─────────────┬───────────────┘                                                  ║
║                   │                │                                                                  ║
║                   │                ▼                                                                  ║
║                   │  ┌─────────────────────────────┐                                                  ║
║                   │  │ STEP 1: Detect TDD PR       │                                                  ║
║                   │  │                             │                                                  ║
║                   │  │ Check 1: Has label?         │                                                  ║
║                   │  │   tdd-automation            │                                                  ║
║                   │  │                             │                                                  ║
║                   │  │ Check 2 (backup): Branch?   │                                                  ║
║                   │  │   matches tdd/*             │                                                  ║
║                   │  └─────────────┬───────────────┘                                                  ║
║                   │                │                                                                  ║
║                   │    ┌───────────┴───────────┐                                                      ║
║                   │    │                       │                                                      ║
║                   │    ▼                       ▼                                                      ║
║                   │ ┌────────────┐       ┌────────────┐                                               ║
║                   │ │ NOT TDD PR │       │ IS TDD PR  │                                               ║
║                   │ │ (normal    │       │            │                                               ║
║                   │ │ CI flow)   │       │            │                                               ║
║                   │ └─────┬──────┘       └─────┬──────┘                                               ║
║                   │       │                    │                                                      ║
║                   │       ▼                    ▼                                                      ║
║                   │ ┌────────────┐  ┌─────────────────────────┐                                       ║
║                   │ │ Run tests  │  │ STEP 2: Check sync      │                                       ║
║                   │ │ normally   │  │ Is branch behind main?  │                                       ║
║                   │ │ (no TDD    │  │ git rev-list HEAD..     │                                       ║
║                   │ │ handling)  │  │   origin/main --count   │                                       ║
║                   │ └────────────┘  └───────────┬─────────────┘                                       ║
║                   │                             │                                                     ║
║                   │                 ┌───────────┴───────────┐                                         ║
║                   │                 │                       │                                         ║
║                   │                 ▼                       ▼                                         ║
║                   │          ┌────────────┐          ┌────────────┐                                   ║
║                   │          │ Behind main│          │ Up to date │                                   ║
║                   │          │ (count > 0)│          │ (count = 0)│                                   ║
║                   │          └─────┬──────┘          └─────┬──────┘                                   ║
║                   │                │                       │                                          ║
║                   │                ▼                       │                                          ║
║                   │          ┌────────────────────┐        │                                          ║
║                   │          │ Post sync request  │        │                                          ║
║                   │          │ @claude Sync       │        │                                          ║
║                   │          │ required...        │        │                                          ║
║                   │          │ (NOT counted as    │        │                                          ║
║                   │          │ attempt)           │        │                                          ║
║                   │          └─────┬──────────────┘        │                                          ║
║                   │                │                       │                                          ║
║                   │                │ ──────────────────────┤                                          ║
║                   │                │                       │                                          ║
║                   │                ▼                       ▼                                          ║
║                   │  ┌─────────────────────────────────────────────┐                                  ║
║                   │  │ STEP 3: Run quality + tests                 │                                  ║
║                   │  │                                             │                                  ║
║                   │  │ 1. bun run lint                            │                                  ║
║                   │  │ 2. bun run typecheck                       │                                  ║
║                   │  │ 3. bun test:unit                           │                                  ║
║                   │  │ 4. bun test:e2e -- <spec-file>             │                                  ║
║                   │  │                                             │                                  ║
║                   │  └─────────────┬───────────────────────────────┘                                  ║
║                   │                │                                                                  ║
║                   │    ┌───────────┴───────────────────────┐                                          ║
║                   │    │                   │               │                                          ║
║                   │    ▼                   ▼               ▼                                          ║
║                   │ ┌────────┐       ┌──────────┐    ┌───────────┐                                    ║
║                   │ │ ALL    │       │ TESTS    │    │ QUALITY   │                                    ║
║                   │ │ PASS   │       │ FAIL     │    │ ONLY FAIL │                                    ║
║                   │ └────┬───┘       └────┬─────┘    │ (lint/    │                                    ║
║                   │      │                │          │ typecheck)│                                    ║
║                   │      │                │          └─────┬─────┘                                    ║
║                   │      │                │                │                                          ║
║                   │      ▼                │                │                                          ║
║                   │ ┌────────────┐        │                │                                          ║
║                   │ │ AUTO-MERGE │        │                │                                          ║
║                   │ │ (squash)   │        │                │                                          ║
║                   │ │            │        │                │                                          ║
║                   │ │ PR closes  │        │                │                                          ║
║                   │ │ Label      │        │                │                                          ║
║                   │ │ removed    │        │                │                                          ║
║                   │ │            │        │                │                                          ║
║                   │ │ ► Triggers │        │                │                                          ║
║                   │ │   PR       │        │                │                                          ║
║                   │ │   Creator  │        │                │                                          ║
║                   │ │   (next    │        │                │                                          ║
║                   │ │   spec)    │        │                │                                          ║
║                   │ └────────────┘        │                │                                          ║
║                   │                       │                │                                          ║
║                   │      ┌────────────────┘                │                                          ║
║                   │      │                                 │                                          ║
║                   │      ▼                                 │                                          ║
║                   │ ┌─────────────────────────────┐        │                                          ║
║                   │ │ STEP 4: Parse attempt count │        │                                          ║
║                   │ │                             │        │                                          ║
║                   │ │ Extract from PR title:      │        │                                          ║
║                   │ │ "Attempt X/Y"               │        │                                          ║
║                   │ │                             │        │                                          ║
║                   │ │ Read @tdd-max-attempts from │        │                                          ║
║                   │ │ spec file (default: 5)      │        │                                          ║
║                   │ └─────────────┬───────────────┘        │                                          ║
║                   │               │                        │                                          ║
║                   │   ┌───────────┴───────────┐            │                                          ║
║                   │   │                       │            │                                          ║
║                   │   ▼                       ▼            │                                          ║
║                   │ ┌────────────────┐  ┌────────────────┐ │                                          ║
║                   │ │ attempt < max  │  │ attempt >= max │ │                                          ║
║                   │ │ (e.g., 3 < 5)  │  │ (e.g., 5 >= 5) │ │                                          ║
║                   │ └───────┬────────┘  └───────┬────────┘ │                                          ║
║                   │         │                   │          │                                          ║
║                   │         │                   ▼          │                                          ║
║                   │         │          ┌────────────────────────┐                                     ║
║                   │         │          │ ADD LABEL:             │                                     ║
║                   │         │          │ tdd-automation:        │                                     ║
║                   │         │          │ manual-intervention    │                                     ║
║                   │         │          │                        │                                     ║
║                   │         │          │ Create issue:          │                                     ║
║                   │         │          │ "TDD spec <id> needs   │                                     ║
║                   │         │          │ human review"          │                                     ║
║                   │         │          │                        │                                     ║
║                   │         │          │ STOP (human decides    │                                     ║
║                   │         │          │ next steps)            │                                     ║
║                   │         │          └────────────────────────┘                                     ║
║                   │         │                                                                         ║
║                   │         ▼                                  │                                      ║
║                   │ ┌───────────────────────────────────────┐  │                                      ║
║                   │ │ STEP 5: Update PR title               │  │                                      ║
║                   │ │                                       │  │                                      ║
║                   │ │ gh pr edit <pr-number>               │  │                                      ║
║                   │ │ --title "[TDD] Implement <spec-id>   │  │                                      ║
║                   │ │   | Attempt (X+1)/Y"                 │  │                                      ║
║                   │ └───────────────┬───────────────────────┘  │                                      ║
║                   │                 │                          │                                      ║
║                   │                 ▼                          │                                      ║
║                   │ ┌───────────────────────────────────────┐  │                                      ║
║                   │ │ STEP 6: Post @claude comment          │  │                                      ║
║                   │ │                                       │  │                                      ║
║                   │ │ For TEST FAILURE:                     │◀─┘                                      ║
║                   │ │ ─────────────────                     │ (quality failures also                  ║
║                   │ │ @claude Tests are failing...          │  post @claude but with                  ║
║                   │ │ **Spec:** <spec-id>                   │  different template)                    ║
║                   │ │ **File:** <spec-file-path>            │                                         ║
║                   │ │ **Attempt:** X/Y                      │                                         ║
║                   │ │ **Failure Details:**                  │                                         ║
║                   │ │ <test output>                         │                                         ║
║                   │ │ Please use e2e-test-fixer...          │                                         ║
║                   │ │                                       │                                         ║
║                   │ │ For QUALITY FAILURE:                  │                                         ║
║                   │ │ ────────────────────                  │                                         ║
║                   │ │ @claude Quality checks failing...     │                                         ║
║                   │ │ Please use codebase-refactor-         │                                         ║
║                   │ │ auditor...                            │                                         ║
║                   │ └───────────────┬───────────────────────┘                                         ║
║                   │                 │                                                                 ║
║                   │                 │  ← @claude comment triggers claude-code.yml                     ║
║                   │                 │                                                                 ║
║                   │                 ▼                                                                 ║
║  ════════════════════════════════════════════════════════════════════════════════════════════════    ║
║  WORKFLOW 3: CLAUDE CODE (.github/workflows/claude-code.yml)                                         ║
║  ════════════════════════════════════════════════════════════════════════════════════════════════    ║
║                   │                                                                                   ║
║                   │  ┌─────────────────────────────┐                                                  ║
║                   │  │   JOB: claude-code          │                                                  ║
║                   │  │   ─────────────────         │                                                  ║
║                   │  │   Trigger: issue_comment    │                                                  ║
║                   │  │   containing "@claude"      │                                                  ║
║                   │  └─────────────┬───────────────┘                                                  ║
║                   │                │                                                                  ║
║                   │                ▼                                                                  ║
║                   │  ┌─────────────────────────────┐                                                  ║
║                   │  │ STEP 1: Validate trigger    │                                                  ║
║                   │  │                             │                                                  ║
║                   │  │ Check 1: Comment author is  │                                                  ║
║                   │  │   github-actions[bot]       │                                                  ║
║                   │  │                             │                                                  ║
║                   │  │ Check 2: PR has label       │                                                  ║
║                   │  │   tdd-automation            │                                                  ║
║                   │  │                             │                                                  ║
║                   │  │ Check 3: Credit limits OK   │                                                  ║
║                   │  └─────────────┬───────────────┘                                                  ║
║                   │                │                                                                  ║
║                   │    ┌───────────┴───────────┐                                                      ║
║                   │    │                       │                                                      ║
║                   │    ▼                       ▼                                                      ║
║                   │ ┌────────────┐       ┌────────────┐                                               ║
║                   │ │ Validation │       │ Validation │                                               ║
║                   │ │ FAILED     │       │ PASSED     │                                               ║
║                   │ └─────┬──────┘       └─────┬──────┘                                               ║
║                   │       │                    │                                                      ║
║                   │       ▼                    ▼                                                      ║
║                   │ ┌────────────┐  ┌─────────────────────────┐                                       ║
║                   │ │ STOP       │  │ STEP 2: Checkout PR     │                                       ║
║                   │ │ (ignore    │  │ branch                  │                                       ║
║                   │ │ comment)   │  │                         │                                       ║
║                   │ └────────────┘  │ git checkout tdd/<id>   │                                       ║
║                   │                 └───────────┬─────────────┘                                       ║
║                   │                             │                                                     ║
║                   │                             ▼                                                     ║
║                   │                ┌─────────────────────────┐                                        ║
║                   │                │ STEP 3: Sync with main  │                                        ║
║                   │                │                         │                                        ║
║                   │                │ git fetch origin main   │                                        ║
║                   │                │ git merge origin/main   │                                        ║
║                   │                │   --no-edit             │                                        ║
║                   │                └───────────┬─────────────┘                                        ║
║                   │                            │                                                      ║
║                   │                ┌───────────┴───────────┐                                          ║
║                   │                │                       │                                          ║
║                   │                ▼                       ▼                                          ║
║                   │         ┌────────────┐          ┌────────────┐                                    ║
║                   │         │ MERGE      │          │ NO         │                                    ║
║                   │         │ CONFLICT   │          │ CONFLICT   │                                    ║
║                   │         └─────┬──────┘          └─────┬──────┘                                    ║
║                   │               │                       │                                           ║
║                   │               ▼                       │                                           ║
║                   │         ┌────────────────────┐        │                                           ║
║                   │         │ Add label:         │        │                                           ║
║                   │         │ tdd-automation:    │        │                                           ║
║                   │         │ had-conflict       │        │                                           ║
║                   │         │                    │        │                                           ║
║                   │         │ Disable auto-merge │        │                                           ║
║                   │         │ (human must review │        │                                           ║
║                   │         │ resolution)        │        │                                           ║
║                   │         │                    │        │                                           ║
║                   │         │ Modify prompt to   │        │                                           ║
║                   │         │ include conflict   │        │                                           ║
║                   │         │ resolution         │        │                                           ║
║                   │         │ instructions       │        │                                           ║
║                   │         └─────────┬──────────┘        │                                           ║
║                   │                   │                   │                                           ║
║                   │                   └───────────────────┤                                           ║
║                   │                                       │                                           ║
║                   │                                       ▼                                           ║
║                   │                ┌─────────────────────────────────────┐                            ║
║                   │                │ STEP 4: Select agent based on       │                            ║
║                   │                │ failure type                        │                            ║
║                   │                │                                     │                            ║
║                   │                │ Parse @claude comment to determine: │                            ║
║                   │                └───────────────┬─────────────────────┘                            ║
║                   │                                │                                                  ║
║                   │        ┌───────────────────────┼───────────────────────┐                          ║
║                   │        │                       │                       │                          ║
║                   │        ▼                       ▼                       ▼                          ║
║                   │  ┌───────────┐          ┌───────────┐          ┌───────────┐                      ║
║                   │  │ CONFLICT  │          │ TEST      │          │ QUALITY   │                      ║
║                   │  │ DETECTED  │          │ FAILURE   │          │ ONLY FAIL │                      ║
║                   │  └─────┬─────┘          └─────┬─────┘          └─────┬─────┘                      ║
║                   │        │                      │                      │                            ║
║                   │        ▼                      ▼                      ▼                            ║
║                   │  ┌───────────────┐    ┌───────────────┐    ┌─────────────────────┐                ║
║                   │  │ Prompt:       │    │ Agent:        │    │ Agent:              │                ║
║                   │  │ Resolve       │    │ e2e-test-     │    │ codebase-refactor-  │                ║
║                   │  │ conflicts     │    │ fixer         │    │ auditor             │                ║
║                   │  │ first, then   │    │               │    │                     │                ║
║                   │  │ use selected  │    │ --max-turns   │    │ --max-turns 40      │                ║
║                   │  │ agent         │    │ 50            │    │ --model claude-     │                ║
║                   │  │               │    │ --model       │    │ sonnet-4-5          │                ║
║                   │  │               │    │ claude-       │    │                     │                ║
║                   │  │               │    │ sonnet-4-5    │    │                     │                ║
║                   │  └───────┬───────┘    └───────┬───────┘    └─────────┬───────────┘                ║
║                   │          │                    │                      │                            ║
║                   │          └────────────────────┼──────────────────────┘                            ║
║                   │                               │                                                   ║
║                   │                               ▼                                                   ║
║                   │                ┌─────────────────────────────────────┐                            ║
║                   │                │ STEP 5: Execute Claude Code Action  │                            ║
║                   │                │                                     │                            ║
║                   │                │ uses: anthropics/claude-code-       │                            ║
║                   │                │   action@v1                         │                            ║
║                   │                │ with:                               │                            ║
║                   │                │   claude_code_oauth_token: ${{      │                            ║
║                   │                │     secrets.CLAUDE_CODE_OAUTH_TOKEN │                            ║
║                   │                │   }}                                │                            ║
║                   │                │   track_progress: true              │                            ║
║                   │                │   use_sticky_comment: true          │                            ║
║                   │                │   claude_args: <agent-specific>     │                            ║
║                   │                │   timeout_minutes: ${{ TIMEOUT }}   │  # 45 default, per-spec    ║
║                   │                └───────────────┬─────────────────────┘                            ║
║                   │                                │                                                  ║
║                   │                                ▼                                                  ║
║                   │                ┌─────────────────────────────────────┐                            ║
║                   │                │ AGENT EXECUTION (autonomous)        │                            ║
║                   │                │                                     │                            ║
║                   │                │ 1. Analyze failure                  │                            ║
║                   │                │ 2. Implement fix                    │                            ║
║                   │                │ 3. Run quality + tests locally      │                            ║
║                   │                │ 4. Iterate until pass (max 3        │                            ║
║                   │                │    iterations)                      │                            ║
║                   │                │ 5. Commit changes                   │                            ║
║                   │                │ 6. Push to origin                   │                            ║
║                   │                └───────────────┬─────────────────────┘                            ║
║                   │                                │                                                  ║
║                   │                    ┌───────────┴───────────┐                                      ║
║                   │                    │                       │                                      ║
║                   │                    ▼                       ▼                                      ║
║                   │             ┌────────────┐          ┌────────────┐                                ║
║                   │             │ SUCCESS    │          │ FAILURE    │                                ║
║                   │             │ (pushed    │          │ (timeout,  │                                ║
║                   │             │ changes)   │          │ error, or  │                                ║
║                   │             │            │          │ no fix)    │                                ║
║                   │             └─────┬──────┘          └─────┬──────┘                                ║
║                   │                   │                       │                                       ║
║                   │                   │                       ▼                                       ║
║                   │                   │              ┌────────────────┐                               ║
║                   │                   │              │ Post failure   │                               ║
║                   │                   │              │ comment        │                               ║
║                   │                   │              │ (will trigger  │                               ║
║                   │                   │              │ test.yml which │                               ║
║                   │                   │              │ increments     │                               ║
║                   │                   │              │ attempt)       │                               ║
║                   │                   │              └────────────────┘                               ║
║                   │                   │                                                               ║
║                   │                   │  ← Push triggers test.yml                                     ║
║                   │                   │                                                               ║
║                   │                   ▼                                                               ║
║                   │  ┌─────────────────────────────────────────────────────────────┐                  ║
║                   │  │                         LOOP BACK                            │                  ║
║                   │  │                                                              │                  ║
║                   │  │  Push event → test.yml → pass? → auto-merge                 │                  ║
║                   │  │                           │                                   │                  ║
║                   │  │                           └─► fail? → @claude → claude-code  │                  ║
║                   │  │                                            │                 │                  ║
║                   │  │                                            └──► LOOP        │                  ║
║                   │  │                                                              │                  ║
║                   │  └─────────────────────────────────────────────────────────────┘                  ║
║                   │                                                                                   ║
║  ════════════════════════════════════════════════════════════════════════════════════════════════    ║
║  WORKFLOW 4: MERGE WATCHDOG (.github/workflows/merge-watchdog.yml)                                   ║
║  ════════════════════════════════════════════════════════════════════════════════════════════════    ║
║                                                                                                       ║
║      ┌────────────────────┐                                                                          ║
║      │ TRIGGER: Cron      │                                                                          ║
║      │ Every 30 minutes   │                                                                          ║
║      │ */30 * * * *       │                                                                          ║
║      └─────────┬──────────┘                                                                          ║
║                │                                                                                      ║
║                ▼                                                                                      ║
║      ┌─────────────────────────────┐                                                                 ║
║      │ Query open TDD PRs          │                                                                 ║
║      │ - label: tdd-automation     │                                                                 ║
║      │ - NOT label: manual-        │                                                                 ║
║      │   intervention              │                                                                 ║
║      └─────────────┬───────────────┘                                                                 ║
║                    │                                                                                  ║
║      ┌─────────────┴─────────────┐                                                                   ║
║      │                           │                                                                   ║
║      ▼                           ▼                                                                   ║
║ ┌────────────┐            ┌────────────────────┐                                                     ║
║ │ No stuck   │            │ Found stuck PR:    │                                                     ║
║ │ PRs        │            │ - Open > 2 hours   │                                                     ║
║ │            │            │ - All checks pass  │                                                     ║
║ │ (normal    │            │ - Auto-merge not   │                                                     ║
║ │ operation) │            │   completing       │                                                     ║
║ └────────────┘            └─────────┬──────────┘                                                     ║
║                                     │                                                                ║
║                         ┌───────────┴───────────┐                                                    ║
║                         │                       │                                                    ║
║                         ▼                       ▼                                                    ║
║                  ┌────────────┐          ┌────────────────┐                                          ║
║                  │ Open < 4h  │          │ Open > 4 hours │                                          ║
║                  │            │          │                │                                          ║
║                  │ Log warning│          │ Create alert   │                                          ║
║                  │ only       │          │ issue          │                                          ║
║                  │            │          │                │                                          ║
║                  │ Try re-    │          │ Request human  │                                          ║
║                  │ enable     │          │ investigation  │                                          ║
║                  │ auto-merge │          │                │                                          ║
║                  └────────────┘          └────────────────┘                                          ║
║                                                                                                       ║
╚══════════════════════════════════════════════════════════════════════════════════════════════════════╝
```

---

#### Workflow Interconnection Diagram

Shows how the 4 workflows communicate via GitHub events:

```
┌───────────────────────────────────────────────────────────────────────────────────────────┐
│                             WORKFLOW INTERCONNECTIONS                                      │
│                             ════════════════════════                                       │
│                                                                                           │
│  ┌───────────────┐                                                                        │
│  │               │                                                                        │
│  │  PR CREATOR   │──────────────────────────────────────────────────────────────┐        │
│  │               │                                                               │        │
│  └───────┬───────┘                                                               │        │
│          │                                                                       │        │
│          │ Creates PR with tdd-automation label                                  │        │
│          │ Pushes to tdd/<spec-id> branch                                        │        │
│          │                                                                       │        │
│          │ ◀─────────────────────────────────────────────────────────────────────┤        │
│          │   workflow_run: test.yml success on main                              │        │
│          │                                                                       │        │
│          ▼                                                                       │        │
│  ┌───────────────┐                                                               │        │
│  │               │                                                               │        │
│  │     TEST      │◀──────────────────────────────────────────────────┐           │        │
│  │               │                                                    │           │        │
│  └───────┬───────┘                                                    │           │        │
│          │                                                            │           │        │
│          │ On failure:                                                │           │        │
│          │ - Updates PR title (Attempt X+1/Y)                         │           │        │
│          │ - Posts @claude comment                                    │           │        │
│          │                                                            │           │        │
│          │ On success:                                                │           │        │
│          │ - Auto-merge triggers                                      │           │        │
│          │ - Triggers PR Creator (workflow_run)                       ────────────┘        │
│          │                                                                                │
│          ▼                                                                                │
│  ┌───────────────┐                                                                        │
│  │               │                                                                        │
│  │  CLAUDE CODE  │                                                                        │
│  │               │                                                                        │
│  └───────┬───────┘                                                                        │
│          │                                                                                │
│          │ On success:                                                                    │
│          │ - Commits and pushes changes                                                   │
│          │ - Push event triggers TEST workflow ──────────────────────────────────────────┘│
│          │                                                                                │
│          │ On merge conflict:                                                             │
│          │ - Adds had-conflict label                                                      │
│          │ - Disables auto-merge (human review required)                                  │
│          │                                                                                │
│          │                                                                                │
│  ┌───────▼───────┐                                                                        │
│  │               │                                                                        │
│  │MERGE WATCHDOG │  (independent, runs every 30 min)                                      │
│  │               │                                                                        │
│  └───────────────┘                                                                        │
│          │                                                                                │
│          │ Monitors for stuck PRs                                                         │
│          │ Creates alert issues if stuck > 4 hours                                        │
│                                                                                           │
└───────────────────────────────────────────────────────────────────────────────────────────┘
```

---

#### Complete Spec Lifecycle (Single Spec Journey)

```
SPEC LIFECYCLE: From .fixme() to Merged
═══════════════════════════════════════

Timeline ──────────────────────────────────────────────────────────────────────────────────►

┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐
│ STATE 0 │──▶│ STATE 1 │──▶│ STATE 2 │──▶│ STATE 3 │──▶│ STATE 4 │──▶│ STATE 5 │──▶│ STATE 6 │
│         │   │         │   │         │   │         │   │         │   │         │   │         │
│.fixme() │   │ PR      │   │ Tests   │   │ @claude │   │ Agent   │   │ Tests   │   │ Merged  │
│ in spec │   │ Created │   │ Running │   │ Posted  │   │ Fixing  │   │ Pass    │   │ to Main │
└─────────┘   └─────────┘   └─────────┘   └─────────┘   └─────────┘   └─────────┘   └─────────┘
     │             │             │             │             │             │             │
     │             │             │             │             │             │             │
     ▼             ▼             ▼             ▼             ▼             ▼             ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                             │
│  Spec file:      Branch:        test.yml:      test.yml:      claude-code:   test.yml:    │
│  specs/api/      tdd/API-       Triggered      Posts          Agent runs     Detects      │
│  tables/         TABLES-        by push        @claude        autonomously   all pass     │
│  create.spec.ts  CREATE-001     event          comment        for ~45 min    Auto-merge   │
│                                                                              squash       │
│  test.fixme(     PR Title:      Runs:          Comment:       Outputs:       PR closes    │
│    'creates      [TDD]          - lint         @claude        - Analysis     Label        │
│    table'        Implement      - typecheck    Tests fail...  - Code fix     removed      │
│  )               API-TABLES-    - unit         Spec: ...      - Tests        Next spec    │
│                  CREATE-001     - e2e spec     Attempt: 1/5   - Commit       begins       │
│                  | Attempt 1/5                 Please use...  - Push                      │
│                                                                                             │
│                  Label:                        Title update:                               │
│                  tdd-automation                [TDD]...|                                  │
│                                                Attempt 2/5                                │
│                                                                                             │
└─────────────────────────────────────────────────────────────────────────────────────────────┘

FAILURE PATH (up to 5 attempts):
═══════════════════════════════

    STATE 3 ──▶ STATE 4 ──▶ STATE 2 ──▶ STATE 3 ──▶ STATE 4 ──▶ STATE 2 ...
       │          │          │          │          │          │
       │          │          │          │          │          │
       ▼          ▼          ▼          ▼          ▼          ▼
   Attempt 1   Agent 1    Tests 1    Attempt 2   Agent 2    Tests 2   ...until pass or 5 fails
   @claude     Fixes      Still      @claude     Fixes      Still
   posted      pushed     fail       posted      pushed     fail

TERMINAL STATES:
════════════════

┌─────────────────────────┐       ┌─────────────────────────┐
│ SUCCESS (STATE 6)       │       │ MANUAL INTERVENTION     │
│                         │       │                         │
│ - Tests pass            │       │ - 5 attempts failed     │
│ - Auto-merge completes  │       │ - Label added:          │
│ - PR closes             │       │   tdd-automation:       │
│ - Label removed         │       │   manual-intervention   │
│ - Next spec begins      │       │ - Human review needed   │
│                         │       │ - Pipeline continues    │
│                         │       │   with next spec        │
└─────────────────────────┘       └─────────────────────────┘
```

---

## Workflow Specifications

### 1. PR Creator Workflow

**File:** `.github/workflows/pr-creator.yml`

**Triggers:**

- `workflow_run`: After successful `test.yml` on `main` (chain reaction)
- `schedule`: Every hour (`0 * * * *`) - backup
- `workflow_dispatch`: Manual trigger

**Pre-conditions (all must be true):**

1. Credit usage within limits (daily < $100, weekly < $500)
2. No active TDD PR without `manual-intervention` label
3. At least one `.fixme()` spec exists

**Jobs:**

| Job               | Purpose                                | Outputs                        |
| ----------------- | -------------------------------------- | ------------------------------ |
| `check-credits`   | Verify Claude Code spend within limits | `can-proceed`, `daily-spend`   |
| `check-active-pr` | Ensure no other TDD PR is processing   | `has-active`                   |
| `create-pr`       | Find next spec → create branch → PR    | PR with `tdd-automation` label |

> **Note**: The diagram shows `find-spec` as a logical step (JOB 3). In implementation, it's a step within the `create-pr` job to simplify job output passing. The 4 logical steps in the diagram map to 3 GitHub Actions jobs.

**Spec Selection Logic (within create-pr job):**

1. Run `scripts/tdd-automation/core/schema-priority-calculator.ts`
2. Exclude specs in `manual-intervention` PRs
3. Extract per-spec config (`@tdd-max-attempts`, `@tdd-timeout`)

**PR Creation:**

- Branch: `tdd/<spec-id>`
- Title: `[TDD] Implement <spec-id> | Attempt 1/5`
- Label: `tdd-automation`
- Auto-merge: Enabled (squash)

---

### 2. Test Workflow

**File:** `.github/workflows/test.yml`

**Triggers:**

- `push`: Any branch
- `pull_request`: Any PR

**TDD-Specific Behavior:**

| Condition                    | Action                                             |
| ---------------------------- | -------------------------------------------------- |
| TDD PR detected              | Identify via label OR branch name `tdd/*`          |
| PR is behind main            | Post sync request comment (not counted as attempt) |
| Tests fail (attempts < max)  | Post `@claude` comment with failure details        |
| Tests fail (attempts >= max) | Add `tdd-automation:manual-intervention` label     |
| Tests pass                   | Auto-merge proceeds                                |

**Attempt Counting:**

- Read from PR title: `Attempt X/Y`
- Increment ONLY on **test failure** (E2E assertions fail)
- Do NOT count toward attempts (still triggers @claude):
  - **Sync requests**: Branch needs update from main
  - **Quality-only failures**: Lint/typecheck fail but tests pass (uses refactor-auditor agent)
  - **Infrastructure errors**: Network timeouts, GitHub API errors, CI runner issues
  - **Merge conflicts**: Resolution doesn't burn an attempt

**Rationale**: Attempts track "implementation tries", not "pipeline runs". Quality fixes are refinement, not core implementation.

**@claude Comment Format:**

```
@claude Tests are failing for this TDD PR.

**Spec:** <spec-id>
**File:** <spec-file-path>
**Attempt:** X/Y

**Failure Details:**
<test output>

Please use the e2e-test-fixer agent to implement the minimal code changes needed to make this test pass.
```

---

### 3. Claude Code Workflow

**File:** `.github/workflows/claude-code.yml`

**Triggers:**

- `issue_comment`: When comment contains `@claude` on TDD PR

**Pre-conditions:**

1. Comment author is `github-actions[bot]`
2. PR has `tdd-automation` label
3. Credit limits not exceeded

**Execution Flow:**

| Step               | Action                                             |
| ------------------ | -------------------------------------------------- |
| 1. Validate        | Check commenter, label, credits                    |
| 2. Sync            | `git fetch && git merge origin/main`               |
| 3. Detect conflict | If conflict → add label, modify prompt             |
| 4. Execute action  | Run `anthropics/claude-code-action@v1`             |
| 5. Handle result   | Push changes if any, update PR title attempt count |

**Agent Selection (via prompt):**

| Condition            | Agent                       | Focus                        |
| -------------------- | --------------------------- | ---------------------------- |
| Merge conflict       | Conflict resolution         | Fix markers, test resolution |
| Test failure         | `e2e-test-fixer`            | Minimal code to pass tests   |
| Quality failure only | `codebase-refactor-auditor` | Code quality improvements    |

**Conflict Handling:**

- Add `tdd-automation:had-conflict` label
- Disable auto-merge until human reviews
- Include conflict resolution instructions in prompt

---

### 4. Merge Watchdog Workflow

**File:** `.github/workflows/merge-watchdog.yml`

**Triggers:**

- `schedule`: Every 30 minutes (`*/30 * * * *`)

**Purpose:** Detect and alert on stuck PRs that should have auto-merged.

**Detection Criteria:**

- PR has `tdd-automation` label
- PR is open for > 2 hours
- All checks passing
- Auto-merge not completing

**Actions:**

1. Log warning with PR details
2. Create alert issue if stuck > 4 hours
3. Optionally re-enable auto-merge

---

## State Management

### Label State Machine

```
┌──────────────────┐
│  No TDD PR open  │ ◀────────────────────────────────────┐
│  (idle state)    │                                      │
└────────┬─────────┘                                      │
         │ PR Creator creates PR                          │
         ▼                                                │
┌──────────────────┐                                      │
│ tdd-automation   │ ◀──────────────┐                     │
│ (active)         │                │                     │
└────────┬─────────┘                │                     │
         │                          │                     │
         ├── Tests pass ────────────┼────► Auto-merge ────┘
         │                          │
         ├── Tests fail (<5) ───────┤
         │   Post @claude           │
         │   Claude fixes           │
         │   Push triggers tests ───┘
         │
         └── Tests fail (>=5) ──────┐
                                    ▼
                          ┌──────────────────────┐
                          │ manual-intervention  │
                          │ (needs human)        │
                          └──────────────────────┘
```

### Branch Name as Backup ID

If labels are accidentally removed, the branch name `tdd/<spec-id>` serves as a backup identifier to:

1. Restore the `tdd-automation` label
2. Associate the PR with its spec

---

## Cost Protection

### Credit Check Points

Credit limits are checked at **two points** for defense-in-depth:

| Workflow    | When Checked               | If Limit Exceeded               |
| ----------- | -------------------------- | ------------------------------- |
| PR Creator  | Before creating new TDD PR | Skips PR creation, logs warning |
| Claude Code | Before executing agent     | Skips execution, comments on PR |

**Rationale**: Double-checking prevents runaway costs if one workflow misbehaves.

### Credit Tracking

**Calculation:**

1. Query `claude-code.yml` workflow runs from past 24h/7d
2. Parse cost from logs using multiple patterns
3. Sum all successful run costs
4. Compare against thresholds

**Cost Patterns (tried in order, first match wins):**

| Priority | Pattern                  | Example Match            | Notes                       |
| -------- | ------------------------ | ------------------------ | --------------------------- |
| 1        | `Total cost: $X.XX`      | `Total cost: $12.34`     | Claude Code action format   |
| 2        | `Cost: $X.XX`            | `Cost: $5.67`            | Alternative short format    |
| 3        | `Session cost: X.XX USD` | `Session cost: 8.90 USD` | Legacy format (no $ prefix) |

**Fallback:** $15/run if all patterns fail to match (+ creates GitHub issue for investigation)

### Thresholds

| Check  | Warning | Hard Limit | Action             |
| ------ | ------- | ---------- | ------------------ |
| Daily  | $80     | $100       | Log warning / Skip |
| Weekly | $400    | $500       | Log warning / Skip |

---

## Implementation Plan

### Phase 1: Core Infrastructure (Days 1-2)

| Task                     | File                                                        | Acceptance Criteria                                                 |
| ------------------------ | ----------------------------------------------------------- | ------------------------------------------------------------------- |
| 1.1 Create PR Creator    | `.github/workflows/pr-creator.yml`                          | Finds `.fixme()` specs, creates PRs, adds label, enables auto-merge |
| 1.2 Create credit check  | `scripts/tdd-automation/programs/check-credit-limits.ts`    | Parses logs, returns spend, has fallback (see Effect Architecture)  |
| 1.3 Create Watchdog      | `.github/workflows/merge-watchdog.yml`                      | Runs every 30 min, detects stuck PRs                                |
| 1.4 Update priority calc | `scripts/tdd-automation/core/schema-priority-calculator.ts` | Returns spec-id, supports `--exclude`                               |

### Phase 2: Test Workflow Integration (Days 3-4)

| Task                     | File                         | Acceptance Criteria                      |
| ------------------------ | ---------------------------- | ---------------------------------------- |
| 2.1 Add TDD detection    | `.github/workflows/test.yml` | Detects via label OR branch name         |
| 2.2 Add change detection | `.github/workflows/test.yml` | Identifies fixme-only changes            |
| 2.3 Add failure handling | `.github/workflows/test.yml` | Reads/increments attempts, posts @claude |
| 2.4 Add sync check       | `.github/workflows/test.yml` | Checks if behind main                    |

### Phase 3: Claude Code Workflow (Days 5-6)

**Prerequisites:**

- Add `CLAUDE_CODE_OAUTH_TOKEN` to repository secrets

| Task                 | File                                | Acceptance Criteria                                          |
| -------------------- | ----------------------------------- | ------------------------------------------------------------ |
| 3.1 Create workflow  | `.github/workflows/claude-code.yml` | Uses `anthropics/claude-code-action@v1`, triggers on @claude |
| 3.2 Add sync logic   | `.github/workflows/claude-code.yml` | Fetches main, detects conflicts                              |
| 3.3 Configure action | `.github/workflows/claude-code.yml` | `track_progress: true`, `use_sticky_comment: true`           |
| 3.4 Add prompts      | `.github/workflows/claude-code.yml` | Conflict, e2e-test-fixer, refactor prompts                   |

### Phase 4: Production Launch (Days 7-8)

**Go-Live Checklist:**

- [ ] `CLAUDE_CODE_OAUTH_TOKEN` secret configured
- [ ] All workflows created and tested
- [ ] Credit limits verified working
- [ ] Watchdog creating alerts correctly
- [ ] First 5 specs processed successfully

### Files Summary

**New Files:**

```
.github/workflows/pr-creator.yml
.github/workflows/merge-watchdog.yml
.github/workflows/claude-code.yml
scripts/tdd-automation/programs/check-credit-limits.ts
scripts/tdd-automation/services/  (see Effect Architecture for full list)
```

**Modified Files:**

```
.github/workflows/test.yml
scripts/tdd-automation/core/schema-priority-calculator.ts
```

---

## Risks & Mitigations

| Risk                   | Mitigation                                           | Confidence   |
| ---------------------- | ---------------------------------------------------- | ------------ |
| Serial processing time | Chain reaction triggers, fast-path for passing tests | ✅ ~6-8 days |

**Timeline Math Explanation:**

- **Worst-case ceiling**: 230 specs × 2h/spec = 460h (if every spec maxed out)
- **Realistic estimate**: ~6-8 calendar days because:
  - Many specs pass with trivial implementation (<15 min)
  - Chain reaction triggers eliminate 1h cron wait between specs
  - Fast-path: passing tests trigger immediate next PR creation
  - Average ~45 min/spec realistic (230 × 0.75h = 172h = ~7 days)
    | Cost parsing fragility | Multi-pattern + $15 fallback + alert issues | ✅ High |
    | Merge conflict quality | Flag label + human review gate | ✅ High |
    | Comment-based retry counting | PR title-based (immutable) | ✅ High |
    | GitHub API rate limits | Exponential backoff | ✅ High |
    | Auto-merge stuck PRs | Watchdog every 30 min | ✅ High |
    | Claude Code hangs | Job timeout + action's built-in progress tracking | ✅ High |
    | Infrastructure failures | Classification + auto-retry (no count) | ✅ High |
    | Long-running specs | Per-spec `@tdd-max-attempts`, `@tdd-timeout` | ✅ High |
    | Label accidents | Branch name as backup identifier | ✅ High |

---

## Design Decisions

| Decision               | Choice                                                    | Rationale                                            |
| ---------------------- | --------------------------------------------------------- | ---------------------------------------------------- |
| Cron frequency         | Hourly (backup only)                                      | Chain reaction via `workflow_run` handles most cases |
| Max attempts           | 5 (default, configurable)                                 | Increased from 3 for 230-spec reliability            |
| Label names            | `tdd-automation`, `:manual-intervention`, `:had-conflict` | Clear, consistent naming                             |
| Branch naming          | `tdd/<spec-id>`                                           | Simple, serves as backup identifier                  |
| @claude comment format | Agent-specific with file paths                            | Enables correct agent selection                      |
| Credit limits          | $100/day, $500/week                                       | Conservative limits with 80% warnings                |
| Cost parsing           | Multi-pattern + fallback                                  | Handles format changes gracefully                    |
| Sync strategy          | Merge (not rebase)                                        | Safer, no force-push, better for automation          |
| Conflict counting      | Not counted as attempt                                    | Infrastructure issue, not code failure               |

---

## Per-Spec Configuration

Specs can include inline configuration via comments:

```typescript
// @tdd-max-attempts 8   // Override default 5 attempts
// @tdd-timeout 60       // Override default 45 min timeout
test.fixme('Complex integration test', async () => {
  // ...
})
```

---

## Comment Templates

### Sync Request (Test Workflow → Claude)

```
@claude Sync required: The main branch has been updated.

Please:
1. Merge origin/main into this branch
2. Resolve any merge conflicts
3. Run quality checks after merging
4. Commit and push the merge result
```

### Test Failure (Test Workflow → Claude)

```
@claude Tests are failing for this TDD PR.

**Spec:** <spec-id>
**File:** <spec-file-path>
**Attempt:** X/Y

**Failure Details:**
<test output>

Please use the e2e-test-fixer agent to implement the minimal code changes needed.
```

### Conflict Resolution (Claude Code)

```
Conflict detected in files:
- <file-list>

Resolve ALL merge conflicts before proceeding:
1. Understand what both sides intended
2. Choose correct resolution
3. Remove all conflict markers
4. Test the resolution works
```

---

## Effect-Based Implementation Architecture

### Architecture Principle

**YAML for Orchestration Only, TypeScript + Effect for All Logic**

The TDD automation pipeline follows a strict separation of concerns:

| Layer              | Responsibility                                                   | Technology             |
| ------------------ | ---------------------------------------------------------------- | ---------------------- |
| **Orchestration**  | Workflow triggers, job sequencing, GitHub event handling         | GitHub Actions YAML    |
| **Business Logic** | Credit calculation, spec scanning, PR management, error handling | TypeScript + Effect.ts |

**Why This Separation?**

| Bash-in-YAML (Current)              | Effect-Based (Target)                       |
| ----------------------------------- | ------------------------------------------- |
| ❌ Hard to test                     | ✅ Fully unit-testable                      |
| ❌ Complex error handling           | ✅ Type-safe errors with `Data.TaggedError` |
| ❌ Duplicated code across workflows | ✅ Shared services and programs             |
| ❌ Fragile string parsing           | ✅ Effect Schema for validation             |
| ❌ No IDE support                   | ✅ Full TypeScript IntelliSense             |
| ❌ Hidden bugs in grep/sed          | ✅ Compile-time type checking               |
| ❌ Hard to refactor                 | ✅ Safe refactoring with types              |

---

### Directory Structure

```
scripts/tdd-automation/
├── core/                              # EXISTING - Domain types and utilities
│   ├── types.ts                       # ✓ TDDPRTitle, TDDPullRequest, ReadySpec, etc.
│   ├── errors.ts                      # NEW: Effect error types
│   ├── config.ts                      # NEW: TDD_CONFIG as Effect Config
│   ├── schema-priority-calculator.ts  # ✓ Pure functions for spec priority
│   ├── parse-pr-title.ts              # ✓ Parse attempt count from PR title
│   ├── update-pr-title.ts             # ✓ Generate updated PR title
│   ├── find-ready-spec.ts             # ✓ Find next spec to process
│   └── spec-scanner.ts                # ✓ Scan for .fixme() specs
│
├── services/                          # NEW: Effect service interfaces
│   ├── github-api.ts                  # GitHub API service interface
│   ├── github-api.live.ts             # Live implementation (gh CLI)
│   ├── github-api.test.ts             # Mock implementation for tests
│   ├── git-operations.ts              # Git operations service
│   ├── git-operations.live.ts
│   ├── cost-tracker.ts                # Credit tracking service
│   └── cost-tracker.live.ts
│
├── programs/                          # NEW: Effect programs (composable)
│   ├── check-credit-limits.ts         # Credit limit checking program
│   ├── find-active-tdd-pr.ts          # Find active PR program
│   ├── create-tdd-pr.ts               # PR creation program
│   ├── sync-with-main.ts              # Branch sync program
│   ├── detect-merge-conflicts.ts      # Conflict detection program
│   └── increment-attempt.ts           # Attempt counter program
│
├── workflows/                         # NEW: CLI entry points for YAML
│   ├── pr-creator/
│   │   ├── check-credits.ts           # Entry: bun run scripts/tdd-automation/workflows/pr-creator/check-credits.ts
│   │   ├── check-active-pr.ts
│   │   ├── find-next-spec.ts
│   │   └── create-pr.ts
│   ├── test/
│   │   ├── detect-tdd-pr.ts
│   │   ├── check-sync-status.ts
│   │   └── handle-failure.ts
│   ├── claude-code/
│   │   ├── validate-trigger.ts
│   │   ├── sync-branch.ts
│   │   └── select-agent.ts
│   └── merge-watchdog/
│       └── check-stuck-prs.ts
│
└── layers/                            # NEW: Effect dependency injection
    ├── live.ts                        # Production layer (real APIs)
    └── test.ts                        # Test layer (mocks)
```

---

### Effect Error Types

All TDD automation errors are modeled as `Data.TaggedError` for type-safe error handling.

**Implementation:** `scripts/tdd-automation/core/errors.ts`

**Error Types:**

| Error                 | Purpose                             | Key Fields                           |
| --------------------- | ----------------------------------- | ------------------------------------ |
| `CreditLimitExceeded` | Daily or weekly cost limit exceeded | `dailySpend`, `weeklySpend`, `limit` |
| `CostParsingFailed`   | Cost extraction from logs failed    | `runId`, `rawLog`                    |
| `ActiveTDDPRExists`   | Serial processing violation         | `prNumber`, `specId`                 |
| `NoPendingSpecs`      | No `.fixme()` specs available       | `message`                            |
| `MergeConflict`       | Merge conflict detected during sync | `branch`, `conflictingFiles`         |
| `MaxAttemptsReached`  | 5 attempts exhausted                | `specId`, `attempts`, `maxAttempts`  |
| `GitHubApiError`      | GitHub API operation failed         | `operation`, `cause`                 |
| `GitOperationError`   | Git CLI command failed              | `operation`, `stderr`                |

---

### Effect Service Interfaces

Services abstract external dependencies for testability using Effect's `Context.Tag` pattern.

**Implementations:**

| Service         | File                                                | Purpose                        |
| --------------- | --------------------------------------------------- | ------------------------------ |
| `GitHubApi`     | `scripts/tdd-automation/services/github-api.ts`     | GitHub API operations (gh CLI) |
| `GitOperations` | `scripts/tdd-automation/services/git-operations.ts` | Git CLI operations             |
| `CostTracker`   | `scripts/tdd-automation/services/cost-tracker.ts`   | Cost parsing from logs         |

**GitHubApi Service Methods:**

- `listTDDPRs()` - List open PRs with `tdd-automation` label
- `getPR(prNumber)` - Get PR details by number
- `getWorkflowRuns(params)` - Get workflow runs for cost calculation
- `getRunLogs(runId)` - Get workflow run logs for cost parsing
- `createPR(params)` - Create a new PR
- `updatePRTitle(prNumber, title)` - Update PR title
- `addLabel(prNumber, label)` - Add label to PR
- `postComment(prNumber, body)` - Post comment on PR
- `enableAutoMerge(prNumber, mergeMethod)` - Enable auto-merge

**GitOperations Service Methods:**

- `getCurrentBranch()` - Get current branch name
- `createBranch(name, baseBranch)` - Create new branch
- `checkout(branch)` - Checkout branch
- `branchExists(branch)` - Check if branch exists
- `fetch(remote)` - Fetch from remote
- `rebase(upstream)` - Rebase onto upstream
- `push(remote, branch, force)` - Push to remote
- `getBranchStatus(branch)` - Get sync status with main
- `checkConflicts(branch)` - Check for merge conflicts

---

### Effect Programs (Composable Business Logic)

Programs compose services to implement business logic using `Effect.gen`.

**Implementations:**

| Program                | File                                                        | Purpose                           |
| ---------------------- | ----------------------------------------------------------- | --------------------------------- |
| `checkCreditLimits`    | `scripts/tdd-automation/programs/check-credit-limits.ts`    | Verify daily/weekly spend limits  |
| `findActiveTDDPR`      | `scripts/tdd-automation/programs/find-active-tdd-pr.ts`     | Find active TDD PR (serial check) |
| `createTDDPR`          | `scripts/tdd-automation/programs/create-tdd-pr.ts`          | Create new TDD PR with setup      |
| `syncWithMain`         | `scripts/tdd-automation/programs/sync-with-main.ts`         | Sync branch with main via rebase  |
| `detectMergeConflicts` | `scripts/tdd-automation/programs/detect-merge-conflicts.ts` | Detect conflicts without modify   |
| `incrementAttempt`     | `scripts/tdd-automation/programs/increment-attempt.ts`      | Increment PR title attempt count  |

**Program Pattern:**

```typescript
// Each program follows this pattern:
export const programName = Effect.gen(function* () {
  const service = yield* ServiceTag // Inject dependencies
  const result = yield* service.method() // Call service methods
  return result // Return typed result
}).pipe(Effect.catchTag('ErrorType', handler)) // Handle specific errors
```

---

### YAML Transformation (Before/After)

**Before (Bash in YAML - 150+ lines):**

```yaml
# .github/workflows/pr-creator.yml (CURRENT)
- name: Check Claude Code credit usage
  id: check
  env:
    GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  run: |
    # Get runs from past 24 hours
    DAILY_RUNS=$(gh run list --workflow="claude-code.yml" \
      --created ">$(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%SZ)" \
      --json databaseId,conclusion --jq '[.[] | select(.conclusion == "success")]' 2>/dev/null || echo "[]")

    DAILY_SPEND=0
    while IFS= read -r RUN_ID; do
      [ -z "$RUN_ID" ] && continue
      # Multi-pattern cost extraction with fallback
      COST=$(gh run view "$RUN_ID" --log 2>/dev/null | \
        grep -oP '(Total cost: \$|Cost: \$|Session cost: \$)(\K[0-9]+\.[0-9]+)' | head -1 || echo "")

      if [ -z "$COST" ]; then
        echo "::warning::Cost parsing failed for run $RUN_ID - using fallback \$15"
        COST=15
        echo "used-fallback=true" >> "$GITHUB_OUTPUT"
      fi
      DAILY_SPEND=$(echo "$DAILY_SPEND + $COST" | bc)
    done < <(echo "$DAILY_RUNS" | jq -r '.[].databaseId')
    # ... 80+ more lines of bash
```

**After (Effect-based - ~10 lines in YAML):**

```yaml
# .github/workflows/pr-creator.yml (TARGET)
jobs:
  check-credits:
    runs-on: ubuntu-latest
    outputs:
      can-proceed: ${{ steps.check.outputs.can-proceed }}
      daily-spend: ${{ steps.check.outputs.daily-spend }}
      weekly-spend: ${{ steps.check.outputs.weekly-spend }}
    steps:
      - uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version-file: package.json

      - name: Check credit limits
        id: check
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          RESULT=$(bun run scripts/tdd-automation/workflows/pr-creator/check-credits.ts)
          echo "can-proceed=$(echo "$RESULT" | jq -r '.canProceed')" >> "$GITHUB_OUTPUT"
          echo "daily-spend=$(echo "$RESULT" | jq -r '.dailySpend')" >> "$GITHUB_OUTPUT"
          echo "weekly-spend=$(echo "$RESULT" | jq -r '.weeklySpend')" >> "$GITHUB_OUTPUT"
```

**CLI Entry Point:**

```typescript
// scripts/tdd-automation/workflows/pr-creator/check-credits.ts
import { Effect, Console } from 'effect'
import { checkCreditLimits } from '../../programs/check-credit-limits'
import { LiveLayer } from '../../layers/live'

const main = Effect.gen(function* () {
  const result = yield* checkCreditLimits

  // Log warnings to GitHub Actions
  for (const warning of result.warnings) {
    yield* Console.warn(`::warning::${warning}`)
  }

  // Output JSON for YAML to parse
  yield* Console.log(JSON.stringify(result))
}).pipe(
  Effect.catchTag('CreditLimitExceeded', (error) =>
    Effect.gen(function* () {
      yield* Console.error(`::error::Credit limit exceeded: ${error.limit}`)
      yield* Console.log(
        JSON.stringify({
          canProceed: false,
          dailySpend: error.dailySpend,
          weeklySpend: error.weeklySpend,
          warnings: [],
        })
      )
    })
  ),
  Effect.provide(LiveLayer)
)

Effect.runPromise(main)
```

---

### Layer Composition (Dependency Injection)

**Implementations:**

| Layer       | File                                    | Purpose                       |
| ----------- | --------------------------------------- | ----------------------------- |
| `LiveLayer` | `scripts/tdd-automation/layers/live.ts` | Production layer (real APIs)  |
| `TestLayer` | `scripts/tdd-automation/layers/test.ts` | Test layer with mock services |

**Live Layer Services:**

- `GitHubApiLive` - GitHub CLI (`gh`) operations
- `GitOperationsLive` - Git CLI operations
- `CostTrackerLive` - Cost parsing from workflow logs

**Test Layer Features:**

- `createTestLayer(options)` - Factory for customized test layers
- Default mocks for all services
- Configurable mock responses for `mockCost`, `mockPRs`, `mockRuns`, `mockBranchStatus`, `mockConflictInfo`

**Usage Pattern:**

```typescript
// Production
const result = await Effect.runPromise(program.pipe(Effect.provide(LiveLayer)))

// Testing with custom mocks
const testLayer = createTestLayer({
  mockCost: 10,
  mockPRs: [{ number: 1, specId: 'TEST-001', ... }],
})
const result = await Effect.runPromise(program.pipe(Effect.provide(testLayer)))
```

---

### Implementation Status

| Phase                 | Status         | Files                                                                              |
| --------------------- | -------------- | ---------------------------------------------------------------------------------- |
| **1. Core Types**     | ✅ Complete    | `core/types.ts`, `core/config.ts`, `core/errors.ts`                                |
| **2. Services**       | ✅ Complete    | `services/github-api.ts`, `services/git-operations.ts`, `services/cost-tracker.ts` |
| **3. Programs**       | ✅ Complete    | `programs/*.ts` (6 programs)                                                       |
| **4. Entry Points**   | ✅ Complete    | `workflows/**/*.ts` (10 CLI scripts)                                               |
| **5. Layers**         | ✅ Complete    | `layers/live.ts`, `layers/test.ts`                                                 |
| **6. YAML Migration** | 🔄 In Progress | `.github/workflows/*.yml`                                                          |
| **7. Testing**        | ⏳ Pending     | `**/*.test.ts`                                                                     |

---

### Benefits Summary

| Aspect             | Bash-in-YAML        | Effect-Based                        |
| ------------------ | ------------------- | ----------------------------------- |
| **Testability**    | Manual testing only | Full unit test coverage             |
| **Type Safety**    | None                | Full TypeScript inference           |
| **Error Handling** | Exit codes + grep   | Tagged errors with recovery         |
| **Debugging**      | `echo` statements   | Effect DevTools, structured logging |
| **Reusability**    | Copy-paste          | Composable services                 |
| **Refactoring**    | Risky               | Safe with compiler checks           |
| **IDE Support**    | None                | Full autocomplete, go-to-definition |
| **Code Review**    | Hard to verify      | Easy to reason about                |
| **Maintenance**    | Fragile             | Robust and scalable                 |
