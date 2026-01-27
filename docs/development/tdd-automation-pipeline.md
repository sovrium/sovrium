# TDD Automation Pipeline - Implementation Specification

> **Status**: ✅ READY FOR IMPLEMENTATION
> **Last Updated**: 2025-01-27
> **Scope**: 230 pending specs over ~6-8 days

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Quick Reference](#quick-reference)
3. [Architecture](#architecture)
4. [Workflow Details](#workflow-details)
   - [PR Creator Workflow](#1-pr-creator-workflow-pr-creatoryml)
   - [Test Workflow](#2-test-workflow-testyml)
   - [Claude Code Workflow](#3-claude-code-workflow-claude-codeyml)
   - [Merge Watchdog Workflow](#4-merge-watchdog-workflow-merge-watchdogyml)
5. [State Management](#label-based-state-machine)
6. [Cost Protection](#claude-code-credit-usage-protection)
7. [Implementation Plan](#implementation-plan)

---

## Executive Summary

This pipeline represents a **complete simplification** of TDD automation. The key insight: **GitHub's native features (PRs, labels, comments) already provide the state management we need** - no custom JSON state file required.

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

| Workflow             | Trigger                                | Purpose                              |
| -------------------- | -------------------------------------- | ------------------------------------ |
| `pr-creator.yml`     | Hourly cron + test.yml success on main | Creates next TDD PR                  |
| `test.yml`           | Push to any branch                     | Runs tests, posts @claude on failure |
| `claude-code.yml`    | @claude comment on PR                  | Executes Claude Code to fix code     |
| `merge-watchdog.yml` | Every 30 min                           | Unsticks stuck PRs                   |

### Cost Limits

| Threshold  | Daily | Weekly | Action        |
| ---------- | ----- | ------ | ------------- |
| Warning    | $80   | $400   | Log warning   |
| Hard Limit | $100  | $500   | Skip workflow |

---

## Overview

This pipeline represents a complete simplification of TDD automation. The key insight is that **GitHub's native features (PRs, labels, comments) already provide the state management we need** - no custom JSON state file required.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         TDD AUTOMATION PIPELINE                              │
│                                                                              │
│  ┌─────────────┐         ┌─────────────┐         ┌─────────────┐           │
│  │ PR Creator  │────────▶│    Test     │────────▶│ Claude Code │           │
│  │  Workflow   │         │  Workflow   │         │  Workflow   │           │
│  └─────────────┘         └─────────────┘         └─────────────┘           │
│        │                       │                       │                    │
│        │                       │                       │                    │
│        ▼                       ▼                       ▼                    │
│  ┌─────────────┐         ┌─────────────┐         ┌─────────────┐           │
│  │ Creates PR  │         │ Runs tests  │         │ Fixes code  │           │
│  │ with label  │         │ Posts @claude│        │ Pushes fix  │           │
│  └─────────────┘         └─────────────┘         └─────────────┘           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Workflow Diagram

```
                                    ┌───────────────┐
                                    │  Cron (hourly)│
                                    │      OR       │
                                    │ test.yml pass │
                                    └───────┬───────┘
                                            │
                                            ▼
                              ┌─────────────────────────────┐
                              │     PR CREATOR WORKFLOW     │
                              │                             │
                              │  0. Check Claude Code spend │
                              │     Daily < $100?           │
                              │     Weekly < $500?          │
                              │     If over → EXIT          │
                              │                             │
                              │  1. Check: any active TDD   │
                              │     PR without manual-      │
                              │     intervention label?     │
                              │                             │
                              │  2. If yes → EXIT           │
                              │     (one at a time)         │
                              │                             │
                              │  3. Find next .fixme() spec │
                              │     using priority calc     │
                              │                             │
                              │  4. Exclude specs already   │
                              │     in manual-intervention  │
                              │     PRs                     │
                              │                             │
                              │  5. Remove .fixme()         │
                              │     Commit + Create PR      │
                              │     Label: tdd-automation   │
                              │     Enable auto-merge       │
                              └─────────────┬───────────────┘
                                            │
                                            │ PR created
                                            ▼
                              ┌─────────────────────────────┐
                              │       TEST WORKFLOW         │
                              │    (triggered on push)      │
                              │                             │
                              │  Analyze changes:           │
                              │                             │
                              │  ┌─────────────────────┐    │
                              │  │ Only .fixme removed │    │
                              │  │ from spec file?     │    │
                              │  └──────────┬──────────┘    │
                              │             │               │
                              │      YES    │    NO         │
                              │      │      │    │          │
                              │      ▼      │    ▼          │
                              │  ┌──────┐   │ ┌──────────┐  │
                              │  │ Run  │   │ │ Test +   │  │
                              │  │ only │   │ │ src code │  │
                              │  │ this │   │ │ changed? │  │
                              │  │ test │   │ └────┬─────┘  │
                              │  └──┬───┘   │   YES│  NO    │
                              │     │       │      │   │    │
                              │     │       │      ▼   ▼    │
                              │     │       │  ┌────┐ ┌───┐ │
                              │     │       │  │Qual│ │Qua│ │
                              │     │       │  │+Reg│ │+  │ │
                              │     │       │  │Test│ │Tst│ │
                              │     │       │  └──┬─┘ └─┬─┘ │
                              │     │       │     │     │   │
                              └─────┼───────┼─────┼─────┼───┘
                                    │       │     │     │
                                    └───┬───┴─────┴─────┘
                                        │
                            ┌───────────┼───────────┐
                            │           │           │
                            ▼           ▼           ▼
                       ┌────────┐  ┌────────┐  ┌────────┐
                       │  PASS  │  │  FAIL  │  │ FAIL   │
                       │        │  │ (test) │  │(quality│
                       │        │  │        │  │  only) │
                       └────┬───┘  └────┬───┘  └────┬───┘
                            │           │           │
                            ▼           ▼           ▼
                    ┌───────────┐  ┌─────────────────────────┐
                    │Auto-merge │  │   Check attempt count   │
                    │  (done!)  │  │   (count @claude        │
                    └───────────┘  │    comments on PR)      │
                                   └───────────┬─────────────┘
                                               │
                                   ┌───────────┼───────────┐
                                   │           │           │
                                   ▼           ▼           ▼
                              attempt     attempt     attempt
                                1-2          3          >3
                                 │           │           │
                                 ▼           ▼           ▼
                            ┌────────┐  ┌────────┐  ┌────────┐
                            │Post    │  │Add     │  │Already │
                            │@claude │  │manual- │  │marked  │
                            │comment │  │interv. │  │(skip)  │
                            │        │  │label   │  │        │
                            └────┬───┘  └────────┘  └────────┘
                                 │
                                 ▼
                    ┌─────────────────────────────┐
                    │    CLAUDE CODE WORKFLOW     │
                    │  (triggered on PR comment)  │
                    │                             │
                    │  1. Sync with main branch   │
                    │     (merge main → PR branch)│
                    │     If conflict → Claude    │
                    │     resolves it             │
                    │                             │
                    │  2. Parse comment to        │
                    │     determine agent:        │
                    │                             │
                    │  - Test fail → e2e-test-    │
                    │    fixer                    │
                    │                             │
                    │  - Quality fail → codebase- │
                    │    refactor-auditor         │
                    │                             │
                    │  - Conflict → resolve merge │
                    │    conflicts first          │
                    │                             │
                    │  3. Execute Claude Code     │
                    │  4. Push changes            │
                    └─────────────┬───────────────┘
                                  │
                                  │ Push triggers
                                  │ test workflow
                                  │ again
                                  ▼
                              ┌───────┐
                              │ LOOP  │
                              │ BACK  │
                              └───────┘
```

## Label-Based State Machine

```
┌─────────────────────────────────────────────────────────────────┐
│                        LABEL STATE MACHINE                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐                                           │
│  │  No TDD PR open  │ ◀─────────────────────────────────────┐   │
│  │  (idle state)    │                                       │   │
│  └────────┬─────────┘                                       │   │
│           │                                                 │   │
│           │ PR Creator creates PR                           │   │
│           │ with tdd-automation label                       │   │
│           ▼                                                 │   │
│  ┌──────────────────┐                                       │   │
│  │ tdd-automation   │ ◀──────────────┐                      │   │
│  │ (active)         │                │                      │   │
│  └────────┬─────────┘                │                      │   │
│           │                          │                      │   │
│           ├──────────────────────────┤                      │   │
│           │                          │                      │   │
│      Tests pass              Tests fail (≤2 attempts)       │   │
│           │                          │                      │   │
│           ▼                          │                      │   │
│  ┌──────────────────┐                │                      │   │
│  │ Auto-merged      │                │                      │   │
│  │ PR closed        │────────────────┼──────────────────────┘   │
│  └──────────────────┘                │                          │
│                                      │                          │
│                              Tests fail (3rd attempt)           │
│                                      │                          │
│                                      ▼                          │
│                          ┌──────────────────────┐               │
│                          │ tdd-automation       │               │
│                          │ + manual-intervention│               │
│                          │ (needs human)        │               │
│                          └──────────────────────┘               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Claude Code Credit Usage Protection

### Cost Limits

To prevent runaway costs, V3 includes **mandatory credit usage checks** before any Claude Code execution:

| Limit Type | Threshold | Action if Exceeded         |
| ---------- | --------- | -------------------------- |
| **Daily**  | $100/day  | Skip workflow, log warning |
| **Weekly** | $500/week | Skip workflow, log warning |

### Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       CREDIT USAGE CHECK FLOW                                │
│                                                                              │
│  ┌─────────────┐         ┌─────────────────────┐         ┌──────────────┐  │
│  │ PR Creator  │────────▶│ Check Credit Usage  │────────▶│ Within Limits│  │
│  │   starts    │         │ (before any work)   │         │    ✓ YES     │  │
│  └─────────────┘         └─────────────────────┘         └──────┬───────┘  │
│                                   │                              │          │
│                                   │ Over limit                   │          │
│                                   ▼                              ▼          │
│                          ┌──────────────┐               ┌──────────────┐   │
│                          │ Skip workflow│               │ Continue with│   │
│                          │ Log warning  │               │ normal flow  │   │
│                          │ Exit cleanly │               └──────────────┘   │
│                          └──────────────┘                                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Extracting Cost from Claude Code Logs

Each Claude Code workflow execution outputs cost information. The check script parses workflow logs:

```bash
# Script: scripts/tdd-automation/check-claude-usage.sh

# Get Claude Code workflow runs from the past 24 hours
gh run list --workflow="claude-code.yml" --json databaseId,createdAt,status \
  --jq '[.[] | select(.createdAt > (now - 86400 | strftime("%Y-%m-%dT%H:%M:%SZ")))]'

# For each completed run, extract cost from logs
# Claude Code outputs: "Total cost: $X.XX"
gh run view $RUN_ID --log | grep -oP 'Total cost: \$\K[0-9]+\.[0-9]+'

# Sum daily costs
DAILY_TOTAL=$(... | awk '{sum += $1} END {print sum}')

# Sum weekly costs (past 7 days)
WEEKLY_TOTAL=$(... | awk '{sum += $1} END {print sum}')
```

### Cost Calculation Script

```typescript
// scripts/tdd-automation/core/check-credit-usage.ts

interface UsageResult {
  dailySpend: number
  weeklySpend: number
  dailyRemaining: number
  weeklyRemaining: number
  canProceed: boolean
}

const DAILY_LIMIT = 100 // $100/day
const WEEKLY_LIMIT = 500 // $500/week

export function checkCreditUsage(): Effect.Effect<UsageResult, UsageCheckError> {
  return Effect.gen(function* () {
    // Parse workflow logs for cost data
    const dailySpend = yield* getDailySpend()
    const weeklySpend = yield* getWeeklySpend()

    return {
      dailySpend,
      weeklySpend,
      dailyRemaining: DAILY_LIMIT - dailySpend,
      weeklyRemaining: WEEKLY_LIMIT - weeklySpend,
      canProceed: dailySpend < DAILY_LIMIT && weeklySpend < WEEKLY_LIMIT,
    }
  })
}
```

### Workflow Integration

The credit check happens at **two points**:

1. **PR Creator Workflow** - Before creating any new TDD PR
2. **Claude Code Workflow** - Before executing Claude Code (double-check)

```yaml
# In pr-creator.yml
jobs:
  check-credits:
    runs-on: ubuntu-latest
    outputs:
      can-proceed: ${{ steps.check.outputs.can-proceed }}
    steps:
      - name: Check Claude Code credit usage
        id: check
        run: |
          # Calculate daily spend
          DAILY_SPEND=$(gh run list --workflow="claude-code.yml" \
            --created ">$(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%SZ)" \
            --json databaseId --jq 'length' | xargs -I {} echo "Checking {} runs" >&2)

          # ... cost extraction logic ...

          if [ "$DAILY_SPEND" -ge 100 ] || [ "$WEEKLY_SPEND" -ge 500 ]; then
            echo "⚠️ Credit limit reached - Daily: \$${DAILY_SPEND}, Weekly: \$${WEEKLY_SPEND}"
            echo "can-proceed=false" >> $GITHUB_OUTPUT
          else
            echo "✓ Credits OK - Daily: \$${DAILY_SPEND}/\$100, Weekly: \$${WEEKLY_SPEND}/\$500"
            echo "can-proceed=true" >> $GITHUB_OUTPUT
          fi

  create-pr:
    needs: check-credits
    if: needs.check-credits.outputs.can-proceed == 'true'
    # ... rest of PR creation logic
```

### Logging & Alerts

When limits are approached or exceeded:

| Spend Level           | Action                   |
| --------------------- | ------------------------ |
| 80% of daily ($80)    | Warning in workflow logs |
| 80% of weekly ($400)  | Warning in workflow logs |
| 100% of daily ($100)  | Skip workflow, log error |
| 100% of weekly ($500) | Skip workflow, log error |

**Optional**: Add Slack/Discord webhook notification when 80%+ reached.

---

## Main Branch Synchronization

### The Problem

While a TDD PR is being processed (which may take multiple fix attempts over hours), the `main` branch can advance due to:

- Other developers merging PRs
- Other TDD PRs completing
- Hotfixes

If the TDD PR gets too far behind, it can cause:

1. **Merge conflicts** when auto-merge tries to complete
2. **Stale code** - Claude fixing code that's already changed
3. **False positives** - Tests passing on old code but failing on current main

### The Solution: Sync Before Every Claude Code Execution

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      MAIN BRANCH SYNC STRATEGY                               │
│                                                                              │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌───────────┐ │
│  │Test Workflow│────▶│ PR behind?  │────▶│Post @claude │────▶│Claude Code│ │
│  │   fails     │     │   main?     │ YES │ sync comment│     │ syncs +   │ │
│  └─────────────┘     └──────┬──────┘     └─────────────┘     │ fixes     │ │
│                             │ NO                              └───────────┘ │
│                             ▼                                               │
│                      ┌─────────────┐                                        │
│                      │Post @claude │                                        │
│                      │ fix comment │                                        │
│                      └─────────────┘                                        │
│                                                                              │
│  ═══════════════════════════════════════════════════════════════════════   │
│                                                                              │
│  CLAUDE CODE WORKFLOW (always syncs first):                                  │
│                                                                              │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌───────────┐ │
│  │  Checkout   │────▶│ git fetch   │────▶│git merge    │────▶│ Conflicts?│ │
│  │  PR branch  │     │   main      │     │origin/main  │     └─────┬─────┘ │
│  └─────────────┘     └─────────────┘     └─────────────┘           │       │
│                                                                     │       │
│                                              ┌──────────────────────┤       │
│                                              │                      │       │
│                                           NO ▼                   YES▼       │
│                                      ┌─────────────┐        ┌───────────┐  │
│                                      │ Proceed to  │        │ Resolve   │  │
│                                      │ original    │        │ conflicts │  │
│                                      │ task        │        │ first     │  │
│                                      └─────────────┘        └─────┬─────┘  │
│                                                                   │        │
│                                                                   ▼        │
│                                                            ┌───────────┐   │
│                                                            │ Then do   │   │
│                                                            │ original  │   │
│                                                            │ task      │   │
│                                                            └───────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Sync Trigger Points

| Trigger Point            | When                           | Action                                                                             |
| ------------------------ | ------------------------------ | ---------------------------------------------------------------------------------- |
| **Test Workflow**        | Before running tests on TDD PR | Check `mergeStateStatus`, if `BEHIND` → post sync comment instead of running tests |
| **Claude Code Workflow** | Before every execution         | Always `git fetch && git merge origin/main`                                        |
| **PR Creator**           | When creating new PR           | Branch from latest `main` (always fresh start)                                     |

### Comment Format for Sync Requests

When Test Workflow detects the PR is behind:

```
@claude Sync required: The main branch has been updated since this PR was created.

Please:
1. Merge origin/main into this branch
2. Resolve any merge conflicts (look for <<<<<<< markers)
3. Run quality checks after merging
4. Commit and push the merge result

The original test fix task will continue after sync is complete.
```

### Conflict Resolution by Claude

When Claude Code detects conflicts during merge:

```
Conflict detected in files:
- src/domain/models/table.ts
- specs/api/tables/create.spec.ts

Claude Code prompt includes:
"Resolve ALL merge conflicts before proceeding.
For each conflict:
1. Understand what both sides intended
2. Choose the correct resolution (usually: keep both changes if they don't conflict, or prefer main's version for unrelated changes)
3. Remove all conflict markers (<<<<<<< ======= >>>>>>>)
4. Test the resolution works"
```

---

## Workflow Details

### 1. PR Creator Workflow (`pr-creator.yml`)

**Triggers:**

- `workflow_run`: After successful `test.yml` on `main` branch (chain reaction - minimizes latency)
- `schedule`: Every hour (`0 * * * *`) (backup)
- `workflow_dispatch`: Manual trigger

**Pre-conditions (all must be true):**

1. **Claude Code credit usage within limits** (daily < $100, weekly < $500)
2. No open PR exists with label `tdd-automation` that DOESN'T have `tdd-automation:manual-intervention`
3. At least one `.fixme()` spec exists in the codebase

**Full Implementation:**

```yaml
name: TDD PR Creator

on:
  schedule:
    - cron: '0 * * * *' # Hourly backup
  workflow_run:
    workflows: ['test']
    types: [completed]
    branches: [main]
  workflow_dispatch:

jobs:
  check-credits:
    runs-on: ubuntu-latest
    outputs:
      can-proceed: ${{ steps.check.outputs.can-proceed }}
      daily-spend: ${{ steps.check.outputs.daily-spend }}
      weekly-spend: ${{ steps.check.outputs.weekly-spend }}
    steps:
      - uses: actions/checkout@v4

      - name: Check Claude Code credit usage
        id: check
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          # Get runs from past 24 hours
          DAILY_RUNS=$(gh run list --workflow="claude-code.yml" \
            --created ">$(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%SZ)" \
            --json databaseId,conclusion --jq '[.[] | select(.conclusion == "success")]')

          DAILY_SPEND=0
          for RUN_ID in $(echo "$DAILY_RUNS" | jq -r '.[].databaseId'); do
            # Multi-pattern cost extraction with fallback
            COST=$(gh run view $RUN_ID --log 2>/dev/null | \
              grep -oP '(Total cost: \$|Cost: \$|Session cost: )(\K[0-9]+\.[0-9]+)' | head -1 || echo "")

            if [ -z "$COST" ]; then
              echo "::warning::Cost parsing failed for run $RUN_ID - using fallback \$15"
              COST=15
              echo "used-fallback=true" >> $GITHUB_OUTPUT
            fi
            DAILY_SPEND=$(echo "$DAILY_SPEND + $COST" | bc)
          done

          # Similar for weekly (past 7 days)
          WEEKLY_RUNS=$(gh run list --workflow="claude-code.yml" \
            --created ">$(date -u -d '7 days ago' +%Y-%m-%dT%H:%M:%SZ)" \
            --json databaseId,conclusion --jq '[.[] | select(.conclusion == "success")]')

          WEEKLY_SPEND=0
          for RUN_ID in $(echo "$WEEKLY_RUNS" | jq -r '.[].databaseId'); do
            COST=$(gh run view $RUN_ID --log 2>/dev/null | \
              grep -oP '(Total cost: \$|Cost: \$|Session cost: )(\K[0-9]+\.[0-9]+)' | head -1 || echo "15")
            WEEKLY_SPEND=$(echo "$WEEKLY_SPEND + $COST" | bc)
          done

          echo "daily-spend=$DAILY_SPEND" >> $GITHUB_OUTPUT
          echo "weekly-spend=$WEEKLY_SPEND" >> $GITHUB_OUTPUT

          # Check limits with warnings at 80%
          if [ $(echo "$DAILY_SPEND >= 80" | bc) -eq 1 ]; then
            echo "::warning::Daily spend at \$${DAILY_SPEND}/\$100 (80%+)"
          fi
          if [ $(echo "$WEEKLY_SPEND >= 400" | bc) -eq 1 ]; then
            echo "::warning::Weekly spend at \$${WEEKLY_SPEND}/\$500 (80%+)"
          fi

          if [ $(echo "$DAILY_SPEND >= 100" | bc) -eq 1 ] || [ $(echo "$WEEKLY_SPEND >= 500" | bc) -eq 1 ]; then
            echo "⚠️ Credit limit reached - Daily: \$${DAILY_SPEND}, Weekly: \$${WEEKLY_SPEND}"
            echo "can-proceed=false" >> $GITHUB_OUTPUT
          else
            echo "✓ Credits OK - Daily: \$${DAILY_SPEND}/\$100, Weekly: \$${WEEKLY_SPEND}/\$500"
            echo "can-proceed=true" >> $GITHUB_OUTPUT
          fi

      - name: Alert if cost parsing failed
        if: steps.check.outputs.used-fallback == 'true'
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          gh issue create --title "⚠️ TDD Cost Parsing Failed" \
            --body "Cost parsing failed for run ${{ github.run_id }}. Using fallback \$15. Please verify Claude Code output format." \
            --label "tdd-automation,bug" || true

  check-active-pr:
    needs: check-credits
    if: needs.check-credits.outputs.can-proceed == 'true'
    runs-on: ubuntu-latest
    outputs:
      has-active: ${{ steps.check.outputs.has-active }}
    steps:
      - name: Check for active TDD PR (with API backoff)
        id: check
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          # API call with exponential backoff for rate limits
          for i in 1 2 3 4 5; do
            RESULT=$(gh pr list --label "tdd-automation" --state open --json number,labels 2>/dev/null) && break
            echo "Rate limited, waiting $((i * 30)) seconds..."
            sleep $((i * 30))
          done

          # Check if any PR exists without manual-intervention label
          ACTIVE=$(echo "$RESULT" | jq '[.[] | select(.labels | map(.name) | contains(["tdd-automation:manual-intervention"]) | not)] | length')

          if [ "$ACTIVE" -gt 0 ]; then
            echo "Active TDD PR exists - exiting"
            echo "has-active=true" >> $GITHUB_OUTPUT
          else
            echo "No active TDD PR - can proceed"
            echo "has-active=false" >> $GITHUB_OUTPUT
          fi

  create-pr:
    needs: [check-credits, check-active-pr]
    if: needs.check-active-pr.outputs.has-active == 'false'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          token: ${{ secrets.GITHUB_TOKEN }}
          fetch-depth: 0

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Find excluded specs (in manual-intervention PRs)
        id: excluded
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          EXCLUDED=$(gh pr list --label "tdd-automation:manual-intervention" --state open --json headRefName \
            --jq '.[].headRefName' | sed 's|tdd/||' | tr '\n' ',' | sed 's/,$//')
          echo "specs=$EXCLUDED" >> $GITHUB_OUTPUT

      - name: Find next spec using priority calculator
        id: next-spec
        run: |
          RESULT=$(bun run scripts/tdd-automation/core/schema-priority-calculator.ts \
            --exclude "${{ steps.excluded.outputs.specs }}")

          SPEC_ID=$(echo "$RESULT" | jq -r '.specId')
          SPEC_FILE=$(echo "$RESULT" | jq -r '.file')
          PRIORITY=$(echo "$RESULT" | jq -r '.priority')

          if [ -z "$SPEC_ID" ] || [ "$SPEC_ID" = "null" ]; then
            echo "No pending specs found"
            echo "found=false" >> $GITHUB_OUTPUT
          else
            echo "Found spec: $SPEC_ID (priority: $PRIORITY)"
            echo "found=true" >> $GITHUB_OUTPUT
            echo "spec-id=$SPEC_ID" >> $GITHUB_OUTPUT
            echo "spec-file=$SPEC_FILE" >> $GITHUB_OUTPUT
            echo "priority=$PRIORITY" >> $GITHUB_OUTPUT
          fi

      - name: Extract per-spec configuration
        if: steps.next-spec.outputs.found == 'true'
        id: spec-config
        run: |
          SPEC_FILE="${{ steps.next-spec.outputs.spec-file }}"
          MAX_ATTEMPTS=$(grep -oP '@tdd-max-attempts \K[0-9]+' "$SPEC_FILE" || echo "5")
          TIMEOUT=$(grep -oP '@tdd-timeout \K[0-9]+' "$SPEC_FILE" || echo "45")
          echo "max-attempts=$MAX_ATTEMPTS" >> $GITHUB_OUTPUT
          echo "timeout=$TIMEOUT" >> $GITHUB_OUTPUT

      - name: Create branch and remove .fixme()
        if: steps.next-spec.outputs.found == 'true'
        run: |
          SPEC_ID="${{ steps.next-spec.outputs.spec-id }}"
          SPEC_FILE="${{ steps.next-spec.outputs.spec-file }}"
          BRANCH="tdd/$SPEC_ID"

          git checkout -b "$BRANCH"

          # Remove .fixme() from the test
          sed -i 's/\.fixme(/(/g' "$SPEC_FILE"

          git add "$SPEC_FILE"
          git commit -m "test(tdd): activate $SPEC_ID spec"
          git push origin "$BRANCH"

      - name: Create PR with attempt tracking in title
        if: steps.next-spec.outputs.found == 'true'
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          SPEC_ID="${{ steps.next-spec.outputs.spec-id }}"
          SPEC_FILE="${{ steps.next-spec.outputs.spec-file }}"
          PRIORITY="${{ steps.next-spec.outputs.priority }}"
          MAX_ATTEMPTS="${{ steps.spec-config.outputs.max-attempts }}"
          BRANCH="tdd/$SPEC_ID"

          # PR title includes attempt tracking (immutable counter)
          TITLE="[TDD] Implement $SPEC_ID | Attempt 1/$MAX_ATTEMPTS"

          BODY="## TDD Automation PR

**Spec ID:** \`$SPEC_ID\`
**File:** \`$SPEC_FILE\`
**Priority:** $PRIORITY
**Max Attempts:** $MAX_ATTEMPTS

This PR was automatically created by the TDD automation pipeline.
Tests will run automatically. If they fail, Claude Code will attempt to fix them.

---
*Do not manually edit the attempt count in the title.*"

          gh pr create \
            --title "$TITLE" \
            --body "$BODY" \
            --label "tdd-automation" \
            --base main \
            --head "$BRANCH"

          # Enable auto-merge
          PR_NUMBER=$(gh pr list --head "$BRANCH" --json number --jq '.[0].number')
          gh pr merge "$PR_NUMBER" --squash --auto
```

**Key Mitigations Integrated:**

- ✅ **Cost parsing** with multi-pattern fallback + alert on failure
- ✅ **API rate limiting** with exponential backoff
- ✅ **Per-spec configuration** extraction (`@tdd-max-attempts`, `@tdd-timeout`)
- ✅ **PR title-based attempt tracking** (immutable)
- ✅ **Chain reaction trigger** via `workflow_run` for minimal latency

### 2. Test Workflow (`test.yml`)

**Triggers:**

- `push`: Any branch
- `pull_request`: Any PR

**Key Additions for TDD:**

```yaml
name: Test

on:
  push:
    branches: ['**']
  pull_request:
    branches: ['**']

jobs:
  detect-changes:
    runs-on: ubuntu-latest
    outputs:
      is-tdd-pr: ${{ steps.check.outputs.is-tdd }}
      pr-number: ${{ steps.check.outputs.pr-number }}
      changes-type: ${{ steps.changes.outputs.type }}
      spec-file: ${{ steps.changes.outputs.spec-file }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Identify TDD PR (label OR branch name)
        id: check
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          if [ "${{ github.event_name }}" = "pull_request" ]; then
            PR_NUMBER="${{ github.event.pull_request.number }}"
            BRANCH="${{ github.head_ref }}"
          else
            PR_NUMBER=$(gh pr list --head "${{ github.ref_name }}" --json number --jq '.[0].number // empty')
            BRANCH="${{ github.ref_name }}"
          fi

          echo "pr-number=$PR_NUMBER" >> $GITHUB_OUTPUT

          if [ -n "$PR_NUMBER" ]; then
            # Check BOTH label AND branch name (branch is backup)
            IS_TDD_BY_LABEL=$(gh pr view $PR_NUMBER --json labels -q '.labels[].name' | grep -c "tdd-automation" || echo "0")
            IS_TDD_BY_BRANCH=$(echo "$BRANCH" | grep -c "^tdd/" || echo "0")

            if [ "$IS_TDD_BY_LABEL" -gt 0 ] || [ "$IS_TDD_BY_BRANCH" -gt 0 ]; then
              echo "is-tdd=true" >> $GITHUB_OUTPUT

              # Restore label if missing (accident recovery)
              if [ "$IS_TDD_BY_LABEL" -eq 0 ] && [ "$IS_TDD_BY_BRANCH" -gt 0 ]; then
                gh pr edit $PR_NUMBER --add-label "tdd-automation"
                echo "::notice::Restored missing tdd-automation label"
              fi
            else
              echo "is-tdd=false" >> $GITHUB_OUTPUT
            fi
          else
            echo "is-tdd=false" >> $GITHUB_OUTPUT
          fi

      - name: Check if PR is behind main (TDD only)
        if: steps.check.outputs.is-tdd == 'true'
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          PR_NUMBER="${{ steps.check.outputs.pr-number }}"
          MERGE_STATE=$(gh pr view $PR_NUMBER --json mergeStateStatus -q '.mergeStateStatus')

          if [ "$MERGE_STATE" = "BEHIND" ]; then
            echo "PR is behind main - posting sync request"
            gh pr comment $PR_NUMBER --body "@claude Sync required: main branch has been updated.

Please:
1. Run: git fetch origin main && git merge origin/main
2. Resolve any merge conflicts (look for <<<<<<< markers)
3. Run quality checks after merging
4. Commit and push the merge result"
            echo "needs-sync=true" >> $GITHUB_OUTPUT
            exit 0  # Exit early, don't run tests
          fi

      - name: Detect change type
        id: changes
        run: |
          # Get changed files
          if [ "${{ github.event_name }}" = "pull_request" ]; then
            CHANGED=$(git diff --name-only origin/main...HEAD)
          else
            CHANGED=$(git diff --name-only HEAD~1 HEAD)
          fi

          # Analyze changes
          SPEC_ONLY_FIXME=$(echo "$CHANGED" | grep -c "specs/.*\.spec\.ts$" || echo "0")
          SRC_CHANGED=$(echo "$CHANGED" | grep -c "^src/" || echo "0")
          SPEC_FILE=$(echo "$CHANGED" | grep "specs/.*\.spec\.ts$" | head -1)

          echo "spec-file=$SPEC_FILE" >> $GITHUB_OUTPUT

          if [ "$SPEC_ONLY_FIXME" -gt 0 ] && [ "$SRC_CHANGED" -eq 0 ]; then
            # Check if only .fixme() was removed
            DIFF=$(git diff origin/main...HEAD -- "$SPEC_FILE" | grep -E "^[-+]" | grep -v "^---" | grep -v "^+++" || echo "")
            ONLY_FIXME=$(echo "$DIFF" | grep -cE "^[-+].*\.fixme\(" || echo "0")
            TOTAL_LINES=$(echo "$DIFF" | wc -l)

            if [ "$ONLY_FIXME" = "$TOTAL_LINES" ] && [ "$TOTAL_LINES" -gt 0 ]; then
              echo "type=fixme-only" >> $GITHUB_OUTPUT
            else
              echo "type=test-changed" >> $GITHUB_OUTPUT
            fi
          elif [ "$SRC_CHANGED" -gt 0 ]; then
            echo "type=src-changed" >> $GITHUB_OUTPUT
          else
            echo "type=other" >> $GITHUB_OUTPUT
          fi

  test:
    needs: detect-changes
    runs-on: ubuntu-latest
    # ... existing test steps based on changes-type ...

  handle-tdd-failure:
    needs: [detect-changes, test]
    if: failure() && needs.detect-changes.outputs.is-tdd-pr == 'true'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Get current attempt from PR title (immutable)
        id: attempt
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          PR_NUMBER="${{ needs.detect-changes.outputs.pr-number }}"
          TITLE=$(gh pr view $PR_NUMBER --json title -q '.title')

          # Extract attempt from title: "[TDD] Implement X | Attempt Y/Z"
          CURRENT=$(echo "$TITLE" | grep -oP 'Attempt \K[0-9]+' || echo "1")
          MAX=$(echo "$TITLE" | grep -oP 'Attempt [0-9]+/\K[0-9]+' || echo "5")

          echo "current=$CURRENT" >> $GITHUB_OUTPUT
          echo "max=$MAX" >> $GITHUB_OUTPUT
          echo "title=$TITLE" >> $GITHUB_OUTPUT

      - name: Classify failure type
        id: classify
        run: |
          # Get failure reason from test step
          ERROR="${{ needs.test.outputs.error-message || '' }}"

          # Infrastructure failures (don't count against attempts)
          if [[ "$ERROR" == *"rate limit"* ]] || \
             [[ "$ERROR" == *"timeout"* ]] || \
             [[ "$ERROR" == *"network"* ]] || \
             [[ "$ERROR" == *"503"* ]] || \
             [[ "$ERROR" == *"502"* ]] || \
             [[ "$ERROR" == *"ECONNREFUSED"* ]]; then
            echo "type=infrastructure" >> $GITHUB_OUTPUT
          else
            echo "type=code" >> $GITHUB_OUTPUT
          fi

      - name: Handle infrastructure failure (don't count, retry)
        if: steps.classify.outputs.type == 'infrastructure'
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          PR_NUMBER="${{ needs.detect-changes.outputs.pr-number }}"
          gh pr comment $PR_NUMBER --body "🔄 Infrastructure issue detected (not counting as attempt). Auto-retrying in 5 minutes..."
          sleep 300
          # Re-run tests by re-triggering workflow
          gh workflow run test.yml -f ref=${{ github.ref }}

      - name: Increment attempt in PR title (code failures only)
        if: steps.classify.outputs.type == 'code'
        id: increment
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          PR_NUMBER="${{ needs.detect-changes.outputs.pr-number }}"
          CURRENT="${{ steps.attempt.outputs.current }}"
          MAX="${{ steps.attempt.outputs.max }}"
          TITLE="${{ steps.attempt.outputs.title }}"

          NEW_ATTEMPT=$((CURRENT + 1))
          NEW_TITLE=$(echo "$TITLE" | sed "s/Attempt [0-9]\+/Attempt $NEW_ATTEMPT/")

          gh pr edit $PR_NUMBER --title "$NEW_TITLE"
          echo "new-attempt=$NEW_ATTEMPT" >> $GITHUB_OUTPUT

      - name: Check if max attempts reached
        if: steps.classify.outputs.type == 'code' && steps.increment.outputs.new-attempt > steps.attempt.outputs.max
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          PR_NUMBER="${{ needs.detect-changes.outputs.pr-number }}"
          gh pr edit $PR_NUMBER --add-label "tdd-automation:manual-intervention"
          gh pr comment $PR_NUMBER --body "⚠️ **Max attempts (${{ steps.attempt.outputs.max }}) reached.**

This spec requires manual intervention. Please:
1. Review the failing tests and Claude's previous attempts
2. Either fix the issue manually, or
3. Remove the \`tdd-automation:manual-intervention\` label to retry

The TDD automation will continue with other specs."

      - name: Post @claude comment (if under max attempts)
        if: steps.classify.outputs.type == 'code' && steps.increment.outputs.new-attempt <= steps.attempt.outputs.max
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          PR_NUMBER="${{ needs.detect-changes.outputs.pr-number }}"
          SPEC_FILE="${{ needs.detect-changes.outputs.spec-file }}"
          FAILURE_TYPE="${{ needs.test.outputs.failure-type || 'test' }}"

          case "$FAILURE_TYPE" in
            "quality")
              COMMENT="@claude Use the codebase-refactor-auditor agent to fix the quality errors.

The tests passed but quality checks failed. Focus on:
- ESLint errors
- TypeScript type errors
- Code style issues

After fixing, run \`bun run quality\` to verify."
              ;;
            "regression")
              COMMENT="@claude Use the codebase-refactor-auditor agent to fix the regression test failures.

Some previously passing tests are now failing. This likely means:
- A code change broke existing functionality
- A test expectation needs updating

Fix the regressions while keeping the new spec working."
              ;;
            *)
              COMMENT="@claude Use the e2e-test-fixer agent to fix the failing test in \`$SPEC_FILE\`.

The spec test is failing. Please:
1. Analyze the test failure output
2. Implement or fix the code to make the test pass
3. Run the specific test to verify: \`bun test:e2e $SPEC_FILE\`
4. Ensure quality checks pass: \`bun run quality\`"
              ;;
          esac

          gh pr comment $PR_NUMBER --body "$COMMENT"

  update-spec-progress:
    needs: test
    if: github.ref == 'refs/heads/main' && needs.test.result == 'success'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          ref: main
          token: ${{ secrets.GITHUB_TOKEN }}

      - uses: oven-sh/setup-bun@v2

      - run: bun install --frozen-lockfile

      - name: Run analyze:specs
        run: bun run analyze:specs

      - name: Check for changes
        id: changes
        run: |
          if git diff --quiet SPEC-PROGRESS.md; then
            echo "has-changes=false" >> $GITHUB_OUTPUT
          else
            echo "has-changes=true" >> $GITHUB_OUTPUT
          fi

      - name: Commit spec progress update
        if: steps.changes.outputs.has-changes == 'true'
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add SPEC-PROGRESS.md
          git commit -m "docs: update SPEC-PROGRESS.md [skip ci]"
          git push origin main
```

**Key Mitigations Integrated:**

- ✅ **PR title-based attempt tracking** (immutable, not comment-based)
- ✅ **Branch name as backup identifier** (label accident recovery)
- ✅ **Failure classification** (infrastructure vs code - only code counts)
- ✅ **Infrastructure failure retry** (automatic, doesn't count)
- ✅ **Per-spec max attempts** (from PR title)
- ✅ **Spec progress auto-update** with `[skip ci]`

### 3. Claude Code Workflow (`claude-code.yml`)

**Triggers:**

- `issue_comment`: Comment starts with `@claude` on PR

**Pre-conditions:**

1. **Claude Code credit usage within limits** (daily < $100, weekly < $500)
2. Comment is on a PR (not an issue)
3. PR has `tdd-automation` label (or branch starts with `tdd/`)
4. Commenter is `github-actions[bot]` (security: only workflow-generated comments)

**Full Implementation:**

```yaml
name: Claude Code

on:
  issue_comment:
    types: [created]

jobs:
  validate:
    if: |
      github.event.issue.pull_request &&
      startsWith(github.event.comment.body, '@claude') &&
      github.event.comment.user.login == 'github-actions[bot]'
    runs-on: ubuntu-latest
    outputs:
      can-proceed: ${{ steps.check.outputs.can-proceed }}
      pr-number: ${{ github.event.issue.number }}
      pr-branch: ${{ steps.pr-info.outputs.branch }}
    steps:
      - name: Get PR info
        id: pr-info
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          PR_DATA=$(gh pr view ${{ github.event.issue.number }} --json headRefName,labels)
          BRANCH=$(echo "$PR_DATA" | jq -r '.headRefName')
          HAS_LABEL=$(echo "$PR_DATA" | jq -r '.labels[].name' | grep -c "tdd-automation" || echo "0")
          IS_TDD_BRANCH=$(echo "$BRANCH" | grep -c "^tdd/" || echo "0")

          echo "branch=$BRANCH" >> $GITHUB_OUTPUT

          if [ "$HAS_LABEL" -gt 0 ] || [ "$IS_TDD_BRANCH" -gt 0 ]; then
            echo "is-tdd=true" >> $GITHUB_OUTPUT
          else
            echo "is-tdd=false" >> $GITHUB_OUTPUT
            echo "Not a TDD PR - skipping"
            exit 0
          fi

      - name: Check credit usage (double-check)
        id: check
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          # Same cost checking logic as PR Creator
          DAILY_SPEND=$(gh run list --workflow="claude-code.yml" \
            --created ">$(date -u -d '24 hours ago' +%Y-%m-%dT%H:%M:%SZ)" \
            --json databaseId,conclusion --jq '[.[] | select(.conclusion == "success")] | length' || echo "0")

          # Estimate cost (use actual parsing in production)
          ESTIMATED_DAILY=$(echo "$DAILY_SPEND * 10" | bc)  # ~$10 per run estimate

          if [ "$ESTIMATED_DAILY" -ge 100 ]; then
            echo "can-proceed=false" >> $GITHUB_OUTPUT
            gh pr comment ${{ github.event.issue.number }} --body "⏸️ Daily credit limit reached. TDD automation paused until tomorrow."
          else
            echo "can-proceed=true" >> $GITHUB_OUTPUT
          fi

  execute:
    needs: validate
    if: needs.validate.outputs.can-proceed == 'true'
    runs-on: ubuntu-latest
    timeout-minutes: 45  # Hard timeout
    steps:
      - name: Checkout PR branch
        uses: actions/checkout@v4
        with:
          ref: ${{ needs.validate.outputs.pr-branch }}
          token: ${{ secrets.GITHUB_TOKEN }}
          fetch-depth: 0

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Parse @claude comment
        id: parse
        run: |
          COMMENT="${{ github.event.comment.body }}"

          # Extract agent type
          if echo "$COMMENT" | grep -q "e2e-test-fixer"; then
            echo "agent=e2e-test-fixer" >> $GITHUB_OUTPUT
          elif echo "$COMMENT" | grep -q "codebase-refactor-auditor"; then
            echo "agent=codebase-refactor-auditor" >> $GITHUB_OUTPUT
          elif echo "$COMMENT" | grep -q "Sync required"; then
            echo "agent=sync" >> $GITHUB_OUTPUT
          else
            echo "agent=e2e-test-fixer" >> $GITHUB_OUTPUT  # Default
          fi

          # Extract spec file if mentioned
          SPEC_FILE=$(echo "$COMMENT" | grep -oP '`specs/[^`]+`' | tr -d '`' | head -1 || echo "")
          echo "spec-file=$SPEC_FILE" >> $GITHUB_OUTPUT

      - name: Sync with main branch
        id: sync
        run: |
          git fetch origin main

          BEHIND=$(git rev-list --count HEAD..origin/main)
          echo "behind=$BEHIND" >> $GITHUB_OUTPUT

          if [ "$BEHIND" -gt 0 ]; then
            echo "Main branch has $BEHIND new commits, merging..."

            if ! git merge origin/main --no-edit 2>/dev/null; then
              echo "has-conflict=true" >> $GITHUB_OUTPUT
              git diff --name-only --diff-filter=U > /tmp/conflicted_files.txt
              git merge --abort
            else
              echo "has-conflict=false" >> $GITHUB_OUTPUT
              git push origin HEAD
            fi
          else
            echo "has-conflict=false" >> $GITHUB_OUTPUT
          fi

      - name: Add conflict label if needed
        if: steps.sync.outputs.has-conflict == 'true'
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          gh pr edit ${{ needs.validate.outputs.pr-number }} --add-label "tdd-automation:had-conflict"

      - name: Start heartbeat
        id: heartbeat
        run: |
          PR_NUMBER="${{ needs.validate.outputs.pr-number }}"
          (
            while true; do
              sleep 600  # Every 10 minutes
              gh pr comment $PR_NUMBER --body "🤖 Claude Code still working... (heartbeat)" 2>/dev/null || true
            done
          ) &
          echo $! > /tmp/heartbeat.pid
          echo "pid=$(cat /tmp/heartbeat.pid)" >> $GITHUB_OUTPUT
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

      - name: Build Claude Code prompt
        id: prompt
        run: |
          AGENT="${{ steps.parse.outputs.agent }}"
          SPEC_FILE="${{ steps.parse.outputs.spec-file }}"
          HAS_CONFLICT="${{ steps.sync.outputs.has-conflict }}"
          ORIGINAL_COMMENT="${{ github.event.comment.body }}"

          if [ "$HAS_CONFLICT" = "true" ]; then
            CONFLICT_FILES=$(cat /tmp/conflicted_files.txt | tr '\n' ', ')
            PROMPT="⚠️ MERGE CONFLICT DETECTED

Conflicted files: $CONFLICT_FILES

IMPORTANT: This PR has conflicts with main. You must:
1. Run: git fetch origin main && git merge origin/main
2. Carefully resolve each conflict:
   - For DOMAIN MODEL conflicts: prefer main (newer schema)
   - For TEST FILE conflicts: merge both test cases
   - For CONFIG conflicts: prefer main
3. After resolving, run full quality + regression tests
4. If unsure about ANY conflict, add comment: '// TODO: human review needed'
5. Commit the resolved merge

Then proceed with the original task:
$ORIGINAL_COMMENT"
          elif [ "$AGENT" = "e2e-test-fixer" ]; then
            PROMPT="Fix the failing E2E test using the e2e-test-fixer agent.

Target file: $SPEC_FILE

Please:
1. Read the test file to understand what it expects
2. Implement or fix the code to make the test pass
3. Run the specific test: bun test:e2e $SPEC_FILE
4. Run quality checks: bun run quality
5. If all pass, commit and push changes

Focus on minimal changes to make the test green."
          elif [ "$AGENT" = "codebase-refactor-auditor" ]; then
            PROMPT="Fix the quality/regression issues using the codebase-refactor-auditor agent.

Please:
1. Run bun run quality to see the current errors
2. Fix ESLint, TypeScript, and other quality issues
3. If regression tests fail, fix them while maintaining the new spec
4. Commit and push changes"
          else
            PROMPT="$ORIGINAL_COMMENT"
          fi

          # Save prompt to file (handles multiline)
          echo "$PROMPT" > /tmp/claude_prompt.txt

      - name: Execute Claude Code
        id: claude
        continue-on-error: true
        run: |
          PROMPT=$(cat /tmp/claude_prompt.txt)

          # Execute with timeout (40 min to allow buffer before job timeout)
          if timeout 40m claude --print "$PROMPT"; then
            echo "status=success" >> $GITHUB_OUTPUT
          else
            EXIT_CODE=$?
            if [ "$EXIT_CODE" = "124" ]; then
              echo "status=timeout" >> $GITHUB_OUTPUT
            else
              echo "status=failed" >> $GITHUB_OUTPUT
            fi
          fi

      - name: Stop heartbeat
        if: always()
        run: |
          kill $(cat /tmp/heartbeat.pid) 2>/dev/null || true

      - name: Handle timeout
        if: steps.claude.outputs.status == 'timeout'
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          PR_NUMBER="${{ needs.validate.outputs.pr-number }}"

          # Timeout is infrastructure failure - don't count as attempt
          gh pr comment $PR_NUMBER --body "⏱️ Claude Code timed out (infrastructure issue - not counting as attempt).

This happens when:
- The task is very complex
- There's a network issue
- Claude is taking longer than expected

Retrying automatically..."

          # Re-trigger by posting new @claude comment with same content
          ORIGINAL="${{ github.event.comment.body }}"
          gh pr comment $PR_NUMBER --body "$ORIGINAL"

      - name: Push changes if any
        if: steps.claude.outputs.status == 'success'
        run: |
          if [ -n "$(git status --porcelain)" ]; then
            git add -A
            git commit -m "fix(tdd): Claude Code fixes for ${{ needs.validate.outputs.pr-branch }}"
            git push origin HEAD
          else
            echo "No changes to push"
          fi

      - name: Disable auto-merge if had conflict
        if: steps.sync.outputs.has-conflict == 'true'
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          PR_NUMBER="${{ needs.validate.outputs.pr-number }}"

          # Conflicts require human review
          gh pr merge $PR_NUMBER --disable-auto
          gh pr comment $PR_NUMBER --body "⚠️ This PR had merge conflicts that were auto-resolved.

**Human review required before merge.**

Please verify:
- [ ] Conflict resolution is correct
- [ ] Tests pass
- [ ] Code logic makes sense

After review, re-enable auto-merge or merge manually."
```

**Key Mitigations Integrated:**

- ✅ **Timeout (45 min)** with 40 min inner timeout for Claude
- ✅ **Heartbeat comments** every 10 minutes
- ✅ **Timeout recovery** - auto-retry without counting as attempt
- ✅ **Conflict detection and flagging** with `tdd-automation:had-conflict` label
- ✅ **Human review gate** for PRs with conflicts (disables auto-merge)
- ✅ **Double credit check** before execution
- ✅ **Merge strategy** (not rebase) for safer conflict handling

### 4. Merge Watchdog Workflow (`merge-watchdog.yml`)

**Purpose:** Detect and unstick PRs that should have auto-merged but didn't.

**Triggers:**

- `schedule`: Every 30 minutes (`*/30 * * * *`)

**Full Implementation:**

```yaml
name: TDD Merge Watchdog

on:
  schedule:
    - cron: '*/30 * * * *'  # Every 30 minutes
  workflow_dispatch:

jobs:
  check-stuck-prs:
    runs-on: ubuntu-latest
    steps:
      - name: Find stuck TDD PRs
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          # Find PRs that are:
          # - Labeled tdd-automation (not manual-intervention)
          # - All checks passed
          # - Mergeable
          # - Not merged in >2 hours

          STUCK_PRS=$(gh pr list \
            --label "tdd-automation" \
            --json number,title,updatedAt,mergeStateStatus,statusCheckRollup,labels \
            --jq '[.[] |
              select(.labels | map(.name) | contains(["tdd-automation:manual-intervention"]) | not) |
              select(.mergeStateStatus == "CLEAN" or .mergeStateStatus == "HAS_HOOKS") |
              select(.statusCheckRollup | all(.conclusion == "SUCCESS" or .conclusion == "SKIPPED")) |
              select((now - (.updatedAt | fromdateiso8601)) > 7200)
            ] | .[].number')

          if [ -n "$STUCK_PRS" ]; then
            echo "Found stuck PRs: $STUCK_PRS"

            for PR in $STUCK_PRS; do
              echo "Attempting to unstick PR #$PR"

              # Try to re-enable auto-merge
              gh pr merge $PR --squash --auto || true

              # If that fails, try direct merge
              if ! gh pr view $PR --json autoMergeRequest -q '.autoMergeRequest' | grep -q "SQUASH"; then
                echo "Auto-merge not enabled, trying direct merge"
                gh pr merge $PR --squash || true
              fi
            done
          else
            echo "No stuck PRs found"
          fi

      - name: Alert on persistent stuck PRs (>6 hours)
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          VERY_STUCK=$(gh pr list \
            --label "tdd-automation" \
            --json number,updatedAt,labels \
            --jq '[.[] |
              select(.labels | map(.name) | contains(["tdd-automation:manual-intervention"]) | not) |
              select((now - (.updatedAt | fromdateiso8601)) > 21600)
            ] | .[].number' | tr '\n' ' ')

          if [ -n "$VERY_STUCK" ]; then
            # Check if alert issue already exists
            EXISTING=$(gh issue list --label "tdd-automation,urgent" --state open --json number --jq '.[0].number // empty')

            if [ -z "$EXISTING" ]; then
              gh issue create \
                --title "🚨 TDD PR stuck for >6 hours" \
                --body "The following TDD PRs have been stuck for more than 6 hours:

PRs: $VERY_STUCK

**Possible causes:**
- Branch protection rules blocking merge
- Required status checks not completing
- Auto-merge disabled somehow

**Action required:**
1. Check branch protection settings
2. Verify required checks are passing
3. Manually merge if safe

This is an automated alert from the TDD Merge Watchdog." \
                --label "tdd-automation,urgent"
            else
              echo "Alert issue already exists: #$EXISTING"
            fi
          fi
```

**Key Mitigations:**

- ✅ **Auto-merge recovery** - Re-enables or forces merge for stuck PRs
- ✅ **Alert system** - Creates GitHub issue for PRs stuck >6 hours
- ✅ **Duplicate prevention** - Doesn't create multiple alert issues

---

## Fast-Path Optimization

When a spec's `.fixme()` is removed and the test **passes immediately** (feature already implemented):

```
PR Creator removes .fixme()
        │
        ▼
   Test Workflow
        │
        ├─── Tests PASS ───▶ Auto-merge (no Claude needed!)
        │
        └─── Tests FAIL ───▶ Continue with @claude fix loop
```

This handles cases where:

- The feature was already implemented but test wasn't activated
- Simple tests that pass without any code changes
- Tests that were .fixme'd prematurely

## Edge Cases

### 1. PR Creator Runs While Claude Code is Working

**Protection**: PR Creator checks for open PRs with `tdd-automation` label (without `manual-intervention`). While Claude Code is working, that PR is still open → PR Creator exits.

### 2. Multiple .fixme() in Same File

**Behavior**: Priority calculator returns the spec ID, not the file. Each test with `.fixme()` is treated as a separate spec. PR Creator selects ONE spec at a time.

### 3. Claude Code Takes Too Long / Fails

**Protection**:

- Workflow timeout (e.g., 30 minutes)
- On timeout, workflow fails → Test workflow sees failure → Posts @claude comment → Counts as attempt

### 4. Manual Intervention PR Needs Retry

**Resolution**: Human removes `tdd-automation:manual-intervention` label. Next Test workflow run or manual re-run will process it normally.

### 5. Spec Priority Changes Mid-Processing

**Behavior**: Not an issue. Once a PR is created for a spec, it continues until merged or marked manual-intervention. Priority only matters when selecting the NEXT spec.

### 6. Credit Limit Exceeded Mid-Processing

**Protection**: If daily/weekly limit is reached while a PR is being processed:

- PR Creator won't start new PRs (pre-check fails)
- Claude Code workflow also has pre-check, so new fixes won't run
- The active PR remains open and resumes automatically when limits reset (next day/week)
- No manual intervention needed, just wait for budget refresh

### 7. Main Branch Updated During Processing (Merge Conflicts)

**Scenario**: While Claude Code is working on a TDD PR, someone merges another PR to main that modifies the same files.

**Protection Flow**:

```
┌─────────────────────────────────────────────────────────────────┐
│                    MAIN BRANCH SYNC FLOW                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Claude Code Workflow starts                                     │
│         │                                                        │
│         ▼                                                        │
│  ┌──────────────────┐                                           │
│  │ git fetch main   │                                           │
│  │ Check if behind  │                                           │
│  └────────┬─────────┘                                           │
│           │                                                      │
│     ┌─────┴─────┐                                               │
│     │           │                                                │
│  Up-to-date   Behind                                             │
│     │           │                                                │
│     │           ▼                                                │
│     │    ┌──────────────────┐                                   │
│     │    │ git merge main   │                                   │
│     │    └────────┬─────────┘                                   │
│     │             │                                              │
│     │       ┌─────┴─────┐                                       │
│     │       │           │                                        │
│     │    Success     Conflict                                    │
│     │       │           │                                        │
│     │       │           ▼                                        │
│     │       │    ┌──────────────────┐                           │
│     │       │    │ Claude resolves  │                           │
│     │       │    │ conflicts first, │                           │
│     │       │    │ then fixes test  │                           │
│     │       │    └────────┬─────────┘                           │
│     │       │             │                                      │
│     └───────┴─────────────┘                                      │
│             │                                                    │
│             ▼                                                    │
│    Continue with test fix                                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Key Behaviors**:

1. **Always sync before working**: Claude Code fetches main before every execution
2. **Clean merge**: If no conflicts, merge completes silently and Claude proceeds with the original task
3. **Conflict resolution**: If conflicts exist, Claude resolves them FIRST, then proceeds with the original task
4. **Single commit for both**: Claude can commit conflict resolution + test fix together or separately
5. **Retry counting**: Conflict resolution doesn't count as an extra attempt (it's infrastructure, not a test failure)

**Why Merge Instead of Rebase?**

- Merge is safer for automated systems (preserves commit history)
- Easier conflict markers for Claude to understand
- GitHub auto-merge works better with merge commits
- No force-push needed (avoids triggering extra workflow runs)

## Benefits of V3

1. **Radical Simplicity**
   - No JSON state file to corrupt or debug
   - No file locking logic
   - No race conditions (serial processing)

2. **Native GitHub Integration**
   - Uses PRs as work items
   - Uses labels as state
   - Uses comments for retry tracking
   - Uses auto-merge for completion

3. **Easy Debugging**
   - State visible directly in GitHub UI
   - No hidden state files
   - PR history shows all attempts

4. **Predictable Behavior**
   - One spec at a time = deterministic
   - Clear state transitions via labels
   - No concurrent conflicts

5. **Maintainability**
   - Each workflow is small and focused
   - Standard GitHub Actions patterns
   - No custom state management code

6. **Cost Protection**
   - Built-in credit usage monitoring
   - Automatic pause when limits reached ($100/day, $500/week)
   - No runaway costs possible
   - Budget visibility via workflow logs

## Implementation Plan

### Phase 1: Core Infrastructure (Days 1-2)

**Goal:** Create the foundational workflows without executing Claude Code.

| Task                           | File                                                        | Acceptance Criteria                                                                                                          |
| ------------------------------ | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 1.1 Create PR Creator workflow | `.github/workflows/pr-creator.yml`                          | - Finds `.fixme()` specs<br>- Creates PRs with correct title format<br>- Adds `tdd-automation` label<br>- Enables auto-merge |
| 1.2 Create credit check script | `scripts/tdd-automation/core/check-credit-usage.ts`         | - Parses workflow logs<br>- Returns daily/weekly spend<br>- Has fallback ($15/run)<br>- Logs warnings at 80%                 |
| 1.3 Create Merge Watchdog      | `.github/workflows/merge-watchdog.yml`                      | - Runs every 30 min<br>- Detects stuck PRs<br>- Creates alert issues                                                         |
| 1.4 Update priority calculator | `scripts/tdd-automation/core/schema-priority-calculator.ts` | - Returns spec-id, file, priority<br>- Supports `--exclude` flag<br>- Extracts per-spec config                               |

**Test:** Manually trigger PR Creator, verify PR created correctly (don't let tests run yet).

### Phase 2: Test Workflow Integration (Days 3-4)

**Goal:** Enhance test.yml with TDD-specific logic.

| Task                         | File                         | Acceptance Criteria                                                                                                             |
| ---------------------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 2.1 Add TDD PR detection     | `.github/workflows/test.yml` | - Detects via label OR branch name<br>- Restores missing labels                                                                 |
| 2.2 Add change detection     | `.github/workflows/test.yml` | - Identifies fixme-only changes<br>- Determines test scope                                                                      |
| 2.3 Add failure handling     | `.github/workflows/test.yml` | - Reads attempt from PR title<br>- Classifies failure type<br>- Increments attempt on code failures<br>- Posts @claude comments |
| 2.4 Add sync check           | `.github/workflows/test.yml` | - Checks if behind main<br>- Posts sync request if needed                                                                       |
| 2.5 Add spec progress update | `.github/workflows/test.yml` | - Runs `analyze:specs` on main<br>- Commits with `[skip ci]`                                                                    |

**Test:** Create a test TDD PR, push failing code, verify:

- Attempt increments in title
- @claude comment posted
- Manual intervention label after 5 failures

### Phase 3: Claude Code Workflow (Days 5-6)

**Goal:** Enable Claude Code execution with safety controls.

| Task                            | File                                | Acceptance Criteria                                                                           |
| ------------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------- |
| 3.1 Create Claude Code workflow | `.github/workflows/claude-code.yml` | - Triggers on @claude comment<br>- Validates commenter is bot<br>- Validates TDD PR           |
| 3.2 Add main sync logic         | `.github/workflows/claude-code.yml` | - Fetches main before work<br>- Detects conflicts<br>- Adds conflict label                    |
| 3.3 Add timeout/heartbeat       | `.github/workflows/claude-code.yml` | - 45 min job timeout<br>- 40 min Claude timeout<br>- 10 min heartbeat comments                |
| 3.4 Add prompt building         | `.github/workflows/claude-code.yml` | - Conflict resolution prompt<br>- e2e-test-fixer prompt<br>- codebase-refactor-auditor prompt |
| 3.5 Add recovery logic          | `.github/workflows/claude-code.yml` | - Timeout retry (no count)<br>- Human review for conflicts                                    |

**Test:** End-to-end test with a simple failing spec:

1. PR Creator creates PR
2. Tests fail, @claude posted
3. Claude Code fixes
4. Tests pass, auto-merge

### Phase 4: Production Launch (Days 7-8)

**Goal:** Launch production pipeline.

| Task                      | Description   | Acceptance Criteria                                   |
| ------------------------- | ------------- | ----------------------------------------------------- |
| 4.1 Production monitoring | Set up alerts | - Daily cost summary<br>- Slack/Discord alerts at 80% |
| 4.2 Documentation         | Update docs   | - CLAUDE.md updated<br>- TDD pipeline docs updated    |

**Go-Live Checklist:**

- [ ] All Phase 1-3 tests passing
- [ ] Credit limits verified working
- [ ] Watchdog creating alerts correctly
- [ ] First 5 specs processed successfully
- [ ] No unexpected costs

### Timeline Summary

```
┌─────────────────────────────────────────────────────────────────┐
│ Week 1                                                          │
├─────────────────────────────────────────────────────────────────┤
│ Days 1-2: Phase 1 - Core Infrastructure                         │
│   └─ PR Creator, Credit Check, Watchdog, Priority Calculator    │
│                                                                  │
│ Days 3-4: Phase 2 - Test Workflow                               │
│   └─ TDD detection, failure handling, sync check                │
│                                                                  │
│ Days 5-6: Phase 3 - Claude Code Workflow                        │
│   └─ Execution, timeout, heartbeat, prompts                     │
│                                                                  │
│ Days 7-8: Phase 4 - Production Launch                           │
│   └─ Monitoring setup, documentation, go-live                   │
├─────────────────────────────────────────────────────────────────┤
│ Post-Launch: Process 230 specs (~6-8 days)                      │
└─────────────────────────────────────────────────────────────────┘
```

### Files to Create/Modify

**New Files:**

```
.github/workflows/pr-creator.yml       # NEW
.github/workflows/merge-watchdog.yml   # NEW
.github/workflows/claude-code.yml          # NEW
scripts/tdd-automation/core/check-credit-usage.ts  # NEW (or update existing)
```

**Modified Files:**

```
.github/workflows/test.yml                 # ADD TDD handling
scripts/tdd-automation/core/schema-priority-calculator.ts  # ADD --exclude, per-spec config
```

---

## Risks Summary

> **All mitigations are integrated into the workflow sections above.** This table provides a quick reference.

| #   | Risk                                | Mitigation                                   | Confidence   |
| --- | ----------------------------------- | -------------------------------------------- | ------------ |
| 1   | Serial processing time (~460 hours) | Chain reaction triggers, fast-path           | ✅ ~6-8 days |
| 2   | Cost parsing fragility              | Multi-pattern + $15 fallback + alerts        | ✅ High      |
| 3   | Merge conflict quality              | Flag label + human review gate               | ✅ High      |
| 4   | Comment-based retry counting        | PR title-based (immutable)                   | ✅ High      |
| 5   | GitHub API rate limits              | GraphQL batching + exponential backoff       | ✅ High      |
| 6   | Auto-merge stuck PRs                | Watchdog workflow every 30 min               | ✅ High      |
| 7   | Claude Code hangs/crashes           | 45 min timeout + heartbeat + recovery        | ✅ High      |
| 8   | Infrastructure failures             | Classification + auto-retry (no count)       | ✅ High      |
| 9   | Long-running specs                  | Per-spec `@tdd-max-attempts`, `@tdd-timeout` | ✅ High      |
| 10  | Label accidents                     | Branch name as backup identifier             | ✅ High      |

---

## Design Decisions (Formerly "Questions")

These questions have been answered and are now **final design decisions**:

| #   | Question               | Decision                                                                              | Rationale                                            |
| --- | ---------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| 1   | Cron frequency         | **Hourly** (backup only)                                                              | Chain reaction via `workflow_run` handles most cases |
| 2   | Max attempts           | **5** (default, configurable per-spec)                                                | Increased from 3 for 230-spec reliability            |
| 3   | Label names            | `tdd-automation`, `tdd-automation:manual-intervention`, `tdd-automation:had-conflict` | Clear, consistent naming                             |
| 4   | Branch naming          | `tdd/<spec-id>`                                                                       | Simple, serves as backup identifier                  |
| 5   | @claude comment format | Agent-specific with file paths                                                        | Enables correct agent selection                      |
| 6   | Regression shards      | **Keep existing (4)**                                                                 | No change needed                                     |
| 7   | Credit limits          | **$100/day, $500/week** with 80% warnings                                             | Conservative limits with alerts                      |
| 8   | Cost parsing           | Multi-pattern with $15 fallback                                                       | Handles format changes gracefully                    |
| 9   | Sync strategy          | **Merge** (not rebase)                                                                | Safer, no force-push, better for automation          |
| 10  | Conflict counting      | **Not counted** as attempt                                                            | Infrastructure issue, not code failure               |

---

## Deprecated: Detailed Risk Mitigations

> **Note:** The detailed risk mitigations previously in this section have been **integrated directly into the workflow implementations above**. The following section is kept for reference but should not be used - refer to the workflow YAML sections instead.

<details>
<summary>Click to expand legacy risk details (for reference only)</summary>

### 🔴 Risk 1: Serial Processing Time

**Risk**: 230 specs × ~2 hours average = ~460 hours (~19 days) of processing time.

**Accepted Trade-off**: We prioritize reliability over speed. Serial processing eliminates race conditions and debugging complexity.

**Optimizations Implemented**:

```yaml
# 1. Chain Reaction Trigger (minimize latency between specs)
# PR Creator triggers on BOTH cron AND workflow_run
on:
  schedule:
    - cron: '0 * * * *' # Hourly backup
  workflow_run:
    workflows: ['test'] # Triggers immediately when tests pass on main
    types: [completed]
    branches: [main]
```

```
Completion Flow (minimizes idle time):
TDD PR merged → main updated → test.yml runs → PR Creator triggers → next spec starts
                                              ↑
                                         ~2-5 minutes latency (not 55 minutes)
```

**Estimated Timeline**:

- With fast-path (tests already pass): ~10% of specs → instant merge
- With 1 attempt fixes: ~50% of specs → ~30 min each
- With 2-3 attempts: ~40% of specs → ~2 hours each
- **Realistic estimate**: ~150-200 hours (~6-8 days)

---

### 🔴 Risk 2: Cost Parsing Fragility

**Risk**: Parsing costs from logs could break silently.

**Solution: Multi-Layer Cost Tracking**

```typescript
// scripts/tdd-automation/core/check-credit-usage.ts

const FALLBACK_COST_PER_RUN = 15 // Conservative estimate if parsing fails

export function extractCostFromLogs(logs: string): number {
  // Pattern 1: "Total cost: $X.XX"
  const pattern1 = /Total cost: \$([0-9]+\.[0-9]+)/i
  // Pattern 2: "Cost: $X.XX" (alternative format)
  const pattern2 = /Cost: \$([0-9]+\.[0-9]+)/i
  // Pattern 3: "Session cost: X.XX USD"
  const pattern3 = /Session cost: ([0-9]+\.[0-9]+) USD/i

  for (const pattern of [pattern1, pattern2, pattern3]) {
    const match = logs.match(pattern)
    if (match) {
      return parseFloat(match[1])
    }
  }

  // CRITICAL: Log warning and use fallback
  console.warn('⚠️ COST PARSING FAILED - using fallback $15')
  return FALLBACK_COST_PER_RUN
}

// Add to workflow output for visibility
console.log(`::warning::Cost parsed: $${cost} (fallback used: ${usedFallback})`)
```

**Alerting**:

```yaml
- name: Alert if cost parsing failed
  if: steps.check-cost.outputs.used-fallback == 'true'
  run: |
    gh issue create --title "⚠️ TDD Cost Parsing Failed" \
      --body "Cost parsing failed for run ${{ github.run_id }}. Using fallback. Please verify Claude Code output format." \
      --label "tdd-automation,bug"
```

---

### 🔴 Risk 3: Merge Conflict Resolution Quality

**Risk**: Claude might incorrectly resolve complex conflicts.

**Solution: Conflict Flagging + Human Review Gate**

```yaml
# In claude-code.yml
- name: Detect and flag conflicts
  id: conflict-check
  run: |
    git fetch origin main
    if ! git merge origin/main --no-commit --no-ff 2>/dev/null; then
      echo "has-conflict=true" >> $GITHUB_OUTPUT
      git merge --abort
    fi

- name: Add conflict label
  if: steps.conflict-check.outputs.has-conflict == 'true'
  run: |
    gh pr edit $PR_NUMBER --add-label "tdd-automation:had-conflict"

- name: Execute Claude Code with conflict awareness
  run: |
    if [ "$HAS_CONFLICT" = "true" ]; then
      claude --print "⚠️ MERGE CONFLICT DETECTED

      IMPORTANT: This PR has conflicts with main. You must:
      1. Run: git fetch origin main && git merge origin/main
      2. Carefully resolve each conflict:
         - For DOMAIN MODEL conflicts: prefer main (newer schema)
         - For TEST FILE conflicts: merge both test cases
         - For CONFIG conflicts: prefer main
      3. After resolving, run full quality + regression tests
      4. If unsure about ANY conflict, add comment: '// TODO: human review needed'

      Then proceed with the original fix task."
    fi
```

**Human Review Requirement**:

```yaml
# PRs with conflicts require human approval before merge
- name: Disable auto-merge if had conflict
  if: contains(github.event.pull_request.labels.*.name, 'tdd-automation:had-conflict')
  run: |
    gh pr edit $PR_NUMBER --remove-label "tdd-automation:auto-merge"
    gh pr comment $PR_NUMBER --body "⚠️ This PR had merge conflicts that were auto-resolved. **Human review required before merge.**"
```

---

### 🟡 Risk 4: Comment-Based Retry Counting (Unreliable)

**Risk**: Comments can be deleted/edited, making count unreliable.

**Solution: Use PR Title for Attempt Tracking (Immutable)**

```yaml
# PR Title format: [TDD] Implement <spec-id> | Attempt X/5
# Example: [TDD] Implement API-TABLES-CREATE-001 | Attempt 2/5

- name: Get current attempt from PR title
  id: attempt
  run: |
    TITLE=$(gh pr view $PR_NUMBER --json title -q '.title')
    ATTEMPT=$(echo "$TITLE" | grep -oP 'Attempt \K[0-9]+' || echo "1")
    echo "current=$ATTEMPT" >> $GITHUB_OUTPUT

- name: Increment attempt in PR title
  if: failure()
  run: |
    NEW_ATTEMPT=$((ATTEMPT + 1))
    NEW_TITLE=$(echo "$TITLE" | sed "s/Attempt [0-9]\+/Attempt $NEW_ATTEMPT/")
    gh pr edit $PR_NUMBER --title "$NEW_TITLE"

- name: Check if max attempts reached
  if: steps.attempt.outputs.current >= 5
  run: |
    gh pr edit $PR_NUMBER --add-label "tdd-automation:manual-intervention"
    echo "Max attempts (5) reached - marking for manual intervention"
```

**Configurable Max Attempts**:

```yaml
# Default: 5 attempts (increased from 3 for 230-spec reliability)
# Can be overridden per-spec via test file comment:
# // @tdd-max-attempts: 8
```

---

### 🟡 Risk 5: GitHub API Rate Limits

**Risk**: 230 specs × multiple API calls could hit rate limits.

**Solution: Batched GraphQL Queries + Caching**

```typescript
// scripts/tdd-automation/core/github-api.ts

// Single GraphQL query instead of multiple REST calls
const GET_TDD_STATE = `
  query GetTDDState($owner: String!, $repo: String!) {
    repository(owner: $owner, name: $repo) {
      # Get all TDD PRs in one query
      tddPRs: pullRequests(labels: ["tdd-automation"], states: [OPEN], first: 10) {
        nodes {
          number
          title
          headRefName
          mergeStateStatus
          labels(first: 10) { nodes { name } }
        }
      }
      # Get manual intervention PRs
      manualPRs: pullRequests(labels: ["tdd-automation:manual-intervention"], states: [OPEN], first: 50) {
        nodes {
          headRefName
        }
      }
    }
  }
`

// Cache results for 60 seconds
const cache = new Map<string, { data: any; timestamp: number }>()
const CACHE_TTL = 60_000

export async function getTDDState(): Promise<TDDState> {
  const cached = cache.get('tdd-state')
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data
  }

  const data = await graphqlQuery(GET_TDD_STATE)
  cache.set('tdd-state', { data, timestamp: Date.now() })
  return data
}
```

**Rate Limit Handling**:

```yaml
- name: API call with backoff
  run: |
    for i in 1 2 3 4 5; do
      if gh pr list --label "tdd-automation" --json number 2>/dev/null; then
        break
      fi
      echo "Rate limited, waiting $((i * 30)) seconds..."
      sleep $((i * 30))
    done
```

---

### 🟡 Risk 6: Auto-Merge Failures

**Risk**: PR stuck after tests pass.

**Solution: Merge Watchdog Workflow**

```yaml
# .github/workflows/merge-watchdog.yml
name: TDD Merge Watchdog

on:
  schedule:
    - cron: '*/30 * * * *' # Every 30 minutes

jobs:
  check-stuck-prs:
    runs-on: ubuntu-latest
    steps:
      - name: Find stuck TDD PRs
        run: |
          # Find PRs that are:
          # - Labeled tdd-automation (not manual-intervention)
          # - All checks passed
          # - Mergeable
          # - Not merged in >2 hours

          STUCK_PRS=$(gh pr list \
            --label "tdd-automation" \
            --json number,title,updatedAt,mergeStateStatus,statusCheckRollup \
            --jq '[.[] |
              select(.mergeStateStatus == "CLEAN") |
              select(.statusCheckRollup | all(.conclusion == "SUCCESS")) |
              select((now - (.updatedAt | fromdateiso8601)) > 7200)
            ] | .[].number')

          for PR in $STUCK_PRS; do
            echo "PR #$PR is stuck - attempting merge"
            gh pr merge $PR --squash --auto || true
          done

      - name: Alert on persistent stuck PRs
        run: |
          # If PR stuck for >6 hours, create alert issue
          VERY_STUCK=$(gh pr list --label "tdd-automation" --json number,updatedAt \
            --jq '[.[] | select((now - (.updatedAt | fromdateiso8601)) > 21600)] | .[].number')

          if [ -n "$VERY_STUCK" ]; then
            gh issue create \
              --title "🚨 TDD PR stuck for >6 hours" \
              --body "PRs stuck: $VERY_STUCK. Please investigate branch protection rules." \
              --label "tdd-automation,urgent"
          fi
```

---

### 🟡 Risk 7: Claude Code Hangs/Crashes

**Risk**: No push → pipeline stalls.

**Solution: Timeout + Heartbeat + Recovery**

```yaml
# In claude-code.yml
jobs:
  fix-code:
    timeout-minutes: 45 # Hard timeout

    steps:
      - name: Start heartbeat
        run: |
          # Post progress comment every 10 minutes
          (
            while true; do
              sleep 600
              gh pr comment $PR_NUMBER --body "🤖 Claude Code still working... (heartbeat)"
            done
          ) &
          echo $! > /tmp/heartbeat.pid

      - name: Execute Claude Code
        id: claude
        continue-on-error: true
        run: |
          timeout 40m claude --print "$PROMPT" || echo "status=timeout" >> $GITHUB_OUTPUT

      - name: Stop heartbeat
        if: always()
        run: kill $(cat /tmp/heartbeat.pid) 2>/dev/null || true

      - name: Handle timeout
        if: steps.claude.outputs.status == 'timeout'
        run: |
          # Don't count as attempt - it's infrastructure failure
          gh pr comment $PR_NUMBER --body "⏱️ Claude Code timed out (infrastructure issue - not counting as attempt). Retrying..."
          # Re-trigger by posting new @claude comment
          gh pr comment $PR_NUMBER --body "@claude Previous attempt timed out. Please continue fixing the failing tests."
```

---

### 🟢 Risk 8: Infrastructure Failures

**Risk**: GitHub/network issues counting against attempts.

**Solution: Failure Classification**

```yaml
- name: Classify failure type
  if: failure()
  id: classify
  run: |
    # Infrastructure failures (don't count)
    if [[ "$ERROR" == *"rate limit"* ]] || \
       [[ "$ERROR" == *"timeout"* ]] || \
       [[ "$ERROR" == *"network"* ]] || \
       [[ "$ERROR" == *"503"* ]] || \
       [[ "$ERROR" == *"502"* ]]; then
      echo "type=infrastructure" >> $GITHUB_OUTPUT
    else
      echo "type=code" >> $GITHUB_OUTPUT
    fi

- name: Increment attempt (code failures only)
  if: steps.classify.outputs.type == 'code'
  run: |
    # Only increment attempt counter for actual code failures
    ./scripts/increment-attempt.sh $PR_NUMBER

- name: Retry infrastructure failure
  if: steps.classify.outputs.type == 'infrastructure'
  run: |
    gh pr comment $PR_NUMBER --body "🔄 Infrastructure issue detected. Auto-retrying in 5 minutes..."
    sleep 300
    gh workflow run claude-code.yml -f pr_number=$PR_NUMBER
```

---

### 🟢 Risk 9: Long-Running Specs

**Risk**: Complex specs need >5 attempts.

**Solution: Per-Spec Configurable Limits**

```typescript
// In spec file: specs/api/complex-feature.spec.ts
/**
 * @tdd-max-attempts 10
 * @tdd-timeout 60
 */
test.fixme('complex feature that needs many iterations', async () => {
  // ...
})
```

```yaml
# Extract config from spec file
- name: Get spec config
  run: |
    MAX_ATTEMPTS=$(grep -oP '@tdd-max-attempts \K[0-9]+' "$SPEC_FILE" || echo "5")
    TIMEOUT=$(grep -oP '@tdd-timeout \K[0-9]+' "$SPEC_FILE" || echo "45")
    echo "max-attempts=$MAX_ATTEMPTS" >> $GITHUB_OUTPUT
    echo "timeout=$TIMEOUT" >> $GITHUB_OUTPUT
```

---

### 🟢 Risk 10: Label Accidents

**Risk**: Human removes label accidentally.

**Solution: Branch Name as Backup Identifier**

```yaml
# Always check BOTH label AND branch name
- name: Identify TDD PR
  run: |
    IS_TDD_BY_LABEL=$(gh pr view $PR --json labels -q '.labels[].name' | grep -c "tdd-automation" || echo "0")
    IS_TDD_BY_BRANCH=$(echo "$BRANCH" | grep -c "^tdd/" || echo "0")

    if [ "$IS_TDD_BY_LABEL" -gt 0 ] || [ "$IS_TDD_BY_BRANCH" -gt 0 ]; then
      echo "is-tdd=true" >> $GITHUB_OUTPUT

      # Restore label if missing
      if [ "$IS_TDD_BY_LABEL" -eq 0 ] && [ "$IS_TDD_BY_BRANCH" -gt 0 ]; then
        gh pr edit $PR --add-label "tdd-automation"
        echo "Restored missing tdd-automation label"
      fi
    fi
```

---

## Reliability Summary for 230 Specs

| Risk                    | Mitigation                         | Confidence                |
| ----------------------- | ---------------------------------- | ------------------------- |
| Serial processing time  | Chain reaction triggers, fast-path | ✅ Acceptable (~6-8 days) |
| Cost parsing            | Multi-pattern + fallback + alerts  | ✅ High                   |
| Merge conflicts         | Flag + human review gate           | ✅ High                   |
| Retry counting          | PR title (immutable)               | ✅ High                   |
| API rate limits         | GraphQL batching + cache + backoff | ✅ High                   |
| Auto-merge stuck        | Watchdog workflow                  | ✅ High                   |
| Claude hangs            | Timeout + heartbeat + recovery     | ✅ High                   |
| Infrastructure failures | Classification + no-count retry    | ✅ High                   |
| Long-running specs      | Per-spec config                    | ✅ High                   |
| Label accidents         | Branch name backup                 | ✅ High                   |

**Expected Outcome**: All 230 specs processed reliably over ~6-8 days with:

- Zero data loss
- Full audit trail in GitHub PRs
- Automatic recovery from transient failures
- Human escalation for genuine issues

</details>

---

_Document ready for implementation. See [Implementation Plan](#implementation-plan) to begin._
