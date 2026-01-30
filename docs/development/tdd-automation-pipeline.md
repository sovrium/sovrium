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
- ✅ **PR titles for spec tracking** (immutable) - reliable identification
- ✅ **Branch names as backup ID** - label accident recovery
- ✅ **Merge strategy** for main sync - safer than rebase
- ✅ **Manual-intervention label** - all errors pause for human review
- ✅ **$200/day, $1000/week limits** with 80% warning alerts

---

## Quick Reference

### Labels

| Label                                | Purpose            | Added By                   | Removed By            |
| ------------------------------------ | ------------------ | -------------------------- | --------------------- |
| `tdd-automation`                     | Identifies TDD PR  | PR Creator                 | Auto-merge (on close) |
| `tdd-automation:manual-intervention` | Needs human review | Claude Code (on any error) | Human                 |

### Branch Naming

```
tdd/<spec-id>
Example: tdd/API-TABLES-CREATE-001

Spec ID Format: <COMPONENT>-<FEATURE>-<NUMBER> or <COMPONENT>-<FEATURE>-REGRESSION
Examples: API-TABLES-CREATE-001, API-TABLES-REGRESSION
```

### PR Title Format

```
[TDD] Implement <spec-id>
Example: [TDD] Implement API-TABLES-CREATE-001

Note: Max attempts default is 5 (configurable per spec)
```

### Workflows Summary

| Workflow    | File                                | Trigger                                                             |
| ----------- | ----------------------------------- | ------------------------------------------------------------------- |
| PR Creator  | `.github/workflows/pr-creator.yml`  | Hourly cron + test.yml success on main + manual (workflow_dispatch) |
| Test        | `.github/workflows/test.yml`        | Push to main + PR events (opened, synchronize, reopened, closed)    |
| Claude Code | `.github/workflows/claude-code.yml` | @claude comment on PR                                               |

**Note on Spec Progress Updates**: The `test` workflow includes an `update-spec-progress` job that automatically updates `SPEC-PROGRESS.md` when all tests pass on `main` branch. This job:

- Runs only on `push` events to `main` (not on PRs)
- Requires explicit success signal from `test` job via `outputs.all-passed`
- Uses `bun run analyze:specs` to scan and update spec completion status
- Commits changes with `[skip ci]` to avoid triggering new workflow runs
- **Uses `GH_PAT_WORKFLOW` token** to bypass branch protection rules (required for direct push to `main`)

**Note on Concurrency Control**: The `test` workflow uses a hybrid concurrency strategy to balance fast feedback with workflow completion:

- **PR workflows**: Cancelled when new commits are pushed (fast feedback on latest code)
- **Main branch workflows**: Run to completion even when new commits arrive (ensures spec progress updates execute)
- **Rationale**: TDD automation pushes to main frequently. Cancelling main workflows would prevent spec progress tracking, breaking the automation pipeline.

### Cost Limits

| Threshold  | Per-Run | Daily | Weekly | Action                                            |
| ---------- | ------- | ----- | ------ | ------------------------------------------------- |
| Hard Limit | $10.00  | $200  | $1000  | Claude Code stops / Skip workflow / Skip workflow |
| Warning    | N/A     | $160  | $800   | N/A / Log warning (80%) / Log warning (80%)       |

**Per-Run**: Enforced by Claude Code CLI (`--max-budget-usd`), not workflow
**Daily/Weekly**: Enforced by workflow credit check before execution

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
| `timeout_minutes`         | `90` (default), configurable per-spec    | Read from `@tdd-timeout` comment in spec file   |

**Required Permissions:** See `.github/workflows/claude-code.yml` for complete permissions configuration (contents, pull-requests, issues, actions, id-token).

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

**Note**: "Core tools" include: Bash, Read, Write, Edit, Glob, Grep, Task, TodoWrite, LSP

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

| Condition                                            | Agent                       | Prompt Includes                     |
| ---------------------------------------------------- | --------------------------- | ----------------------------------- |
| Test failure (assertions, timeouts, HTTP errors)     | `e2e-test-fixer`            | Spec ID, file path, failure details |
| Quality failure only (lint, typecheck, no test fail) | `codebase-refactor-auditor` | Quality output, files affected      |
| 3+ tests fixed, handoff triggered                    | `codebase-refactor-auditor` | Baseline results, duplication notes |

