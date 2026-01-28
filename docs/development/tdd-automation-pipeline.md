# TDD Automation Pipeline - Specification

> **Document Purpose**: Workflow specification and source of truth for TDD automation business logic and architecture decisions.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Quick Reference](#quick-reference)
3. [Architecture](#architecture)
4. [Workflow Specifications](#workflow-specifications)
5. [State Management](#state-management)
6. [Cost Protection](#cost-protection)
7. [Risks & Mitigations](#risks--mitigations)
8. [Design Decisions](#design-decisions)
9. [Effect-Based Implementation Architecture](#effect-based-implementation-architecture)

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

| Label                                | Purpose                    | Added By                              | Removed By            |
| ------------------------------------ | -------------------------- | ------------------------------------- | --------------------- |
| `tdd-automation`                     | Identifies TDD PR          | PR Creator                            | Auto-merge (on close) |
| `tdd-automation:manual-intervention` | Needs human review         | Test Workflow (5 failures)            | Human                 |
| `tdd-automation:had-conflict`        | Had actual merge conflicts | Claude Code (when conflicts detected) | Human (after review)  |

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

| Workflow    | File                                | Trigger                                |
| ----------- | ----------------------------------- | -------------------------------------- |
| PR Creator  | `.github/workflows/pr-creator.yml`  | Hourly cron + test.yml success on main |
| Test        | `.github/workflows/test.yml`        | Push to any branch                     |
| Claude Code | `.github/workflows/claude-code.yml` | @claude comment on PR                  |
| Recovery    | `.github/workflows/recovery.yml`    | Manual (workflow_dispatch)             |

### Cost Limits

| Threshold  | Per-Run | Daily | Weekly | Action                           |
| ---------- | ------- | ----- | ------ | -------------------------------- |
| Hard Limit | $5.00   | $100  | $500   | Skip workflow / Close PR         |
| Warning    | N/A     | $80   | $400   | Log warning (80% of daily limit) |

### Claude Code GitHub Action

**Uses:** `anthropics/claude-code-action@v1` ([Repository](https://github.com/anthropics/claude-code-action))

**Required Secret:** `CLAUDE_CODE_OAUTH_TOKEN` must be configured in repository Settings → Secrets and variables → Actions. See `.github/workflows/claude-code.yml` for usage.

**Action Inputs:**

| Input                     | Value                                    | Purpose                                         |
| ------------------------- | ---------------------------------------- | ----------------------------------------------- |
| `claude_code_oauth_token` | `${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}` | OAuth token authentication                      |
| `track_progress`          | `true`                                   | Built-in progress tracking (replaces heartbeat) |
| `use_sticky_comment`      | `true`                                   | Updates single comment instead of creating new  |
| `claude_args`             | See agent configurations below           | CLI-compatible arguments                        |
| `timeout_minutes`         | `45` (default), configurable per-spec    | Read from `@tdd-timeout` comment in spec file   |

**Required Permissions:** See `.github/workflows/claude-code.yml` for complete permissions configuration (contents, pull-requests, issues, actions).

---

### Agent Configurations

Both agents use Claude Sonnet 4.5 for optimal reasoning-to-cost balance. The agents are configured for **fully autonomous operation** in the TDD pipeline.

#### e2e-test-fixer Agent Configuration

**Purpose:** Make failing E2E tests pass through minimal, correct implementation.

**Configuration:** See `.github/workflows/claude-code.yml` for `claude_args` parameter values.

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

**Configuration:** See `.github/workflows/claude-code.yml` for `claude_args` parameter values.

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

### Agent Invocation Mechanism

**Critical Implementation Detail**: Agents are **not activated by text instructions** alone. The workflow must explicitly instruct Claude Code to invoke the Task tool.

**Why This Matters:**

- Tool restrictions (`--allowedTools`, `--disallowedTools`) apply to the **base assistant**
- Agent system prompts only activate when **Task tool is invoked**
- Text like "Use the e2e-test-fixer agent" without Task tool invocation = base assistant with restricted tools
- Proper invocation: "Use the Task tool to invoke the `e2e-test-fixer` agent to implement this spec."

**Implementation Location**: See `.github/workflows/claude-code.yml` lines 513-582 for prompt generation logic.

**Prompt Structure:**

```markdown
Use the Task tool to invoke the `<agent-type>` agent to <task-description>.

**Context:**

- Spec: `<spec-id>`
- Test file: `<spec-file>`
- Branch: `tdd/<spec-id>`

**Instructions for the agent:**

1. [Agent-specific instructions]
2. [...]

**Constraints:**

- NEVER modify test logic or assertions
- NEVER ask clarifying questions (autonomous mode)
- Maximum 3 iterations before reporting failure
```

---

### System Prompt Templates

Agent-specific prompts are dynamically generated by workflows based on failure context. See prompt construction in:

- **Test failures**: `.github/workflows/test.yml` - e2e-test-fixer prompt generation
- **Quality failures**: `.github/workflows/test.yml` - codebase-refactor-auditor prompt generation
- **Merge conflicts**: `.github/workflows/claude-code.yml` - conflict resolution prompt
- **Agent invocation**: `.github/workflows/claude-code.yml` - Task tool invocation prompts

Each prompt includes:

- Context (spec ID, file path, attempt number)
- Failure details (test output or quality check results)
- Agent-specific instructions and constraints
- **Explicit Task tool invocation instruction** (required for agent activation)

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
│  │ with .fixme │         │ Posts @claude│        │ Pushes fix  │           │
│  └─────────────┘         └─────────────┘         └─────────────┘           │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────┐        │
│  │ Manual Intervention (recovery.yml - workflow_dispatch)          │        │
│  │ ┌────────────────┐  ┌────────────────┐  ┌────────────────┐     │        │
│  │ │ retry-claude-  │  │ reset-attempt- │  │ mark-for-spec- │     │        │
│  │ │ code           │  │ counter        │  │ review         │     │        │
│  │ └────────────────┘  └────────────────┘  └────────────────┘     │        │
│  │ ┌────────────────┐                                              │        │
│  │ │ close-and-     │                                              │        │
│  │ │ reset-spec     │                                              │        │
│  │ └────────────────┘                                              │        │
│  └─────────────────────────────────────────────────────────────────┘        │
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
╚══════════════════════════════════════════════════════════════════════════════════════════════════════╝
```

---

#### Workflow Interconnection Diagram

Shows how the 3 workflows communicate via GitHub events:

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
│          │ On actual merge conflict:                                                      │
│          │ - Detects conflicts via git status (UU, AA, DD, AU, UA, DU, UD markers)       │
│          │ - Adds had-conflict label                                                      │
│          │ - Disables auto-merge (human review required)                                  │
│          │ - Continues workflow for Claude to attempt resolution                          │
│          │                                                                                │
│          │ On merge failure without conflicts:                                            │
│          │ - Logs error details                                                           │
│          │ - Fails workflow (infrastructure issue, not conflict)                          │
│          │ - No had-conflict label added                                                  │
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
║  ════════════════════════════════════════════════════════════════════════════════════════════════    ║
║  WORKFLOW 4: RECOVERY - Manual Intervention (.github/workflows/recovery.yml)                        ║
║  ════════════════════════════════════════════════════════════════════════════════════════════════    ║
║                                                                                                       ║
║                              ┌─────────────────────────────────────────┐                             ║
║                              │   TRIGGER: workflow_dispatch            │                             ║
║                              │   (Manual trigger via gh CLI or UI)     │                             ║
║                              └─────────────┬───────────────────────────┘                             ║
║                                            │                                                          ║
║                    ┌───────────────────────┼──────────────────────┬──────────────────────────┐       ║
║                    │                       │                      │                          │       ║
║                    ▼                       ▼                      ▼                          ▼       ║
║           ┌────────────────┐      ┌────────────────┐    ┌────────────────┐         ┌────────────────┐║
║           │ retry-claude-  │      │ reset-attempt- │    │ mark-for-spec- │         │ close-and-     │║
║           │ code           │      │ counter        │    │ review         │         │ reset-spec     │║
║           └────────┬───────┘      └────────┬───────┘    └────────┬───────┘         └────────┬───────┘║
║                    │                       │                     │                          │       ║
║                    ▼                       ▼                     ▼                          ▼       ║
║           ┌────────────────┐      ┌────────────────┐    ┌────────────────┐         ┌────────────────┐║
║           │ Post @claude   │      │ Update PR      │    │ Close PR       │         │ Close PR       │║
║           │ comment        │      │ title:         │    │ Add label:     │         │ Provide .fixme │║
║           │                │      │ "Attempt 1/5"  │    │ spec-review-   │         │ reset          │║
║           │                │      │                │    │ needed         │         │ instructions   │║
║           └────────┬───────┘      └────────┬───────┘    └────────────────┘         └────────────────┘║
║                    │                       │                                                         ║
║                    └───────────────────────┴──────────► Returns to WORKFLOW 3 (Claude Code)         ║
║                                                         or WORKFLOW 2 (Test)                         ║
║                                                                                                       ║
║  Use Cases:                                                                                           ║
║  • retry-claude-code: Network timeout, want manual retry without incrementing counter               ║
║  • reset-attempt-counter: Fixed codebase issue, want fresh 5 attempts                               ║
║  • mark-for-spec-review: Spec too complex/ambiguous, needs human review                             ║
║  • close-and-reset-spec: Complete restart, reset spec to .fixme()                                   ║
║                                                                                                       ║
╚═══════════════════════════════════════════════════════════════════════════════════════════════════════╝

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

**CI Optimization for .fixme() Removal:**

When a PR contains ONLY `.fixme()` removals from test files (i.e., test activation with no other code changes):

- **TypeCheck job is SKIPPED**: `.fixme()` removal doesn't change TypeScript code, so typecheck is guaranteed to pass. Skipping saves ~30s per run.
- **Detection logic**: `detect-change-type` job analyzes git diff and counts "significant" lines (non-`.fixme()`, non-file headers, non-empty). If significant changes = 0, sets `is_fixme_removal_only=true`.
- **Skip condition**: TypeCheck job checks `needs.detect-change-type.outputs.is_fixme_removal_only != 'true'` before running.
- **Other jobs still run**: Lint (for spec formatting), Unit Tests (unaffected), and E2E Tests (to verify the spec passes).

**Rationale**: .fixme() removal activates a test but doesn't change its implementation. TypeScript validation adds no value since no code changed, only test execution status.

**Attempt Counting:**

- Read from PR title: `Attempt X/Y`
- Increment ONLY on **test failure** (E2E assertions fail)
- Do NOT count toward attempts (still triggers @claude):
  - **Sync requests**: Branch needs update from main
  - **Quality-only failures**: Lint/typecheck fail but tests pass (uses refactor-auditor agent)
  - **Infrastructure errors**: Network timeouts, GitHub API errors, CI runner issues
  - **Merge conflicts**: Resolution doesn't burn an attempt

**Rationale**: Attempts track "implementation tries", not "pipeline runs". Quality fixes are refinement, not core implementation.

**@claude Comment Format:** See `.github/workflows/test.yml` for comment generation logic and template format.

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

**Conflict Detection:**

The workflow distinguishes between two types of merge failures:

1. **Actual Merge Conflicts** - File changes conflict between branches
   - Detected via `git status --porcelain` looking for conflict markers:
     - `UU` - Both modified
     - `AA` - Both added
     - `DD` - Both deleted
     - `AU` - Added by us
     - `UA` - Added by them
     - `DU` - Deleted by us
     - `UD` - Deleted by them
   - Actions taken:
     - Add `tdd-automation:had-conflict` label
     - Disable auto-merge until human reviews
     - Include conflict resolution instructions in agent prompt
     - Abort merge and continue workflow

2. **Merge Failures Without Conflicts** - Git errors, network issues, etc.
   - No conflict markers found in `git status --porcelain`
   - Actions taken:
     - Abort merge if in progress
     - Log error details (merge output, git status)
     - Fail the workflow with error message
     - Do NOT add conflict label (not a conflict)

**Rationale**: Prevents false positives where PRs are labeled as having conflicts when the merge failed for other reasons (like PR #7018). True conflicts require human resolution, while other failures should be investigated as infrastructure issues.

---

### 4. Recovery Workflow

**File**: `.github/workflows/recovery.yml`
**Trigger**: Manual (workflow_dispatch)
**Purpose**: Provide manual intervention actions for failed or stuck TDD PRs

**Actions**:

#### 4.1. retry-claude-code

- **Trigger**: `workflow_dispatch` with `action=retry-claude-code`
- **Purpose**: Manually trigger Claude Code execution without incrementing attempt counter
- **Use Case**: Transient infrastructure failure (network timeout, API rate limit)
- **Implementation**: Posts @claude comment to PR, test workflow handles execution

#### 4.2. reset-attempt-counter

- **Trigger**: `workflow_dispatch` with `action=reset-attempt-counter`
- **Purpose**: Reset PR title attempt counter to 1/5
- **Use Case**: Fixed underlying codebase issue (missing dependency, broken test), want fresh attempts
- **Implementation**: Updates PR title via gh CLI

#### 4.3. mark-for-spec-review

- **Trigger**: `workflow_dispatch` with `action=mark-for-spec-review`
- **Purpose**: Close PR and flag spec for human review
- **Use Case**: Spec too complex, ambiguous, or requires human expertise
- **Implementation**: Closes PR, adds `tdd-automation:spec-review-needed` label, posts explanatory comment

#### 4.4. close-and-reset-spec

- **Trigger**: `workflow_dispatch` with `action=close-and-reset-spec`
- **Purpose**: Close PR and provide instructions to reset spec to .fixme()
- **Use Case**: Complete restart needed (wrong implementation approach, spec needs rewrite)
- **Implementation**: Closes PR, posts instructions to add .fixme() back to spec file

**Parameters**:

- `pr_number` (required): TDD PR number to act on
- `action` (required): One of the 4 actions above
- `spec_file` (optional): Spec file path (used by close-and-reset-spec)

**Example Usage**:

```bash
# Retry Claude Code (transient error)
gh workflow run recovery.yml -f action=retry-claude-code -f pr_number=123

# Reset attempt counter (fixed codebase issue)
gh workflow run recovery.yml -f action=reset-attempt-counter -f pr_number=123

# Mark for spec review (spec too complex)
gh workflow run recovery.yml -f action=mark-for-spec-review -f pr_number=123

# Close and reset spec (complete restart)
gh workflow run recovery.yml -f action=close-and-reset-spec -f pr_number=123 -f spec_file=specs/api/tables.spec.ts
```

**Integration with Error Handling**:

- Recovery actions are **manual escape hatches** for when automation fails
- Error handling (claude-code.yml) **automatically closes** non-retriable errors
- Recovery workflow allows **human override** of automation decisions
- See "Error Type → Recovery Action Mapping" section for recommendations

---

## Removed Workflows

### Merge Watchdog (Removed 2026-01-28)

**Status**: Removed as redundant

**Why removed**:

- GitHub's native auto-merge feature handles PR merging automatically
- PR Creator already enables auto-merge on creation (pr-creator.yml line 192)
- test.yml now re-enables auto-merge on success (added as root cause fix)
- No evidence of PRs getting "stuck" with passed checks
- Unnecessary complexity: 48 cron runs/day, API rate limits, maintenance overhead

**Root cause fixed**: test.yml now explicitly re-enables auto-merge after all checks pass, ensuring PRs merge automatically.

**Migration**: No action needed. Auto-merge works via GitHub's native feature + test.yml re-enable step.

**Rollback**: If PRs get stuck (unlikely), manually merge with `gh pr merge --squash` or use recovery workflow.

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

**Architecture: Actual Cost Extraction from Claude Code Results**

The pipeline extracts **actual costs** from Claude Code execution results instead of using estimates.

**Data Source:**

Claude Code action outputs a JSON result in workflow logs containing:

```json
{
  "type": "result",
  "subtype": "success|error|timeout",
  "is_error": false,
  "duration_ms": 626421,
  "num_turns": 10,
  "total_cost_usd": 0.7814745000000001,
  "permission_denials": []
}
```

**Extraction Flow:**

1. Query `claude-code.yml` workflow runs from past 24h/7d
2. For each successful run, fetch workflow logs
3. Extract `total_cost_usd` from Claude Code action result JSON
4. Store actual cost per run (keyed by run ID)
5. Sum actual costs for daily/weekly totals
6. Compare against thresholds

**Cost Extraction Patterns (tried in order):**

| Priority | Pattern                      | Example Match                          | Notes                             |
| -------- | ---------------------------- | -------------------------------------- | --------------------------------- |
| 1        | `"total_cost_usd": <number>` | `"total_cost_usd": 0.7814745000000001` | Claude Code result JSON (primary) |
| 2        | `Total cost: $X.XX`          | `Total cost: $12.34`                   | Legacy log format (fallback)      |
| 3        | `Cost: $X.XX`                | `Cost: $5.67`                          | Alternative short format          |
| 4        | `Session cost: X.XX USD`     | `Session cost: 8.90 USD`               | Legacy format (no $ prefix)       |

**Fallback:** $15/run if all patterns fail to match (+ creates GitHub issue for investigation)

**Error Tracking:**

Track execution errors from result JSON:

- `is_error` field: Indicates execution failure
- `subtype` field: Distinguishes success/error/timeout
- Used for metrics and debugging

### Thresholds

| Check  | Warning | Hard Limit | Action             |
| ------ | ------- | ---------- | ------------------ |
| Daily  | $80     | $100       | Log warning / Skip |
| Weekly | $400    | $500       | Log warning / Skip |

### Credit Usage Comment (Always Posted)

**When Posted**: Always, before Claude Code execution on every TDD PR

**Purpose**: Real-time transparency of Claude Code costs across all TDD PRs

A credit usage comment is **always posted** on TDD PRs, with one of three states:

#### 1. ✅ Credits Available (Under Limits)

Posted when daily and weekly usage is below 80% of limits.

#### 2. ⚠️ Warning: Approaching Limit (80%+ Usage)

Posted when either daily or weekly usage reaches 80% or more (execution continues).

#### 3. ⏸️ Credit Limit Reached (Limit Exceeded)

Posted when daily or weekly limit is reached (blocks execution).

---

### Comment Format (All States)

**Daily/Weekly Usage Table:**

| Period     | Usage   | Limit | Remaining | % Used | Runs | Reset In |
| ---------- | ------- | ----- | --------- | ------ | ---- | -------- |
| **Daily**  | $42.15  | $100  | $57.85    | 42%    | 54   | 18h      |
| **Weekly** | $123.67 | $500  | $376.33   | 25%    | 158  | 5d       |

**Notes:**

- Actual costs extracted from Claude Code execution results
- Comment posted before Claude Code runs (not after)
- Provides transparency for all TDD PRs, not just when limits are hit
- Concise format focuses on critical budget information for decision-making

---

## Error Handling

### Claude Code Error Types

The pipeline implements comprehensive error handling for all Claude Code failure modes:

| Error Type                        | Subtype                               | Retriable | Action                                         | Label                                 |
| --------------------------------- | ------------------------------------- | --------- | ---------------------------------------------- | ------------------------------------- |
| **Success**                       | `success`                             | N/A       | Continue to test workflow                      | None                                  |
| **Max Turns**                     | `error_max_turns`                     | ❌ No     | Close PR immediately                           | `tdd-automation:spec-review-needed`   |
| **Budget Exceeded**               | `error_max_budget_usd`                | ❌ No     | Close PR immediately                           | `tdd-automation:budget-exceeded`      |
| **Execution Error (Transient)¹**  | `error_during_execution`              | ✅ Yes    | Automatic retry with exponential backoff       | None (auto-recovery active)           |
| **Execution Error (Persistent)¹** | `error_during_execution`              | ❌ No     | Close PR immediately                           | `tdd-automation:manual-intervention`  |
| **Execution Error (Unknown)¹**    | `error_during_execution`              | ✅ Yes    | Automatic retry, then manual if persists       | `tdd-automation:manual-intervention`  |
| **Structured Output Retries**     | `error_max_structured_output_retries` | ✅ Yes    | Automatic retry, then manual if persists       | `tdd-automation:manual-intervention`  |
| **Unknown Error**                 | `unknown`                             | ❌ No     | Close PR immediately                           | `tdd-automation:manual-intervention`  |

**Notes:**

¹ **`error_during_execution` categorization** is determined by pattern matching the error message:

- **Transient patterns**: `timeout|ETIMEDOUT|ECONNREFUSED|network|429|502|503|504|out of memory|ENOMEM` (safe to retry)
- **Persistent patterns**: `SyntaxError|TypeError|ReferenceError|Cannot find module|ENOENT|parse error` (code bug, needs manual fix)
- **Unknown patterns**: Any error not matching above (retry once, then manual intervention)

See "Error Detection Pipeline" section for implementation details.

### Automatic Recovery System

The TDD pipeline implements **event-driven automatic retry** for transient Claude Code errors, enabling full autonomy without human intervention for recoverable failures.

#### How Automatic Recovery Works

When Claude Code fails with a **retriable error** (transient, unknown execution, or structured output retries), the pipeline:

1. **Categorizes the error** - Determines if error is transient (network issues, timeouts) or persistent (code bugs)
2. **Checks attempt limit** - Verifies current attempt < 5 (respects 5-attempt maximum)
3. **Calculates exponential backoff** - Progressively increases delay between retries
4. **Posts status comment** - Informs about retry with backoff delay
5. **Sleeps for calculated delay** - Waits to avoid retry storms
6. **Posts @claude comment** - Triggers `claude-code.yml` via `issue_comment` event
7. **New workflow run starts** - Fresh execution context with full error handling

**Key Characteristic**: Event-driven (not cron-based) - immediate response when errors occur.

#### Exponential Backoff Schedule

| Attempt | Backoff Delay | Cumulative Time | Purpose                                      |
| ------- | ------------- | --------------- | -------------------------------------------- |
| 1       | 0s            | 0s              | First attempt (no delay)                     |
| 2       | 60s           | 1 min           | Quick retry after first failure              |
| 3       | 180s          | 4 min           | Allow more time for transient issues         |
| 4       | 420s          | 11 min          | Significant delay before penultimate attempt |
| 5       | 900s          | 26 min          | Final attempt with extended backoff          |

**Formula**: `delay = 60 * (2^(attempt-1) - 1)`

**Max Cumulative Time**: 26 minutes (from first failure to 5th attempt start)

**Why Exponential?**
- Prevents retry storms (avoids overwhelming services)
- Gives transient issues time to resolve (network recovery, API rate limits reset)
- Natural backoff pattern (failures cluster together, backoff separates them)

#### Retry Categories

| Error Category                | Should Retry | Max Attempts | Rationale                                                  |
| ----------------------------- | ------------ | ------------ | ---------------------------------------------------------- |
| `transient`                   | ✅ Yes       | 5            | Network timeouts, 502/503 errors, API rate limits          |
| `structured_output_retries`   | ✅ Yes       | 5            | Claude output parsing issues (usually transient)           |
| `unknown_execution`           | ✅ Yes       | 5            | Unknown errors (conservative retry)                        |
| `persistent`                  | ❌ No        | -            | SyntaxError, ENOENT (requires code fix)                    |
| `max_turns`                   | ❌ No        | -            | Spec too complex (needs spec review)                       |
| `max_budget`                  | ❌ No        | -            | Exceeded $5 per-run limit (close PR)                       |
| `max_attempts_reached` (new)  | ❌ No        | -            | Already at 5/5 attempts (manual intervention required)     |

**New Guard Rail**: If current attempt ≥ 5, automatic retry is **skipped** and PR is closed with `manual-intervention` label (prevents infinite loops).

#### Recovery Flow Diagram

```
Claude Code Fails
      │
      ▼
Categorize Error
      │
  ┌───┴────────────┐
  │                │
  ▼                ▼
Retry          No Retry
  │                │
  │                ├─→ Close PR (max_budget, max_turns)
  │                └─→ Add label (persistent, manual intervention)
  │
  ├─→ Check attempt limit (< 5?)
  │     │
  │     ├─→ No (≥5) → Close PR + manual-intervention label
  │     └─→ Yes → Continue
  │
  ├─→ Calculate exponential backoff
  ├─→ Post status comment
  ├─→ Sleep for delay
  └─→ Post @claude comment
           │
           ▼
    claude-code.yml re-triggered (issue_comment event)
           │
       ┌───┴───┐
       │       │
       ▼       ▼
    Success  Failure
       │       │
       │       └─→ Repeat (if attempts < 5)
       │
       └─→ Tests pass → Auto-merge
```

#### Cost Protection

- **Per-run limit**: $5.00 (enforced by `--max-budget-usd` in Claude Code)
- **Daily limit**: $100 (checked before retry, blocks execution if exceeded)
- **Weekly limit**: $500 (checked before retry, blocks execution if exceeded)
- **Retry delay adds no cost** (GitHub Actions sleep is free)
- **Worst case**: 5 retries × $5 = $25 per spec (within daily limit)
- **Typical case**: 1-2 retries × $5 = $5-10 per spec (most transient errors resolve quickly)

#### Manual Override

If automatic retry is insufficient or fails to resolve the issue:

1. **Reset attempt counter**: `recovery.yml` → `reset-attempt-counter` (allows 5 more retries after fixing underlying issue)
2. **Manual retry**: `recovery.yml` → `retry-claude-code` (posts @claude comment immediately, bypasses backoff)
3. **Mark for spec review**: `recovery.yml` → `mark-for-spec-review` (close PR with `spec-review-needed` label)
4. **Close and reset spec**: `recovery.yml` → `close-and-reset-spec` (close PR and add `.fixme()` back to spec file)

See "Recovery Workflow" section for detailed manual recovery options.

#### Expected Impact

| Metric                     | Before (Manual Only)         | After (Automatic Recovery) |
| -------------------------- | ---------------------------- | -------------------------- |
| **Transient Error Recovery** | ❌ Manual (hours to days)   | ✅ Automatic (minutes)     |
| **Response Time**          | ⏰ Hours (human intervention) | ⚡ 1-26 minutes (automated) |
| **Human Effort**           | 🧑 High (every transient error) | 🤖 Low (only persistent failures) |
| **Throughput**             | 📉 ~10-20 specs/day          | 📈 ~50-100 specs/day       |
| **Cost Per Spec**          | 💰 ~$15 (manual retry cycles) | 💰 ~$12 (fewer retry loops) |
| **Reliability**            | ⚠️ Depends on human availability | ✅ 24/7 automatic recovery |

**Key Benefit**: **80% reduction in human effort** - only persistent failures (code bugs, spec issues) require manual intervention.

#### Monitoring Automatic Recovery

**GitHub Insights to Track:**

1. **Workflow run count** for `claude-code.yml` - Shows retry frequency (expect 1.2-1.5 runs per spec)
2. **PR comment count** - High count = many retries (investigate transient error patterns)
3. **PR age distribution** - Long-lived PRs = automatic recovery failing (review logs)
4. **Label distribution** - High `manual-intervention` rate = persistent errors dominating

**Success Metrics:**

- **Retry success rate**: Target 80%+ (most transient errors resolve on retry)
- **Average attempts per spec**: Target 1.2-1.5 (most specs pass on first try)
- **Manual intervention rate**: Target <5% (only persistent failures escalate)
- **Mean time to recovery**: Target <10 minutes (exponential backoff averages ~6 minutes)

### Error Type → Recovery Action Mapping

This table recommends which recovery action to use for each error scenario, helping you respond quickly to automation failures.

| Error Scenario                            | Auto Action              | Recommended Recovery Action    | When to Use Recovery                         |
| ----------------------------------------- | ------------------------ | ------------------------------ | -------------------------------------------- |
| **error_max_turns** (5 attempts used)     | Close PR + review label  | `mark-for-spec-review`         | Already auto-closed, use if label missing    |
| **error_max_budget_usd** ($5.00 hit)      | Close PR + budget label  | Manual investigation           | Evaluate if spec needs budget increase       |
| **Transient error** (timeout, network)    | Auto-retry via @claude   | `retry-claude-code`            | Manual retry if automation didn't trigger    |
| **Persistent error** (SyntaxError, etc.)  | Close PR + manual label  | Fix code → `reset-attempt`     | After fixing codebase issue                  |
| **Unknown error** (retried once already)  | Close PR + manual label  | Investigate → choose action    | After understanding error root cause         |
| **Spec ambiguity** (discovered mid-run)   | Agent struggles          | `mark-for-spec-review`         | Spec requirements unclear/contradictory      |
| **Merge conflict** (main branch updated)  | @claude conflict prompt  | None (let automation handle)   | Automation resolves conflicts automatically  |
| **Want fresh attempts** (codebase fixed)  | N/A                      | `reset-attempt-counter`        | After fixing dependency, test helper, etc.   |
| **Complete restart** (wrong approach)     | N/A                      | `close-and-reset-spec`         | Spec needs rewrite with different approach   |
| **Stuck merge** (checks passed, no merge) | Test workflow re-enables | None (GitHub auto-merge works) | Auto-merge re-enabled by test.yml (line 818) |

**Decision Guide**:

1. **Check error type** in claude-code.yml execution logs or PR comment
2. **Verify auto action** was taken (PR closed? Label added? @claude comment posted?)
3. **Investigate root cause** if error is persistent or unknown
4. **Choose recovery action** based on table above
5. **Execute** via `gh workflow run recovery.yml -f action=<action> -f pr_number=<PR>`

**When NOT to Use Recovery Workflow**:

- ✅ **Automation is working** - let it run (test workflow handles retries)
- ✅ **Merge conflicts** - automation has conflict resolution built-in
- ✅ **First failure** - give automation full 5 attempts before manual intervention
- ✅ **Budget warnings** - only warnings, not hard limits (automation continues)

### Error Detection Pipeline

**Workflow**: `.github/workflows/claude-code.yml` (after Claude Code action)

1. **Parse Claude Code Result**
   - Reads `execution_file` output from action
   - Extracts `result.subtype` and `result.errors` from JSON
   - Outputs: `result-subtype`, `error-message`

2. **Categorize Error Type**
   - Maps `result.subtype` to error category
   - For `error_during_execution`, applies pattern matching:
     - **Transient patterns**: `timeout|ETIMEDOUT|ECONNREFUSED|network|429|502|503|504|out of memory|ENOMEM`
     - **Persistent patterns**: `SyntaxError|TypeError|ReferenceError|Cannot find module|ENOENT|parse error`
     - **Unknown patterns**: Any error not matching above (retry once)
   - Outputs: `error-category`, `should-retry`

3. **Route by Error Type**
   - **Retriable errors**: Post @claude comment (test workflow retries)
   - **Non-retriable errors**: Close PR with appropriate label + explanation comment

### Per-Run Budget Protection

**Budget Limit**: $5.00 per Claude Code execution

**Configuration**: Added to `claude_args` in `.github/workflows/claude-code.yml`:

```yaml
claude_args: ${{ steps.agent-config.outputs.claude-args }} --max-budget-usd 5.00
```

**Behavior**:

- Claude Code stops execution when approaching $5.00
- Returns `error_max_budget_usd` result subtype
- Pipeline closes PR with `tdd-automation:budget-exceeded` label
- Daily/weekly limits still enforced (defense in depth)

**Rationale**:

- Prevents runaway costs from single spec
- Complements daily ($100) and weekly ($500) limits
- Conservative limit encourages efficient spec design

### Error Messages and Comments

**Retriable Error Comment** (posted by `Route by Error Type` step):

```markdown
⚠️ **Claude Code Execution Failed (Retryable Error)**

**Error Category**: `transient`
**Error Message**: [detailed error from Claude Code]

**Next Steps**: The test workflow will automatically retry by posting a @claude comment.

---

_Automated retry triggered by TDD pipeline error handling_
```

**Non-Retriable Error Comment** (posted before closing PR):

```markdown
❌ **TDD Automation Failed: [Reason]**

**Error Category**: `max_turns`
**Spec ID**: `SPEC-123`

**Reason**: This spec requires too many steps to implement. Consider breaking it into smaller specs or simplifying the requirements.

**What This Means**:

- This PR cannot be automatically implemented
- Manual intervention is required

**Recovery Options** (via workflow_dispatch in `.github/workflows/recovery.yml`):

- `retry-claude-code`: Post @claude comment to retry (if error might be transient)
- `reset-attempt-counter`: Reset attempt counter to 1/5 (if retrying after fixing issue)
- `mark-for-spec-review`: Close PR and add spec-review-needed label
- `close-and-reset-spec`: Close PR and create new PR to add .fixme() back to spec

---

_Automated closure by TDD pipeline error handling_
```

### TDD Recovery Workflow

**Workflow**: `.github/workflows/recovery.yml`

Manual recovery actions for TDD automation failures:

#### 1. `retry-claude-code`

**Purpose**: Manually trigger Claude Code retry by posting @claude comment

**Inputs**:

- `pr_number`: PR to retry
- `spec_file`: (optional) Spec file path for context

**Actions**:

- Posts @claude comment with spec context
- Claude Code workflow triggers automatically

**Use Case**: Error might have been transient (network issue, temporary service outage)

#### 2. `reset-attempt-counter`

**Purpose**: Reset PR attempt counter to 1/5

**Inputs**:

- `pr_number`: PR to reset

**Actions**:

- Updates PR title: `[TDD] Implement <spec-id> | Attempt 1/5`
- Posts comment explaining reset
- Allows 5 more retry attempts

**Use Case**: Fixed underlying issue (code cleanup, spec clarification) and want to retry

#### 3. `mark-for-spec-review`

**Purpose**: Mark spec for human review

**Inputs**:

- `pr_number`: PR to close
- `spec_file`: Spec file needing review

**Actions**:

- Adds `tdd-automation:spec-review-needed` label
- Closes PR with review guidance comment
- Spec remains with `.fixme()` annotation

**Use Case**: Spec is too complex, ambiguous, or requires architectural decisions

#### 4. `close-and-reset-spec`

**Purpose**: Close PR and prepare for fresh start

**Inputs**:

- `pr_number`: PR to close
- `spec_file`: Spec file to reset

**Actions**:

- Closes PR with `tdd-automation:reset-spec` label
- Provides instructions to add `.fixme()` back to spec
- PR creator will detect spec again after reset

**Use Case**: Want to completely restart TDD process for this spec

### Common Recovery Scenarios

This section provides practical examples of when to use each recovery action based on real failure patterns.

#### Scenario 1: Transient Infrastructure Failure

**Symptom**: Claude Code failed with `error_during_execution` showing network timeout or API rate limit (429, 502, 503).

**Example Error**:

```json
{
  "subtype": "error_during_execution",
  "errors": ["ETIMEDOUT: connection timed out after 30000ms"]
}
```

**Action**: Use `retry-claude-code` to manually trigger another attempt without burning an attempt counter.

**Command**:

```bash
gh workflow run recovery.yml \
  -f action=retry-claude-code \
  -f pr_number=123
```

**Expected Outcome**: Test workflow receives @claude comment, triggers Claude Code execution, likely succeeds on retry.

---

#### Scenario 2: Spec Ambiguity Discovered After Multiple Failures

**Symptom**: Claude Code has failed 3-4 times with `error_max_turns` (hit 41-turn limit each time). Error comments suggest spec requirements are unclear or contradictory.

**Example**: Spec says "validate email format" but doesn't specify which RFC standard (5321, 5322, 6531).

**Action**: Use `mark-for-spec-review` to close PR and flag spec for human clarification.

**Command**:

```bash
gh workflow run recovery.yml \
  -f action=mark-for-spec-review \
  -f pr_number=123
```

**Expected Outcome**: PR closed with `tdd-automation:spec-review-needed` label, team reviews and clarifies spec, then removes `.fixme()` to restart automation.

---

#### Scenario 3: Fixed Codebase Issue, Want Clean Slate

**Symptom**: Agent failed 2 times due to missing dependency or broken test helper. You've now fixed the issue (added dependency to package.json, fixed test helper). Want to give agent 5 fresh attempts with the fixed codebase.

**Example**: Agent failed because `@tanstack/react-query` wasn't installed. You ran `bun add @tanstack/react-query`.

**Action**: Use `reset-attempt-counter` to reset to 1/5 and give it fresh attempts.

**Command**:

```bash
gh workflow run recovery.yml \
  -f action=reset-attempt-counter \
  -f pr_number=123
```

**Expected Outcome**: PR title changes from "Attempt 3/5" to "Attempt 1/5", next Claude Code execution gets 5 full attempts with fixed codebase.

---

#### Scenario 4: Implementation Approach Was Wrong, Need Complete Restart

**Symptom**: Agent has been trying to implement feature using approach A, but team realized approach B is correct. Spec needs rewrite to reflect approach B. Current PR is pursuing wrong approach.

**Example**: Spec said "use Redux for state management" but team decided "use TanStack Query instead".

**Action**: Use `close-and-reset-spec` to close PR, reset spec to `.fixme()`, rewrite spec with correct approach, then restart automation.

**Command**:

```bash
gh workflow run recovery.yml \
  -f action=close-and-reset-spec \
  -f pr_number=123 \
  -f spec_file=specs/features/user-profile.spec.ts
```

**Expected Outcome**: PR closed, instructions provided to add `.fixme()` back to spec, team rewrites spec, removes `.fixme()` to create fresh PR with correct approach.

---

#### Scenario 5: Budget Limit Hit, Need to Increase or Simplify

**Symptom**: Claude Code failed with `error_max_budget_usd` (hit $5.00 per-run limit). Spec might be legitimately complex and need higher budget, or might need simplification.

**Analysis Steps**:

1. Review spec complexity - is it testing too many behaviors at once?
2. Check turn count - did it use 40+ turns? (indicates max_turns would have been hit anyway)
3. Evaluate if spec can be broken down into smaller tests

**Action Options**:

- **If spec is valid but expensive**: Increase `MAX_BUDGET_PER_RUN` in claude-code.yml (e.g., $5 → $10)
- **If spec is too complex**: Use `mark-for-spec-review` to simplify spec
- **If uncertain**: Manual implementation, then adjust budget/spec based on learnings

**No recovery workflow action needed** - this requires workflow configuration change or spec simplification.

---

#### Scenario 6: Merge Conflict After Main Branch Update

**Symptom**: PR shows merge conflict after new commits merged to main branch.

**Action**: **Let automation handle it** - test workflow has merge conflict detection and posts @claude comment with conflict resolution instructions. Agent will resolve conflicts automatically.

**No recovery workflow action needed** - automation handles merge conflicts via test workflow's conflict detection (lines 240-259 in test.yml).

---

#### Scenario 7: Unknown Error, Want to Investigate Before Retry

**Symptom**: Claude Code failed with `error_during_execution` showing unknown error pattern (not transient, not persistent). Error categorization: "Unknown patterns" (retry once, then manual).

**Example Error**:

```json
{
  "subtype": "error_during_execution",
  "errors": ["UnhandledPromiseRejection: Database connection lost"]
}
```

**Action Steps**:

1. **Investigate logs** first - view full error trace in GitHub Actions logs
2. **Identify root cause** - is this a codebase issue (needs fix) or transient (safe to retry)?
3. **Choose recovery action**:
   - If transient: `retry-claude-code`
   - If codebase issue: Fix code, then `reset-attempt-counter`
   - If spec issue: `mark-for-spec-review`

**No immediate recovery action** - investigate first, then decide.

### Error Handling Workflow Diagram

```
Claude Code Action
       ↓
[Parse Result] → result-subtype, error-message
       ↓
[Categorize Error] → error-category, should-retry
       ↓
[Route by Type]
       ↓
   ┌───┴───┐
   ↓       ↓
Retriable  Non-Retriable
   ↓       ↓
Post       Close PR
@claude    + Label
comment    + Comment
   ↓
Test workflow
triggers retry
```

### Pattern Matching Rationale

**Transient Error Patterns**:

- **Network issues**: `timeout`, `ETIMEDOUT`, `ECONNREFUSED`, `network`
- **Service issues**: `429` (rate limit), `502/503/504` (bad gateway/service unavailable)
- **Resource issues**: `out of memory`, `ENOMEM`

**Persistent Error Patterns**:

- **Code errors**: `SyntaxError`, `TypeError`, `ReferenceError`
- **Missing resources**: `Cannot find module`, `ENOENT` (file not found)
- **Parsing errors**: `parse error`

**Unknown Patterns**:

- Any error not matching transient or persistent patterns
- Retry once (conservative approach)
- Requires manual intervention after retry fails

**Why Pattern Matching**:

- Conservative approach: avoids infinite retry loops
- Pragmatic: distinguishes fixable vs. non-fixable errors
- Transparent: error category visible in logs and comments
- Maintainable: easy to add new patterns as needed

### Cost Protection Strategy

**Three-Layer Defense**:

1. **Per-Run Budget** ($5.00)
   - Immediate protection against runaway costs
   - Prevents single spec from consuming entire daily budget
   - Enforced by Claude Code CLI (`--max-budget-usd`)

2. **Daily Limit** ($100)
   - Aggregate limit across all executions
   - 20 executions at $5.00 each (realistic)
   - Enforced by validation job (blocks execution)

3. **Weekly Limit** ($500)
   - Rolling 7-day window
   - 100 executions at $5.00 each
   - Enforced by validation job (blocks execution)

**Monitoring**:

- Credit usage comment posted before every execution
- Shows actual costs (not estimates)
- Displays remaining budget and reset timers
- 80% warning thresholds ($80 daily, $400 weekly)

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
    | Merge conflict detection | Distinguish actual conflicts from failures + human review gate | ✅ High |
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
| Credit limits          | $100/day, $500/week (+ $5/run)                            | Three-layer defense: per-run, daily, weekly          |
| Per-run budget limit   | $5.00                                                     | Prevents runaway costs from single spec              |
| Cost tracking          | Actual costs from Claude Code result JSON                 | Accurate tracking vs. $15 estimates                  |
| Cost parsing           | JSON result + multi-pattern fallback                      | Handles format changes gracefully                    |
| Sync strategy          | Merge (not rebase)                                        | Safer, no force-push, better for automation          |
| Conflict counting      | Not counted as attempt                                    | Infrastructure issue, not code failure               |
| Error handling         | Pattern matching (conservative)                           | Distinguish transient vs. persistent errors          |
| Retry strategy         | Transient errors retry, persistent errors close           | Avoid infinite loops, clear failure path             |
| Unknown errors         | Retry once, then manual intervention                      | Conservative approach for unexpected failures        |
| Recovery actions       | Manual workflow_dispatch triggers                         | Flexible recovery without pipeline re-runs           |

---

## Per-Spec Configuration

Specs can include inline configuration via comments in the format:

- `@tdd-max-attempts <number>` - Override default 5 attempts
- `@tdd-timeout <minutes>` - Override default 45 min timeout

**Parsing:** See `scripts/tdd-automation/core/spec-scanner.ts` for comment parsing implementation and supported configuration keys.

---

## Comment Templates

Automated comments are posted by workflows to trigger Claude Code. Comment generation logic and templates are defined in:

- **Test Workflow**: `.github/workflows/test.yml`
  - Sync requests when branch behind main
  - Test failure notifications with spec context
  - Quality failure notifications

- **Claude Code Workflow**: `.github/workflows/claude-code.yml`
  - Merge conflict resolution instructions
  - Agent-specific prompt construction

See workflow files for exact comment formats and variable substitution patterns.

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

### Implementation Files

See `scripts/tdd-automation/` directory for complete implementation:

| Directory    | Purpose                                        | Key Files                                                                                                                                           |
| ------------ | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `core/`      | Domain types, errors, configuration, utilities | `types.ts`, `errors.ts`, `config.ts`, `schema-priority-calculator.ts`                                                                               |
| `services/`  | Effect service interfaces and implementations  | `github-api.ts`, `git-operations.ts`, `cost-tracker.ts`, `credit-comment-generator.ts`, `agent-prompt-generator.ts`, `failure-comment-generator.ts` |
| `programs/`  | Composable Effect programs for workflow logic  | `check-credit-limits.ts`, `find-active-tdd-pr.ts`, `create-tdd-pr.ts`                                                                               |
| `workflows/` | CLI entry points called by YAML workflows      | `pr-creator/`, `test/`, `claude-code/` (merge-watchdog/ removed 2026-01-28)                                                                         |
| `layers/`    | Dependency injection (live, test)              | `live.ts`, `test.ts`                                                                                                                                |

**Error Types:** See `scripts/tdd-automation/core/errors.ts` for all `Data.TaggedError` definitions
**Service Interfaces:** See `scripts/tdd-automation/services/*.ts` for service method signatures
**Programs:** See `scripts/tdd-automation/programs/*.ts` for composable Effect programs

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

**Implementation:** See program files in `scripts/tdd-automation/programs/` for concrete implementations following the Effect.gen pattern with dependency injection.

---

### Comment Generation Services

Three TypeScript services replace complex bash template logic for generating GitHub PR comments:

| Service                  | File                                                           | Purpose                                             | Replaces (Lines)                    |
| ------------------------ | -------------------------------------------------------------- | --------------------------------------------------- | ----------------------------------- |
| `generateCreditComment`  | `scripts/tdd-automation/services/credit-comment-generator.ts`  | Generate credit usage markdown for PR comments      | ~60 lines bash in `claude-code.yml` |
| `generateAgentPrompt`    | `scripts/tdd-automation/services/agent-prompt-generator.ts`    | Generate Claude Code agent invocation prompts       | ~85 lines bash in `claude-code.yml` |
| `generateFailureComment` | `scripts/tdd-automation/services/failure-comment-generator.ts` | Generate failure recovery prompts for test failures | ~38 lines bash in `test.yml`        |

**Key Benefits:**

- **Type Safety**: Environment variables parsed and validated with Effect Schema
- **Testability**: 30+ unit tests covering all comment generation logic
- **Maintainability**: Centralized comment templates with reusable functions
- **Error Handling**: Type-safe errors with `Effect.try` for parsing failures

**Usage Pattern:**

```typescript
// Workflow calls CLI entry point with env vars
env:
  credits-ok: ${{ steps.credits.outputs.credits-ok }}
  daily-runs: ${{ steps.credits.outputs.daily-runs }}
  # ... other metrics
run: |
  bun run scripts/tdd-automation/workflows/claude-code/generate-credit-comment.ts > /tmp/credit_usage.md
  gh pr comment "${{ github.event.issue.number }}" --body-file /tmp/credit_usage.md
```

**CLI Entry Points:**

- `scripts/tdd-automation/workflows/claude-code/generate-credit-comment.ts`
- `scripts/tdd-automation/workflows/claude-code/generate-prompt.ts`
- `scripts/tdd-automation/workflows/test/generate-failure-comment.ts`

**Test Coverage:** Each service has comprehensive unit tests verifying comment generation, environment parsing, and error handling.

---

### YAML Workflow Integration

Workflows call TypeScript CLI entry points instead of inline bash. See:

- **Workflow files**: `.github/workflows/` directory
- **CLI entry points**: `scripts/tdd-automation/workflows/` directory
- **Core programs**: `scripts/tdd-automation/programs/` directory

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

**Implementation:** See `scripts/tdd-automation/layers/live.ts` and `scripts/tdd-automation/layers/test.ts` for layer composition patterns.

---

### Architectural Comparison

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