**Note**: Merge conflicts are handled differently - they exit the workflow early (before agent execution) and require manual resolution. See [Conflict Detection](#conflict-detection-and-early-exit) for details.

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
- **Agent invocation**: `.github/workflows/claude-code.yml` - Task tool invocation prompts

**Note**: Merge conflicts are handled via early exit (not agent execution). See comment posted by workflow for manual resolution instructions.

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
     timeout-minutes: ${{ inputs.timeout || 90 }}
   ```

3. **Job-Level Buffer**: The job timeout is automatically set to `timeout + 15` minutes, ensuring error handling steps can still execute even if the Claude Code action times out.

**Timeout Validation**: Range is 15-120 minutes. Values outside this range default to 90 minutes.

| Spec Type           | Recommended Timeout | Rationale                        |
| ------------------- | ------------------- | -------------------------------- |
| Simple UI           | 45 min              | Single component, few iterations |
| API endpoint        | 90 min (default)    | Requires route + schema + tests  |
| Complex integration | 120 min             | Multiple layers, database, auth  |
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
│  │ Manual Intervention (via GitHub UI)                              │        │
│  │ ┌────────────────────────────────────────────────────────┐      │        │
│  │ │ 1. Remove manual-intervention label                     │      │        │
│  │ │ 2. Post @claude comment to retry                        │      │        │
│  │ └────────────────────────────────────────────────────────┘      │        │
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
║                              │   JOB 1: check-active-pr    │                                          ║
║                              │   ─────────────────────     │                                          ║
║                              │   Query GitHub for PRs:     │                                          ║
║                              │   - state: open             │                                          ║
║                              │   - label: tdd-automation   │                                          ║
║                              │   - NOT label: manual-      │                                          ║
║                              │     intervention            │                                          ║
║                              └─────────────┬───────────────┘                                          ║
║                                            │                                                          ║
║                    ┌───────────────────────┴───────────────────────┐                                  ║
║                    │                                               │                                  ║
║                    ▼                                               ▼                                  ║
║           ┌────────────────┐                                ┌────────────┐                            ║
║           │ Active PR      │                                │ No active  │                            ║
║           │ exists         │                                │ PR found   │                            ║
║           └───────┬────────┘                                └─────┬──────┘                            ║
║                   │                                               │                                   ║
║                   ▼                                               │                                   ║
║           ┌────────────────┐                                      │                                   ║
║           │ STOP           │                                      │                                   ║
║           │ has-active:    │                                      │                                   ║
║           │ true           │                                      │                                   ║
║           │ (wait for      │                                      │                                   ║
║           │ current PR)    │                                      │                                   ║
║           │ Skip credit    │                                      │                                   ║
║           │ check (save $) │                                      │                                   ║
║           └────────────────┘                                      │                                   ║
║                                                                   │                                   ║
║                                          ┌────────────────────────┘                                   ║
║                                          │                                                            ║
║                                          ▼                                                            ║
║                   ┌─────────────────────────────┐                                                     ║
║                   │   JOB 2: check-credits      │                                                     ║
║                   │   (needs: check-active-pr)  │                                                     ║
║                   │   ─────────────────────     │                                                     ║
║                   │   STEP 1: Probe credits     │                                                     ║
║                   │   - Run Claude Code minimal │                                                     ║
║                   │   - Prompt: "hi"            │                                                     ║
║                   │   - Detect: is_error=true   │                                                     ║
║                   │     AND cost=0 → exhausted  │                                                     ║
║                   └─────────────┬───────────────┘                                                     ║
║                                 │                                                                     ║
║                   ┌─────────────▼───────────────┐                                                     ║
║                   │  STEP 2: Check budget       │                                                     ║
║                   │  Query workflow runs from:  │                                                     ║
║                   │  - Last 24 hours (daily)    │                                                     ║
║                   │  - Last 7 days (weekly)     │                                                     ║
║                   └─────────────┬───────────────┘                                                     ║
║                                 │                                                                     ║
║                   ┌─────────────▼───────────────┐                                                     ║
║                   │  Parse cost from logs:      │                                                     ║
║                   │  1. "Total cost: $X.XX"     │                                                     ║
║                   │  2. "Cost: $X.XX"           │                                                     ║
║                   │  3. "Session cost: X.XX USD"│                                                     ║
║                   │  4. Fallback: $15/run       │                                                     ║
║                   └─────────────┬───────────────┘                                                     ║
║                                 │                                                                     ║
║         ┌───────────────────────┼───────────────────────┐                                             ║
║         │                       │                       │                                             ║
║         ▼                       ▼                       ▼                                             ║
║  ┌───────────────┐       ┌───────────────┐       ┌───────────────┐                                   ║
║  │ daily >= $200 │       │ daily >= $160 │       │ daily < $160  │                                   ║
║  │ HARD LIMIT    │       │ WARNING       │       │ OK            │                                   ║
║  └───────┬───────┘       └───────┬───────┘       └───────┬───────┘                                   ║
║          │                       │                       │                                            ║
║          ▼                       ▼                       │                                            ║
║  ┌───────────────┐       ┌───────────────┐               │                                            ║
║  │ STOP          │       │ Log warning   │               │                                            ║
║  │ can-proceed:  │       │ Continue      │               │                                            ║
║  │ false         │       │               │               │                                            ║
║  └───────────────┘       └───────┬───────┘               │                                            ║
║          │                       │                       │                                            ║
║          │                       └───────────────────────┤                                            ║
║          │                                               │                                            ║
║          │              (same check for weekly: $1000/$800)                                           ║
║          │                                               │                                            ║
║          │               ┌───────────────────────────────┘                                            ║
║          │               │                                                                            ║
║          │               ▼                                                                            ║
║          │  ┌─────────────────────────────┐                                                           ║
║          │  │   JOB 3: find-spec          │                                                           ║
║          │  │   (needs: check-credits)    │                                                           ║
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
║                   │ ┌────────────┐  ┌─────────────────────────────────┐                              ║
║                   │ │ Run tests  │  │ STEP 2: Run quality + tests     │                              ║
║                   │ │ normally   │  │                                 │                              ║
║                   │ │ (no TDD    │  │ 1. bun run lint                 │                              ║
║                   │ │ handling)  │  │ 2. bun run typecheck            │                              ║
║                   │ └────────────┘  │ 3. bun test:unit                │                              ║
║                   │                 │ 4. bun test:e2e -- <spec-file>  │                              ║
║                   │                 │                                 │                              ║
║                   │                 │ NOTE: Branch syncing handled    │                              ║
║                   │                 │ automatically by claude-code.yml│                              ║
║                   │                 │ via merge strategy. No sync     │                              ║
║                   │                 │ check needed here.              │                              ║
║                   │                 └───────────────┬─────────────────┘                              ║
║                   │                                 │                                                ║
║                   │                 ┌───────────────┴───────────────────────┐                        ║
║                   │                 │                   │                   │                        ║
║                   │                 ▼                   ▼                   ▼                        ║
║                   │          ┌────────────┐       ┌──────────┐       ┌───────────┐                   ║
║                   │          │ ALL PASS   │       │ TESTS    │       │ QUALITY   │                   ║
║                   │          │            │       │ FAIL     │       │ ONLY FAIL │                   ║
║                   │          │            │       │          │       │ (lint/    │                   ║
║                   │          │            │       │          │       │ typecheck)│                   ║
║                   │          └─────┬──────┘       └────┬─────┘       └─────┬─────┘                   ║
║                   │                │                   │                   │                        ║
║                   │                ▼                   │                   │                        ║
║                   │          ┌──────────┐            │                   │                        ║
║                   │          │ AUTO-    │            │                   │                        ║
║                   │          │ MERGE    │            │                   │                        ║
║                   │          │ (squash) │            │                   │                        ║
║                   │          │          │            │                   │                        ║
║                   │          │ PR closes│            │                   │                        ║
║                   │          │ Label    │            │                   │                        ║
║                   │          │ removed  │            │                   │                        ║
║                   │          │          │            │                   │                        ║
║                   │          │ ► Triggers            │                   │                        ║
║                   │          │   PR                  │                   │                        ║
║                   │          │   Creator             │                   │                        ║
║                   │          │   (next               │                   │                        ║
║                   │          │   spec)               │                   │                        ║
║                   │          └──────────┘            │                   │                        ║
║                   │                                  │                   │                        ║
║                   │             ┌────────────────────┴───────────────────┘                        ║
║                   │             │                                                                 ║
║                   │             ▼                                                                 ║
║                   │  ┌─────────────────────────────┐                                              ║
║                   │  │ STEP 3: Parse attempt count │                                              ║
║                   │  │                             │                                              ║
║                   │  │ Extract from PR title:      │                                              ║
║                   │  │ "Attempt X/Y"               │                                              ║
║                   │  │                             │                                              ║
║                   │  │ Read @tdd-max-attempts from │                                              ║
║                   │  │ spec file (default: 5)      │                                              ║
║                   │  └─────────────┬───────────────┘                                              ║
║                   │                │                                                              ║
║                   │    ┌───────────┴───────────┐                                                  ║
║                   │    │                       │                                                  ║
║                   │    ▼                       ▼                                                  ║
║                   │ ┌────────────────┐  ┌────────────────┐                                        ║
║                   │ │ attempt < max  │  │ attempt >= max │                                        ║
║                   │ │ (e.g., 3 < 5)  │  │ (e.g., 5 >= 5) │                                        ║
║                   │ └───────┬────────┘  └───────┬────────┘                                        ║
║                   │         │                   │                                                 ║
║                   │         │                   ▼                                                 ║
║                   │         │          ┌────────────────────────┐                                 ║
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
║                   │         ▼                                                                         ║
║                   │ ┌───────────────────────────────────────┐                                         ║
║                   │ │ STEP 4: Update PR title               │                                         ║
║                   │ │                                       │                                         ║
║                   │ │ gh pr edit <pr-number>                │                                         ║
║                   │ │ --title "[TDD] Implement <spec-id>    │                                         ║
║                   │ │   | Attempt (X+1)/Y"                  │                                         ║
║                   │ └───────────────┬───────────────────────┘                                         ║
║                   │                 │                                                                 ║
║                   │                 ▼                                                                 ║
║                   │ ┌───────────────────────────────────────┐                                         ║
║                   │ │ STEP 5: Post @claude comment          │                                         ║
║                   │ │                                       │                                         ║
║                   │ │ For TEST FAILURE:                     │                                         ║
║                   │ │ ─────────────────                     │                                         ║
║                   │ │ @claude Tests are failing...          │                                         ║
║                   │ │ **Spec:** <spec-id>                   │                                         ║
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
║                   │         │ manual-intervention│        │                                           ║
║                   │         │                    │        │                                           ║
║                   │         │ Disable auto-merge │        │                                           ║
║                   │         │ (human must review │        │                                           ║
║                   │         │ resolution)        │        │                                           ║
║                   │         │                    │        │                                           ║
║                   │         │ Post comment with  │        │                                           ║
║                   │         │ conflict           │        │                                           ║
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
║                   │                │ - Test failure → e2e-test-fixer     │                            ║
║                   │                │ - Quality fail → refactor-auditor   │                            ║
║                   │                │                                     │                            ║
║                   │                │ Note: Conflicts handled in Step 3   │                            ║
║                   │                │ (early exit before agent selection) │                            ║
║                   │                └───────────────┬─────────────────────┘                            ║
║                   │                                │                                                  ║
║                   │                ┌───────────────┴──────────────┐                                   ║
║                   │                │                              │                                   ║
║                   │                ▼                              ▼                                   ║
║                   │  ┌──────────────────────┐          ┌─────────────────────┐                        ║
║                   │  │ Agent:               │          │ Agent:              │                        ║
║                   │  │ e2e-test-fixer       │          │ codebase-refactor-  │                        ║
║                   │  │                      │          │ auditor             │                        ║
║                   │  │ --max-turns 50       │          │ --max-turns 40      │                        ║
║                   │  │ --model claude-      │          │ --model claude-     │                        ║
║                   │  │ sonnet-4-5           │          │ sonnet-4-5          │                        ║
║                   │  └──────────┬───────────┘          └─────────┬───────────┘                        ║
║                   │             │                                │                                    ║
║                   │             └────────────────┬───────────────┘                                    ║
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
║                   │                │   timeout_minutes: ${{ TIMEOUT }}   │  # 90 default, per-spec    ║
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
║                   │                   ▼                                                               ║
║                   │         ┌──────────────────────────────┐                                          ║
║                   │         │ STEP 6: Final sync with main │                                          ║
║                   │         │                              │                                          ║
║                   │         │ git fetch origin main        │                                          ║
║                   │         │ git merge origin/main        │                                          ║
║                   │         │   --no-edit                  │                                          ║
║                   │         │                              │                                          ║
║                   │         │ Purpose: Handle race         │                                          ║
║                   │         │ condition (main updated      │                                          ║
║                   │         │ during 90min execution)      │                                          ║
║                   │         └────────────┬─────────────────┘                                          ║
║                   │                      │                                                            ║
║                   │         ┌────────────┴────────────┐                                               ║
║                   │         │                         │                                               ║
║                   │         ▼                         ▼                                               ║
║                   │  ┌────────────┐          ┌────────────┐                                           ║
║                   │  │ POST-EXEC  │          │ NO         │                                           ║
║                   │  │ CONFLICT   │          │ CONFLICT   │                                           ║
║                   │  └─────┬──────┘          └─────┬──────┘                                           ║
║                   │        │                       │                                                  ║
║                   │        ▼                       │                                                  ║
║                   │  ┌────────────────┐            │                                                  ║
║                   │  │ Add label:     │            │                                                  ║
║                   │  │ manual-        │            │                                                  ║
║                   │  │ intervention   │            │                                                  ║
║                   │  │                │            │                                                  ║
║                   │  │ Post conflict  │            │                                                  ║
║                   │  │ resolution     │            │                                                  ║
║                   │  │ comment        │            │                                                  ║
║                   │  └────────────────┘            │                                                  ║
║                   │                                │                                                  ║
║                   │                                │  ← Push triggers test.yml                        ║
║                   │                                │                                                  ║
║                   │                                ▼                                                  ║
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
│          │ - Final sync with main (handles race condition)                               │
│          │ - Push event triggers TEST workflow ──────────────────────────────────────────┘│
│          │                                                                                │
│          │ On actual merge conflict (pre-execution):                                      │
│          │ - Detects conflicts via git status (UU, AA, DD, AU, UA, DU, UD markers)       │
│          │ - Adds manual-intervention label                                               │
│          │ - Disables auto-merge (human review required)                                  │
│          │ - Posts error comment with conflict details                                    │
│          │                                                                                │
│          │ On actual merge conflict (post-execution):                                     │
│          │ - Detected during final sync step                                              │
│          │ - Adds manual-intervention label                                               │
│          │ - Posts post-execution conflict comment                                        │
│          │ - Human review required before tests can run                                   │
│          │                                                                                │
│          │ On merge failure without conflicts:                                            │
│          │ - Logs error details                                                           │
│          │ - Adds manual-intervention label (infrastructure issue)                        │
│          │ - Posts error comment                                                          │
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
│  create.spec.ts  CREATE-001     event          comment        for ~90 min    Auto-merge   │
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

1. No active TDD PR without `manual-intervention` label
2. Credit usage within limits (daily < $200, weekly < $1000)
3. At least one `.fixme()` spec exists

**Jobs:**

| Job               | Purpose                                | Outputs                        |
| ----------------- | -------------------------------------- | ------------------------------ |
| `check-active-pr` | Ensure no other TDD PR is processing   | `has-active`                   |
| `check-credits`   | Verify Claude Code spend within limits | `can-proceed`, `daily-spend`   |
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

| Condition                    | Action                                         |
| ---------------------------- | ---------------------------------------------- |
| TDD PR detected              | Identify via label OR branch name `tdd/*`      |
| Tests fail (attempts < max)  | Post `@claude` comment with failure details    |
| Tests fail (attempts >= max) | Add `tdd-automation:manual-intervention` label |
| Tests pass                   | Auto-merge proceeds                            |

**CI Optimization for .fixme() Removal:**

When a PR contains ONLY `.fixme()` removals from test files (i.e., test activation with no other code changes):

- **TypeCheck job is SKIPPED**: `.fixme()` removal doesn't change TypeScript code, so typecheck is guaranteed to pass. Skipping saves ~30s per run.
- **Detection logic**: `detect-change-type` job analyzes git diff and counts "significant" lines (non-`.fixme()`, non-file headers, non-empty). If significant changes = 0, sets `is_fixme_removal_only=true`.
- **Skip condition**: TypeCheck job checks `needs.detect-change-type.outputs.is_fixme_removal_only != 'true'` before running.
- **Other jobs still run**: Lint (for spec formatting), Unit Tests (unaffected), and E2E Tests (to verify the spec passes).
- **E2E Target Dependency Handling**: The `e2e-target` job uses `always()` + result check to run even when `typecheck` is skipped. GitHub Actions skips jobs when dependencies are skipped, so we explicitly check `needs.typecheck.result == 'skipped'` to allow execution.

**Rationale**: .fixme() removal activates a test but doesn't change its implementation. TypeScript validation adds no value since no code changed, only test execution status.

**Attempt Counting:**

- Read from PR title: `Attempt X/Y`
- Increment ONLY on **test failure** (E2E assertions fail)
- Do NOT count toward attempts:
  - **Sync requests**: Branch needs update from main
  - **Quality-only failures**: Lint/typecheck fail but tests pass (uses refactor-auditor agent)
  - **Infrastructure errors**: Network timeouts, GitHub API errors, CI runner issues
  - **Merge conflicts**: Require manual resolution (do NOT trigger @claude automatically)

**Rationale**: Attempts track "implementation tries", not "pipeline runs". Quality fixes are refinement, not core implementation. Conflicts pause automation until human resolves.

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
| 2. Checkout        | Checkout PR branch                                 |
| 3. Sync            | `git fetch && git merge origin/main`               |
| 4. Detect conflict | If conflict → add label, post comment, **exit**    |
| 5. Execute action  | Run `anthropics/claude-code-action@v1`             |
| 6. Final sync      | Merge any new commits from main after execution    |
| 7. Handle result   | Push changes if any, update PR title attempt count |

**Notes:**

- **Parallel execution prevention**: Handled by `test.yml` workflow. Only the **last** test.yml execution on a PR will post `@claude` comment. If multiple test runs are queued/running (e.g., from main branch updates), earlier runs skip triggering Claude Code - only the final run with the latest failure triggers execution.

- **Step 3 (Initial sync)**: Branch syncing is handled automatically by this workflow via merge strategy. The test workflow (`.github/workflows/test.yml`) does NOT check if the branch is behind main - syncing happens when Claude Code is triggered via `@claude` comment.

- **Step 6 (Final sync)**: Handles race condition where main branch advances during Claude Code's long execution (20-90 minutes). Without this step, the PR branch would be stale before `test.yml` runs.

**Agent Selection (via prompt):**

| Condition            | Agent                       | Focus                      |
| -------------------- | --------------------------- | -------------------------- |
| Test failure         | `e2e-test-fixer`            | Minimal code to pass tests |
| Quality failure only | `codebase-refactor-auditor` | Code quality improvements  |

**Conflict Detection and Early Exit:**

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
     - Add `tdd-automation:manual-intervention` label
     - Disable auto-merge (requires human review)
     - Post comment with conflict resolution instructions
     - Abort merge and **exit workflow early** (do NOT run Claude Code)
   - Rationale: Conflicts require human resolution. Running Claude Code would waste credits with low success rate.

2. **Merge Failures Without Conflicts** - Git errors, network issues, etc.
   - No conflict markers found in `git status --porcelain`
   - Actions taken:
     - Abort merge if in progress
     - Log error details (merge output, git status)
     - Fail the workflow with error message
     - Do NOT add conflict label (not a conflict)
   - Rationale: Infrastructure issues should be investigated separately, not treated as conflicts.

**Why Early Exit for Conflicts?**

Previously, conflicts triggered Claude Code execution with special prompts. This was problematic:

- Low success rate (conflicts often require domain knowledge)
- Wasted credits ($5 per run)
- Confusing state (PR labeled for manual intervention while automation runs)
- Documentation mismatch (docs said "pause for human review" but workflow continued)

Now, conflicts immediately pause automation and wait for human resolution.

---

## Removed Workflows

### 4. Recovery Workflow (Removed 2026-01-28)

**Status**: Removed in favor of simplified error handling

**File** (deleted): `.github/workflows/recovery.yml`

**Replacement**: Manual intervention is now simplified:

1. Review the error comment on the PR
2. Fix the underlying issue (spec, codebase, or infrastructure)
3. Remove `tdd-automation:manual-intervention` label
4. Post `@claude` comment to retry

All errors now follow this single path instead of complex categorization and multiple recovery actions.

---

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
         ├── Tests fail ────────────┤
         │   Post @claude           │
         │   Claude Code runs       │
         │   Success → push ────────┘
         │   changes
         │
         └── Claude Code ───────────┐
             error (any type)       │
                                    ▼
                          ┌──────────────────────┐
                          │ manual-intervention  │
                          │ (PR stays open)      │
                          │ (PR Creator          │
                          │  continues)          │
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
| Daily  | $160    | $200       | Log warning / Skip |
| Weekly | $800    | $1000      | Log warning / Skip |

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
| **Daily**  | $42.15  | $200  | $157.85   | 21%    | 54   | 18h      |
| **Weekly** | $123.67 | $1000 | $876.33   | 12%    | 158  | 5d       |

**Notes:**

- Actual costs extracted from Claude Code execution results
- Comment posted before Claude Code runs (not after)
- Provides transparency for all TDD PRs, not just when limits are hit
- Concise format focuses on critical budget information for decision-making

---

## Error Handling

### Automatic Error Detection and Labeling

The pipeline implements **comprehensive automatic error detection** that catches all failure scenarios and applies the `tdd-automation:manual-intervention` label. This ensures PRs requiring human review are never silently ignored.

#### Error Detection Scenarios

The workflow automatically detects and handles these error scenarios:

| Scenario                       | Detection Method                                      | Label Applied                        | Comment Posted    |
| ------------------------------ | ----------------------------------------------------- | ------------------------------------ | ----------------- |
| **Claude Code execution fail** | `result-subtype != 'success'`                         | `tdd-automation:manual-intervention` | ✅ Detailed error |
| **No commits pushed**          | Git check shows 0 commits after "success"             | `tdd-automation:manual-intervention` | ✅ Silent failure |
| **Workflow timeout**           | Job exceeds timeout limit                             | `tdd-automation:manual-intervention` | ✅ Timeout error  |
| **Action crash**               | Claude Code action fails to start/complete            | `tdd-automation:manual-intervention` | ✅ Crash details  |
| **Merge conflict**             | Git merge with main fails (conflict markers detected) | `tdd-automation:manual-intervention` | ✅ Conflict files |
| **Git operation error**        | Git push/pull fails for non-conflict reasons          | `tdd-automation:manual-intervention` | ✅ Generic error  |

#### Three-Layer Error Detection

**Layer 1: Claude Code Result Parsing** (lines 551-595)

- Parses execution result JSON from Claude Code action
- Detects: `error_max_turns`, `error_max_budget_usd`, `error_during_execution`, `error_max_structured_output_retries`

**Layer 2: Silent Failure Detection** (lines 664-710, NEW)

- Checks if commits were actually pushed after "success"
- Detects: Agent reported success but made no changes
- Catches: Git push failures, workflow issues

**Layer 3: Catch-All Safety Net** (lines 711-755, NEW)

- Runs if any workflow step fails (`if: failure()`)
- Detects: Timeouts, crashes, unexpected errors
- Ensures: No error escapes without label

#### Error Handling Flow

All errors follow the same simplified flow:

1. **Detect error** (via result parsing, commit check, or workflow failure)
2. **Add manual-intervention label** (blocks PR Creator from retrying this spec)
3. **Post detailed comment** (error type, metrics, next steps)
4. **Trigger PR Creator** (continues with next spec)
5. **Keep PR open** (awaits human review)

**Simplified Error Handling** (enhanced 2026-01-29):

All errors follow the same flow:

1. Post detailed error comment to PR (includes error type, metrics, next steps)
2. Add `tdd-automation:manual-intervention` label
3. Trigger PR Creator to pick up next spec
4. Keep PR open for human review

**Rationale**: Three-layer detection ensures no error goes unlabeled. All failures require human review, with clear next steps provided in comments.

### Error Types and Detection Logic

The TDD pipeline implements **simplified error handling** where ALL Claude Code errors result in the same action - post error comment, add manual-intervention label, keep PR open, and trigger PR Creator to process next spec.

#### Detected Error Types

All errors are handled identically, regardless of type. These subtypes are reported for informational purposes only:

| Error Subtype                         | Description                                        | Handling                    |
| ------------------------------------- | -------------------------------------------------- | --------------------------- |
| `error_max_turns`                     | Exceeded max turns (50 for e2e-test-fixer)         | Label + comment + next spec |
| `error_max_budget_usd`                | Exceeded $5 per-run budget limit                   | Label + comment + next spec |
| `error_during_execution`              | Agent encountered error during execution           | Label + comment + next spec |
| `error_max_structured_output_retries` | Claude output parsing failed repeatedly            | Label + comment + next spec |
| `no_commits_pushed` (NEW)             | Execution succeeded but no commits were pushed     | Label + comment + next spec |
| `unknown` (NEW)                       | Workflow-level failure (timeout, crash, git error) | Label + comment + next spec |

**Key Insight**: Error categorization is informational only. All errors trigger identical handling to ensure consistency and simplicity.

#### Error Handling Flow

```
┌─────────────────────────────────────────────────────────────┐
│ Layer 1: Parse Claude Code Result                           │
│ ├─ success → Continue to final sync                         │
│ └─ error_* → Handle error                                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ Layer 2: Check Commits Pushed (even if "success")           │
│ ├─ Commits found → Continue to final sync                   │
│ └─ No commits → Handle as silent failure                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ Layer 3: Catch-All Workflow Failures                        │
│ ├─ if: failure() → Handle unexpected errors                 │
│ └─ Checks if label already added (avoid duplicates)         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │ Handle All Errors│
                    └────────┬─────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ Post Comment │    │ Add Label    │    │ Trigger PR   │
│ with details │    │ manual-      │    │ Creator      │
│ & next steps │    │ intervention │    │              │
└──────────────┘    └──────────────┘    └──────────────┘
        │                    │                    │
        └────────────────────┼────────────────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │ Keep PR Open     │
                    │ (awaits review)  │
                    └──────────────────┘
                             │
                             ▼
                    ┌──────────────────┐
                    │ Next Spec        │
                    │ Processed        │
                    └──────────────────┘
```

**Key Behavior**: ALL errors follow this single path - no automatic retries, no PR closure. Human reviews failed specs while pipeline continues with other specs.

#### Cost Protection

- **Per-run limit**: $10.00 (enforced by `--max-budget-usd` in Claude Code)
- **Daily limit**: $200 (checked before execution, blocks workflow if exceeded)
- **Weekly limit**: $1000 (checked before execution, blocks workflow if exceeded)
- **Cost tracking**: Actual Claude Code costs extracted from workflow logs and displayed in credit usage comments

#### Credit Exhaustion Detection (Probe)

In addition to budget-based credit checks, the pipeline probes the Claude Code API to detect actual credit exhaustion using a **workflow-based approach** (not API-based).

**Probe Method** (`.github/workflows/pr-creator.yml` lines 30-41):

- **Action**: `anthropics/claude-code-action@v1` (same action used for TDD execution)
- **Prompt**: `"hi"` (minimal, 1-2 tokens)
- **Arguments**: `--max-turns 1 --max-budget-usd 0.01` (fastest, cheapest)
- **Cost**: ~$0.01 per probe (only when no active PR exists)
- **Timing**: AFTER active PR check, BEFORE budget check (first step in `check-credits` job)
- **Timeout**: 2 minutes maximum
- **Fail-safe**: `continue-on-error: true` (probe failure doesn't block workflow)

**Detection Pattern** (`parse-probe` step, lines 42-81):

Exhaustion is detected when BOTH conditions are true in the execution result JSON:

```
is_error === true  AND  total_cost_usd === 0
```

**Why this pattern works**:

- Normal errors (timeouts, API errors): `is_error=true` but `total_cost_usd > 0` (usage occurred)
- Credit exhaustion: `is_error=true` AND `total_cost_usd=0` (no usage, request blocked)

**Probe Result Parsing**:

The workflow extracts the following from Claude Code's `execution_file` JSON:

| Field            | Used For                                      | Example Value                      |
| ---------------- | --------------------------------------------- | ---------------------------------- |
| `is_error`       | Detect execution failure                      | `true`                             |
| `total_cost_usd` | Differentiate exhaustion (0) from errors (>0) | `0` (exhausted) or `0.78` (normal) |
| `errors`         | Error message details                         | `["Credits exhausted"]`            |

**Environment Variable Handoff** (lines 83-94):

The probe result is passed to the credit check script via environment variables:

- `PROBE_EXHAUSTED=true` → Exhaustion detected (blocks workflow)
- `PROBE_EXHAUSTED=false` → Credits available (continues)
- `PROBE_FAILED=true` → Probe failed (graceful degradation, continues with budget check only)

**Differentiation**:

- `CreditLimitExceeded`: Over budget ($200/day, $1000/week) → Budget-based block
- `CreditsExhausted`: Workflow probe detected exhaustion (`is_error=true AND cost=0`) → API-level block

**Error Handling (Fail-Safe Design)**:

1. **Probe succeeds** → Parse result, detect exhaustion or availability
2. **Probe fails (no execution_file)** → Set `PROBE_FAILED=true`, continue with budget check only
3. **Parse fails (invalid JSON)** → Set `PROBE_FAILED=true`, continue with budget check only
4. **Exhaustion detected** → Fail immediately with `CreditsExhausted` error (before budget check)
5. **Probe available** → Continue to budget check

**Graceful Degradation**:

If the probe step fails for ANY reason (network, API error, timeout, invalid JSON):

- Workflow logs warning: `⚠️ Probe failed, assuming credits available`
- Sets `PROBE_FAILED=true` environment variable
- Budget check script logs: `Claude Code API probe failed, continuing with budget check only`
- Workflow continues with traditional budget-based credit checks ($200/day, $1000/week)

**Benefits**:

1. **Detects exhaustion beyond budget tracking** - Catches API-level exhaustion even if budget shows availability
2. **Prevents wasted execution attempts** - Blocks workflow before creating PR if credits exhausted
3. **Fail-safe design** - Probe failure doesn't break workflow (falls back to budget check)
4. **Minimal cost overhead** - ~$0.01 per check (vs. $5-15 wasted on failed execution)
5. **Clear user messaging** - Actionable error messages in workflow summary
6. **No API implementation** - Uses existing Claude Code action (no custom API client needed)

#### Manual Recovery Process

When Claude Code fails (any error type):

1. **Review error details** in the PR comment posted by Claude Code
2. **Fix the underlying issue** (spec clarity, codebase bug, infrastructure)
3. **Remove `tdd-automation:manual-intervention` label** from the PR
4. **Post `@claude` comment** to trigger a new attempt

All errors follow this single, simplified recovery flow.

### Error Recovery Guide

This section describes how to respond to different error scenarios detected by the three-layer error detection system.

#### Recovery by Error Type

| Error Scenario                           | Auto Action                                      | Manual Recovery                                        |
| ---------------------------------------- | ------------------------------------------------ | ------------------------------------------------------ |
| **Claude Code execution error**          | Post error comment + `manual-intervention` label | Review error logs, fix spec/code, remove label, retry  |
| **No commits pushed** (silent failure)   | Post silent failure comment + label              | Review logs, check why no changes, remove label, retry |
| **Workflow timeout**                     | Post timeout comment + label                     | Increase `@tdd-timeout`, remove label, retry           |
| **Action crash** (SDK/infrastructure)    | Post crash comment + label                       | Report to Anthropic, wait for fix, retry               |
| **Merge conflict** (main branch updated) | Post conflict comment + label                    | Resolve conflicts manually, remove label, retry        |
| **Git operation error**                  | Post git error comment + label                   | Check git logs, fix issue, remove label, retry         |

#### Standard Manual Recovery Steps

For ALL error types:

1. **Check error details** in the PR comment posted by the workflow
2. **Investigate root cause**:
   - Spec issue? (unclear requirements, incorrect assertions)
   - Codebase bug? (missing dependencies, broken imports)
   - Infrastructure? (GitHub API, network, timeout)
3. **Fix the underlying problem** (update spec, fix code, adjust timeout)
4. **Remove `tdd-automation:manual-intervention` label** (via GitHub UI)
5. **Post `@claude` comment** to trigger retry

#### Common Error Scenarios and Solutions

**Scenario: No Commits Pushed**

- **Symptom**: Claude Code reports success but PR has no new commits
- **Causes**: Git push failed silently, agent made no changes, workflow timeout during push
- **Solution**: Review execution logs, check git status, ensure agent made intended changes

**Scenario: Workflow Timeout**

- **Symptom**: Job exceeds configured timeout (default 90 minutes)
- **Causes**: Spec too complex, slow Claude Code execution, network issues
- **Solution**: Add `@tdd-timeout 120` annotation to spec file, or simplify spec

**Scenario: Merge Conflict**

- **Symptom**: Cannot merge main branch (conflict markers detected)
- **Causes**: Main branch updated during execution, overlapping changes
- **Solution**: Manually resolve conflicts in affected files, commit, push

**When Manual Recovery is NOT Needed**:

- ✅ **Auto-merge pending** - test workflow handles auto-merge enablement

### Error Detection Pipeline

**Workflow**: `.github/workflows/claude-code.yml` (after Claude Code action)

1. **Parse Claude Code Result**
   - Reads `execution_file` output from action
   - Extracts `result.subtype` and `result.errors` from JSON
   - Outputs: `result-subtype`, `error-message`

2. **Extract Error Details**
   - Extracts error message and execution metrics (duration, turns, cost)
   - Outputs: `error-message`, `duration-formatted`, `num-turns`, `total-cost`

3. **Handle All Errors Uniformly**
   - Post detailed error comment with execution metrics
   - Add `tdd-automation:manual-intervention` label
   - Keep PR open for manual review
   - Trigger PR Creator to process next spec

### Execution Metrics in PR Comments

**Decision**: Post execution metrics (duration, turns, total cost) in PR comments after Claude Code execution completes.

**Purpose**: Transparency and observability of Claude Code execution costs and efficiency.

**When Posted**:

- **On Success**: After Claude Code executes successfully (before tests run)
- **On Error**: Included in error comment (PR remains open for manual review)

**Metrics Included**:

| Metric         | Source Field     | Example Value | Description                                |
| -------------- | ---------------- | ------------- | ------------------------------------------ |
| **Duration**   | `duration_ms`    | `626421` ms   | Total execution time in milliseconds       |
| **Turns**      | `num_turns`      | `10`          | Number of conversation turns with Claude   |
| **Total Cost** | `total_cost_usd` | `$0.78`       | Actual cost in USD from Claude Code action |

**Comment Format**:

#### Success Comment

```markdown
✅ **Claude Code Execution Succeeded**

**Execution Metrics**:

- **Duration**: 10m 26s
- **Turns**: 10
- **Total Cost**: $0.78

Changes pushed successfully. Tests will run next.
```

#### Error Comment (Retryable Errors)

```markdown
⚠️ **Claude Code Execution Failed (Retryable Error)**

**Error Category**: `transient`
**Error Message**:
```

Network timeout during test execution

```

**Execution Metrics**:
- **Duration**: 15m 32s
- **Turns**: 23
- **Total Cost**: $1.45

**Attempt**: 2/5
**Backoff Delay**: 180s

**Automatic Recovery**: Retrying after exponential backoff...

---
_Automated retry triggered by TDD pipeline error handling_
```

#### Error Comment (Non-Retriable Errors)

```markdown
❌ **TDD Automation Failed: Spec too complex (exceeded 50 conversation turns)**

**Error Category**: `max_turns`
**Spec ID**: `API-TABLES-CREATE-001`

**Reason**: This spec requires too many steps to implement. Consider breaking it into smaller specs or simplifying the requirements.

**Execution Metrics**:

- **Duration**: 42m 15s
- **Turns**: 50
- **Total Cost**: $3.85

**What This Means**:

- This PR cannot be automatically implemented
- Manual intervention is required

**Recovery**:

1. Review the error above
2. Fix the spec or codebase issue
3. Remove `tdd-automation:manual-intervention` label
4. Post `@claude` comment to retry

---

_Automated closure by TDD pipeline error handling_
```

**Rationale**:

1. **Cost Transparency**: Developers see actual Claude Code costs per attempt
2. **Efficiency Tracking**: Duration and turns indicate if specs are well-defined
3. **Budget Awareness**: Total cost helps identify expensive specs early
4. **Debugging Aid**: Metrics patterns (high turns, long duration) suggest spec clarity issues

**Implementation**:

- Extract metrics from `execution_file` JSON output by Claude Code action
- Format duration from milliseconds to human-readable (e.g., "10m 26s")
- Include in both success and error comments
- Cost tracking remains separate (credit usage comment posted before execution)

**Data Source**: Claude Code action outputs `execution_file` containing:

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

### Per-Run Budget Protection

**Budget Limit**: $10.00 per Claude Code execution

**Configuration**: Added to `claude_args` in `.github/workflows/claude-code.yml`:

```yaml
claude_args: ${{ steps.agent-config.outputs.claude-args }} --max-budget-usd 10.00
```

**Behavior**:

- Claude Code stops execution when approaching $10.00
- Returns `error_max_budget_usd` result subtype
- Pipeline adds `tdd-automation:manual-intervention` label and posts error details
- Daily/weekly limits still enforced (defense in depth)

**Rationale**:

- Prevents runaway costs from single spec
- Complements daily ($200) and weekly ($1000) limits
- Conservative limit encourages efficient spec design

### Error Messages and Comments

**Error Comment Format** (posted for all errors):

```markdown
❌ **Claude Code Execution Failed**

**Error Type**: `max_turns`
**Spec ID**: `SPEC-123`

**Error Details**:
```

[detailed error message from Claude Code]

```

**Execution Metrics**:
- **Duration**: 10m 26s
- **Turns**: 50
- **Total Cost**: $4.78

**Recovery**:
1. Review the error above
2. Fix the spec or codebase issue
3. Remove `tdd-automation:manual-intervention` label
4. Post `@claude` comment to retry

**Note**: This PR remains open for review. Other specs will continue processing automatically.

---

_TDD Automation paused for this spec - pipeline continues with next spec_
```

### Manual Recovery Process

All TDD errors now follow a single, simplified recovery flow:

1. **Review Error**: Check the error comment posted on the PR for details
2. **Fix Issue**: Address the underlying problem (spec clarity, codebase bug, infrastructure)
3. **Remove Label**: Remove `tdd-automation:manual-intervention` label from PR
4. **Retry**: Post `@claude` comment to trigger Claude Code

### Common Recovery Scenarios

#### Scenario 1: Transient Error (Network, Timeout)

**Symptom**: Error message shows network timeout, API rate limit (429, 502, 503), or similar transient issue.

**Recovery**: Remove `manual-intervention` label and post `@claude` comment. The issue likely resolves on retry.

---

#### Scenario 2: Spec Clarity Issue

**Symptom**: Agent struggles with unclear requirements or contradictory spec statements.

**Recovery**: Clarify the spec file, then remove `manual-intervention` label and post `@claude` comment.

---

#### Scenario 3: Codebase Bug

**Symptom**: Agent fails due to missing dependency, broken test helper, or codebase issue.

**Recovery**: Fix the codebase issue, then remove `manual-intervention` label and post `@claude` comment.

---

#### Scenario 4: Complete Restart Needed

**Symptom**: Implementation approach was wrong and spec needs rewriting.

**Recovery**: Close the PR, add `.fixme()` back to spec, rewrite spec with correct approach, then let PR Creator pick it up again.

---

#### Scenario 5: Budget Limit Hit, Need to Increase or Simplify

**Symptom**: Claude Code failed with `error_max_budget_usd` (hit $10.00 per-run limit). Spec might be legitimately complex and need higher budget, or might need simplification.

**Analysis Steps**:

1. Review spec complexity - is it testing too many behaviors at once?
2. Check turn count - did it use 40+ turns? (indicates max_turns would have been hit anyway)
3. Evaluate if spec can be broken down into smaller tests

**Action Options**:

- **If spec is valid but expensive**: Increase `MAX_BUDGET_PER_RUN` in claude-code.yml (e.g., $10 → $15)
- **If spec is too complex**: Use `mark-for-spec-review` to simplify spec
- **If uncertain**: Manual implementation, then adjust budget/spec based on learnings

**No recovery workflow action needed** - this requires workflow configuration change or spec simplification.

---

#### Scenario 6: Merge Conflict After Main Branch Update

**Symptom**: PR shows merge conflict after new commits merged to main branch.

**Action**: **Manual resolution required** - workflow detects conflict, adds `manual-intervention` label, posts resolution instructions, and exits early without running Claude Code.

**Recovery Steps**:

1. Check PR comment for conflict details (affected files listed)
2. Checkout branch: `git checkout tdd/<spec-id>`
3. Merge main: `git merge origin/main`
4. Resolve conflicts manually in listed files
5. Stage resolved files: `git add <files>`
6. Complete merge: `git commit`
7. Push: `git push`
8. Remove `manual-intervention` label
9. Post `@claude` comment to resume automation

**Why manual?** Conflicts require domain knowledge and have low automation success rate. Early exit saves credits and ensures human review.

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
3. **Recovery**:
   - If transient: Remove `manual-intervention` label, post `@claude` comment
   - If codebase issue: Fix code, remove label, post `@claude` comment
   - If spec issue: Clarify spec, remove label, post `@claude` comment

**No immediate recovery action** - investigate first, then decide.

### Error Handling Workflow Diagram

```
Claude Code Action
       ↓
[Parse Result] → result-subtype, error-message
       ↓
[Categorize Error] → error-category, should-retry
       ↓
[Handle Error]
       ↓
Post Error Comment
       ↓
Add manual-intervention Label
       ↓
Keep PR Open
       ↓
Trigger PR Creator
       ↓
Next Spec Processed
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

1. **Per-Run Budget** ($10.00)
   - Immediate protection against runaway costs
   - Prevents single spec from consuming entire daily budget
   - Enforced by Claude Code CLI (`--max-budget-usd`)

2. **Daily Limit** ($200)
   - Aggregate limit across all executions
   - 20 executions at $10.00 each (realistic)
   - Enforced by validation job (blocks execution)

3. **Weekly Limit** ($1000)
   - Rolling 7-day window
   - 100 executions at $10.00 each
   - Enforced by validation job (blocks execution)

**Monitoring**:

- Credit usage comment posted before every execution
- Shows actual costs (not estimates)
- Displays remaining budget and reset timers
- 80% warning thresholds ($160 daily, $800 weekly)

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
  - Average ~60 min/spec realistic (230 × 1h = 230h = ~10 days)
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

| Decision                 | Choice                                          | Rationale                                                |
| ------------------------ | ----------------------------------------------- | -------------------------------------------------------- |
| **PR Creator job order** | check-active-pr → check-credits → create-pr     | Free GitHub API check first, skip costly probe if active |
| Cron frequency           | Hourly (backup only)                            | Chain reaction via `workflow_run` handles most cases     |
| Max attempts             | 5 (default, configurable)                       | Increased from 3 for 230-spec reliability                |
| Label names              | `tdd-automation`, `:manual-intervention`        | Simplified to 2 labels (2026-01-28)                      |
| Branch naming            | `tdd/<spec-id>`                                 | Simple, serves as backup identifier                      |
| @claude comment format   | Agent-specific with file paths                  | Enables correct agent selection                          |
| Credit limits            | $200/day, $1000/week (+ $10/run)                | Three-layer defense: per-run, daily, weekly              |
| Per-run budget limit     | $10.00                                          | Prevents runaway costs from single spec                  |
| Cost tracking            | Actual costs from Claude Code result JSON       | Accurate tracking vs. $15 estimates                      |
| Cost parsing             | JSON result + multi-pattern fallback            | Handles format changes gracefully                        |
| Sync strategy            | Merge (not rebase)                              | Safer, no force-push, better for automation              |
| Conflict counting        | Not counted as attempt                          | Infrastructure issue, not code failure                   |
| Error handling           | Pattern matching (conservative)                 | Distinguish transient vs. persistent errors              |
| Retry strategy           | Transient errors retry, persistent errors close | Avoid infinite loops, clear failure path                 |
| Unknown errors           | Retry once, then manual intervention            | Conservative approach for unexpected failures            |
| Recovery actions         | Manual workflow_dispatch triggers               | Flexible recovery without pipeline re-runs               |
| Commit detection         | SHA comparison (not commit counting)            | Accurate push verification, handles divergence           |

### PR Creator Job Ordering (Cost Optimization)

**Decision**: Check for active PRs BEFORE checking credits (2026-01-30)

**Rationale**: The `check-active-pr` job uses a free GitHub API call, while `check-credits` makes a costly Claude Code API probe (~$0.01 per run). By checking for active PRs first, we avoid unnecessary API costs when serial processing constraints already prevent PR creation.

**Cost Savings**:

- **Without optimization**: Every PR Creator run pays ~$0.01 probe cost
- **With optimization**: Probe cost only paid when no active PR exists
- **Expected savings**: ~50-70% of runs skip credit check (active PR already in progress)
- **Annual savings**: Assuming hourly cron triggers: ~$40-60/year

**Implementation Details**:

1. `check-active-pr` job runs first (no dependencies)
   - Queries GitHub API for open TDD PRs without `manual-intervention` label
   - Outputs `has-active: true/false`
   - **Cost**: Free (GitHub API call)

2. `check-credits` job runs second (`needs: check-active-pr`)
   - Only executes if `check-active-pr.outputs.has-active == 'false'`
   - Probes Claude Code API with minimal prompt ("hi")
   - Detects credit exhaustion and checks budget limits
   - **Cost**: ~$0.01 per probe (only when needed)

3. `create-pr` job runs third (`needs: [check-active-pr, check-credits]`)
   - Only executes if both conditions met:
     - No active PR (`has-active == 'false'`)
     - Credits available (`can-proceed == 'true'`)

**Trade-offs**:

- ✅ **Pro**: Significant cost savings (~50-70% reduction in probe costs)
- ✅ **Pro**: Faster workflow execution when active PR exists (skips credit probe)
- ✅ **Pro**: No functional changes (same preconditions enforced)
- ❌ **Con**: None identified (strictly better than original order)

### Commit Detection After Push (SHA Comparison Strategy)

**Problem Identified (2026-01-29)**: The original implementation used `git rev-list --count HEAD..origin/branch` which had a **backwards comparison** - it counted how many commits the _remote_ was ahead of _local_, not the other way around. This caused false positives when Claude Code succeeded but git push failed silently.

**Root Cause**: The comparison was inverted. After a successful push:

- `HEAD..origin/branch` (incorrect) → 0 commits (remote matches local) → interpreted as "no commits pushed"
- `origin/branch..HEAD` (what we wanted) → would show commits if push failed

**Solution**: Replace commit counting with **SHA comparison** for unambiguous push verification.

#### Implementation (claude-code.yml, lines ~664-714)

```yaml
# Fetch remote branch to get latest SHA
git fetch origin ${{ needs.validate.outputs.pr-branch }}

# Get SHAs for comparison
LOCAL_SHA=$(git rev-parse HEAD)
REMOTE_SHA=$(git rev-parse origin/${{ needs.validate.outputs.pr-branch }})

if [ "$LOCAL_SHA" = "$REMOTE_SHA" ]; then
  # SUCCESS: Local and remote are in sync (push succeeded)
  echo "has-commits=true" >> "$GITHUB_OUTPUT"
else
  # Determine which is ahead for diagnostics
  LOCAL_AHEAD=$(git rev-list --count origin/branch..HEAD)
  REMOTE_AHEAD=$(git rev-list --count HEAD..origin/branch)

  if [ "$LOCAL_AHEAD" -gt 0 ] && [ "$REMOTE_AHEAD" -eq 0 ]; then
    # FAILURE: Local has commits that weren't pushed
    echo "has-commits=false" >> "$GITHUB_OUTPUT"
  elif [ "$REMOTE_AHEAD" -gt 0 ]; then
    # UNEXPECTED: Remote is ahead (concurrent modifications)
    echo "has-commits=unknown" >> "$GITHUB_OUTPUT"
  else
    # DIVERGED: Both ahead (conflict state)
    echo "has-commits=unknown" >> "$GITHUB_OUTPUT"
  fi
fi
```

#### Why SHA Comparison Is Better

| Approach            | Pros                                            | Cons                                       |
| ------------------- | ----------------------------------------------- | ------------------------------------------ |
| **Commit Counting** | Shows how many commits differ                   | Direction matters (easy to get backwards)  |
| **SHA Comparison**  | Unambiguous (equal = synced, not = out of sync) | Doesn't show magnitude without extra steps |

**Key Insight**: We don't need to know _how many_ commits differ - we just need to know if the push succeeded. SHA comparison answers that directly.

#### Expected Scenarios

| Scenario                    | Local SHA | Remote SHA | Output                | Meaning                                         |
| --------------------------- | --------- | ---------- | --------------------- | ----------------------------------------------- |
| **Successful push**         | abc123    | abc123     | `has-commits=true`    | Claude Code pushed successfully                 |
| **Push failed silently**    | abc123    | def456     | `has-commits=false`   | Local ahead, commits not on remote (diagnostic) |
| **Concurrent modification** | abc123    | def456     | `has-commits=unknown` | Remote ahead (unexpected, warn)                 |
| **Diverged branches**       | abc123    | def456     | `has-commits=unknown` | Both ahead (conflict, needs manual resolution)  |
| **Fetch failure**           | N/A       | N/A        | `has-commits=unknown` | Network/branch issue (error handling)           |

#### Diagnostic Information

When SHAs differ, the implementation provides **actionable diagnostics** using commit counting:

```bash
LOCAL_AHEAD=$(git rev-list --count origin/branch..HEAD)   # Correct direction
REMOTE_AHEAD=$(git rev-list --count HEAD..origin/branch)  # Correct direction

echo "Local ahead:  $LOCAL_AHEAD commits"
echo "Remote ahead: $REMOTE_AHEAD commits"
```

This helps operators understand _why_ the SHAs differ without affecting the pass/fail decision.

#### Benefits

1. **Correctness**: SHA comparison cannot be backwards (equal = equal, period)
2. **Clarity**: "Are local and remote the same?" is clearer than "How many commits in X..Y?"
3. **Robustness**: Handles all edge cases (divergence, concurrent modifications)
4. **Diagnostics**: Commit counts added only when useful (for debugging)
5. **Maintainability**: Simpler logic, harder to break

---

## Per-Spec Configuration

Specs can include inline configuration via comments in the format:

- `@tdd-max-attempts <number>` - Override default 5 attempts
- `@tdd-timeout <minutes>` - Override default 90 min timeout

**Parsing:** See `scripts/tdd-automation/core/spec-scanner.ts` for comment parsing implementation and supported configuration keys.

---

## Comment Templates

Automated comments are posted by workflows for different scenarios:

- **Test Workflow**: `.github/workflows/test.yml`
  - Test failure notifications with spec context
  - Quality failure notifications (lint/typecheck)
  - Manual intervention notifications (max attempts exceeded)

- **Claude Code Workflow**: `.github/workflows/claude-code.yml`
  - Branch sync (merge) operation status
  - Merge conflict manual resolution instructions (informational, not triggering @claude)
  - Agent-specific prompt construction (for successful sync)

**Note**:

- Branch syncing is handled automatically by `claude-code.yml` via merge strategy (not test.yml)
- Merge conflict comments do NOT include `@claude` - they provide manual resolution instructions only
- After manual conflict resolution, human removes `manual-intervention` label and posts `@claude` to resume automation

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
