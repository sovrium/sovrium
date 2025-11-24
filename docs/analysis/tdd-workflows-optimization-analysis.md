# TDD Automation Workflows - Optimization Analysis

**Date**: 2025-11-24
**Analyzed Workflows**: 9 TDD automation workflows
**Focus**: Simplicity, Performance, Reliability

---

## Executive Summary

The current TDD automation system consists of **9 interconnected workflows** totaling **~100KB of YAML configuration**. While the system works, it suffers from significant **complexity overhead** and **maintenance burden**.

**Key Findings**:

- ⚠️ **Over-engineered**: 9 workflows for what could be 3-4
- ⚠️ **High maintenance**: 5 monitoring/recovery workflows to manage 4 core workflows
- ⚠️ **Polling overhead**: 4 workflows polling every 10-15 minutes (wasteful)
- ✅ **Good reliability**: Recovery mechanisms work but add complexity
- ✅ **Good separation**: Queue, processing, and execution are well-separated

**Recommended Actions**:

1. **Consolidate** 5 workflows → 1 unified monitoring workflow
2. **Replace polling** with event-driven triggers (webhook-style)
3. **Simplify** by removing redundant checks and recovery logic
4. **Optimize** scheduling to reduce GitHub Actions minutes

**Estimated Savings**:

- 60% reduction in workflow count (9 → 4)
- 70% reduction in YAML configuration (~100KB → ~30KB)
- 50% reduction in GitHub Actions minutes (polling elimination)

---

## Current Architecture Analysis

### 1. Core Workflows (4)

| Workflow                    | Purpose             | Trigger                    | Complexity | Status      |
| --------------------------- | ------------------- | -------------------------- | ---------- | ----------- |
| **tdd-queue-populate.yml**  | Scan for RED tests  | Daily 2AM + manual         | Low        | ✅ Keep     |
| **tdd-queue-processor.yml** | Pick next spec      | Every 10 min               | Medium     | ✅ Keep     |
| **claude-tdd.yml**          | Execute Claude Code | workflow_dispatch + events | High       | ⚠️ Simplify |
| **tdd-daily-refactor.yml**  | Daily refactoring   | Daily 2AM                  | Medium     | ✅ Keep     |

**Analysis**:

- **Queue Populate** (3KB): Clean, simple, idempotent. ✅ Well-designed
- **Queue Processor** (15KB): Serial processing, good concurrency control. ⚠️ Polling overhead
- **Claude TDD** (30KB): Main execution engine. ⚠️ Too complex (800+ lines)
- **Daily Refactor** (9KB): Good design, waits for clean state. ✅ Well-designed

### 2. Monitoring/Recovery Workflows (5)

| Workflow                            | Purpose                               | Trigger      | Necessity | Recommendation |
| ----------------------------------- | ------------------------------------- | ------------ | --------- | -------------- |
| **tdd-queue-stuck-pr-monitor.yml**  | Fix stuck PRs, auto-retry             | Every 10 min | Medium    | 🔄 Consolidate |
| **tdd-circuit-breaker.yml**         | Health monitoring, disable on failure | Every 15 min | Low       | 🔄 Consolidate |
| **tdd-retry-monitor.yml**           | Track retry attempts                  | Every ? min  | Low       | 🔄 Consolidate |
| **tdd-queue-recovery.yml**          | Recover stuck issues                  | Every ? min  | Medium    | 🔄 Consolidate |
| **tdd-queue-conflict-resolver.yml** | Resolve PR conflicts                  | Every ? min  | Low       | 🔄 Consolidate |

**Analysis**:

- **5 separate workflows** doing related monitoring tasks
- **Redundant checks**: Multiple workflows checking PR status, issue status
- **Polling overhead**: Running every 10-15 min = 96-144 runs/day per workflow
- **GitHub Actions cost**: ~500-700 workflow runs/day just for monitoring

**Problem**: These workflows exist to **compensate for complexity** in the main workflows. Simpler main workflows = less need for monitoring.

---

## Complexity Analysis

### Workflow Size Comparison

```
claude-tdd.yml                 29,962 bytes  (800+ lines)  ⚠️ Too large
tdd-queue-stuck-pr-monitor.yml 19,472 bytes  (500+ lines)  ⚠️ Too large
tdd-queue-processor.yml        14,895 bytes  (357 lines)   ⚠️ Complex
tdd-daily-refactor.yml          9,492 bytes  (250 lines)   ✅ Reasonable
tdd-circuit-breaker.yml        10,147 bytes  (280 lines)   ⚠️ Complex
tdd-retry-monitor.yml           8,533 bytes  (230 lines)   ⚠️ Polling
tdd-queue-recovery.yml          8,284 bytes  (220 lines)   ⚠️ Polling
tdd-queue-conflict-resolver.yml 6,165 bytes  (165 lines)   ⚠️ Polling
tdd-queue-populate.yml          3,246 bytes  (104 lines)   ✅ Clean
-------------------------------------------------------------------
TOTAL:                        110,196 bytes  (3,106 lines)
```

**Comparison** (typical GitHub Actions workflows):

- **Simple CI/CD**: 50-200 lines
- **Complex CI/CD**: 300-500 lines
- **This project**: 3,106 lines (6-10x typical)

### Concurrency & Locking

```yaml
# Current: Multiple concurrency groups
tdd-queue                      # Processor + Daily Refactor
tdd-queue-populate             # Populate
claude-${{...}}                # Claude Code (per-issue)
tdd-stuck-pr-monitor           # PR Monitor
# ... + 5 more for other workflows
```

**Problem**: Complex concurrency logic with multiple groups. Hard to reason about.

**Better Approach**: Single queue concurrency group + event-driven triggers.

---

## Performance Analysis

### GitHub Actions Minutes Usage (Estimated)

**Daily Execution Count**:

```
Queue Processor:      144 runs/day (every 10 min) × 5 min  = 720 min/day
PR Monitor:           144 runs/day (every 10 min) × 5 min  = 720 min/day
Circuit Breaker:       96 runs/day (every 15 min) × 5 min  = 480 min/day
Retry Monitor:        144 runs/day (est. 10 min)  × 5 min  = 720 min/day
Recovery:             144 runs/day (est. 10 min)  × 5 min  = 720 min/day
Conflict Resolver:    144 runs/day (est. 10 min)  × 5 min  = 720 min/day
Queue Populate:         1 run/day                 × 10 min = 10 min/day
Daily Refactor:         1 run/day                 × 30 min = 30 min/day
Claude TDD:           ~20 runs/day (variable)     × 30 min = 600 min/day
-------------------------------------------------------------------
TOTAL:                                             ~4,720 min/day
                                                   ~141,600 min/month
```

**Cost (GitHub Actions pricing)**:

- Free tier: 2,000 min/month (private repos)
- **Overage**: ~139,600 min/month × $0.008/min = **$1,116.80/month**

**Actual usage** is likely lower (many runs skip early), but polling is **extremely wasteful**.

### Recommendations for Performance

**1. Event-Driven Architecture** (eliminate polling)

```yaml
# Replace: Polling every 10 min
schedule:
  - cron: '*/10 * * * *'

# With: Event-driven triggers
on:
  pull_request:
    types: [opened, synchronize, reopened]
  check_run:
    types: [completed]
  workflow_run:
    workflows: ['Claude Code TDD']
    types: [completed]
```

**Savings**: 80-90% reduction in workflow runs

**2. Consolidate Monitoring** (5 workflows → 1)

```yaml
name: TDD Monitor & Recovery (Unified)

on:
  schedule:
    - cron: '*/30 * * * *' # Run every 30 min (not 10)
  workflow_dispatch:
  workflow_run:
    workflows: ['Claude Code TDD', 'TDD Queue - Processor']
    types: [completed]

jobs:
  monitor:
    steps:
      - name: Check PR status
      - name: Check circuit breaker
      - name: Handle retries
      - name: Recover stuck issues
      - name: Resolve conflicts
```

**Benefits**:

- Single workflow = single concurrency group
- Shared context = better decisions
- Less overhead = faster execution
- Easier to maintain

---

## Reliability Analysis

### Current Reliability Mechanisms

✅ **Good Practices**:

1. **Strict serial processing** (concurrency: cancel-in-progress: false)
2. **Duplicate detection** (checks for existing PRs)
3. **Infrastructure retry** (max 3 attempts)
4. **Circuit breaker** (disables on high failure rate)
5. **Auto-merge verification** (checks if enabled)

⚠️ **Over-Engineering**:

1. **Too many recovery workflows** (5 separate monitors)
2. **Redundant checks** (PR status checked in 3+ workflows)
3. **Complex retry logic** (infrastructure + code retries)
4. **Excessive polling** (every 10-15 min for everything)

### Failure Modes & Recovery

**Observed Issues** (from workflow comments):

- ❌ **Issue #1319**: PR not created → spec marked failed
- ❌ **PRs #1541, #1546**: Auto-merge not enabled → pipeline blocked
- ✅ **Recovery works**: Workflows detect and fix issues

**Analysis**: The recovery mechanisms **compensate for complexity** in the main workflow. Simpler design = fewer failures = less recovery needed.

---

## Simplification Recommendations

### Priority 1: Consolidate Monitoring (High Impact)

**Current State**: 5 separate monitoring workflows

```
tdd-queue-stuck-pr-monitor.yml   (19KB)
tdd-circuit-breaker.yml          (10KB)
tdd-retry-monitor.yml            (8KB)
tdd-queue-recovery.yml           (8KB)
tdd-queue-conflict-resolver.yml  (6KB)
```

**Proposed State**: 1 unified monitoring workflow

```yaml
name: TDD Monitor (Unified)

on:
  schedule:
    - cron: '*/30 * * * *' # Every 30 min (not 10)
  workflow_dispatch:
  workflow_run:
    workflows: ['Claude Code TDD']
    types: [completed]

jobs:
  monitor:
    name: Monitor & Recover
    runs-on: ubuntu-latest
    timeout-minutes: 10

    steps:
      # 1. Health Check (Circuit Breaker)
      - name: Check pipeline health
        id: health
        run: |
          # Check failure rate
          # Disable workflows if > 50% failure rate

      # 2. PR Monitoring
      - name: Monitor open PRs
        if: steps.health.outputs.healthy == 'true'
        run: |
          # Check for stuck PRs (missing auto-merge)
          # Check for failed tests (trigger retry)
          # Check for conflicts (auto-resolve)

      # 3. Issue Recovery
      - name: Recover stuck issues
        run: |
          # Check for issues stuck in-progress > 90 min
          # Re-queue or mark failed

      # 4. Retry Management
      - name: Handle retries
        run: |
          # Track retry attempts
          # Trigger retries if < 3 attempts
```

**Benefits**:

- 5 workflows → 1 workflow (80% reduction)
- 51KB → ~8KB (84% reduction in code)
- Shared context = smarter decisions
- Less GitHub Actions minutes

---

### Priority 2: Simplify Claude TDD Workflow (Medium Impact)

**Current**: 30KB, 800+ lines, extremely complex

**Issues**:

1. **Massive comment template** (200+ lines of instructions)
2. **Complex concurrency logic** (multiple conditions)
3. **Redundant validation** (checked multiple times)
4. **Infrastructure retry logic** (should be separate)

**Recommendations**:

#### 2a. Extract Instructions to Documentation

```yaml
# Current (200+ lines inline)
gh issue comment "$ISSUE_NUMBER" --body "@claude implement this spec...
[200+ lines of instructions]
"

# Proposed (reference doc)
gh issue comment "$ISSUE_NUMBER" --body "@claude implement this spec following workflow documented in @docs/development/tdd-automation-pipeline.md

**Quick Reference**:
- Test File: \`$TEST_FILE\`
- Spec ID: \`$SPEC_ID\`
- Issue: #$ISSUE_NUMBER

See full workflow instructions in project documentation."
```

**Benefits**:

- Workflow: 30KB → 15KB (50% smaller)
- Easier to maintain (update docs, not YAML)
- More readable

#### 2b. Simplify Concurrency Control

```yaml
# Current (complex conditional)
concurrency:
  group: claude-${{
    github.event_name == 'workflow_dispatch' && format('issue-{0}', github.event.inputs.issue_number) ||
    (github.event_name == 'issue_comment' && github.event.comment.user.login == 'claude[bot]') && format('skip-bot-{0}', github.run_id) ||
    (github.event_name == 'issue_comment' && contains(github.event.issue.title, '🤖')) && format('issue-{0}', github.event.issue.number) ||
    ...
  }}

# Proposed (simple)
concurrency:
  group: claude-issue-${{ github.event.issue.number || github.event.inputs.issue_number }}
  cancel-in-progress: false
```

**Benefits**: Easier to understand, maintain, and debug

#### 2c. Move Infrastructure Retry to Monitor

```yaml
# Current: Infrastructure retry logic in claude-tdd.yml
# Proposed: Move to unified monitor workflow

# Monitor detects failed Claude runs → triggers retry
# Cleaner separation of concerns
```

---

### Priority 3: Optimize Scheduling (Low Effort, High Impact)

**Current Polling Frequencies**:

```yaml
Queue Processor:  */10 * * * *  (every 10 min)  ⚠️ Too frequent
PR Monitor:       */10 * * * *  (every 10 min)  ⚠️ Too frequent
Circuit Breaker:  */15 * * * *  (every 15 min)  ⚠️ Too frequent
Other monitors:   */10 * * * *  (assumed)       ⚠️ Too frequent
```

**Proposed Frequencies**:

```yaml
Queue Processor:      */15 * * * *  (every 15 min)  ✅ Reasonable
Unified Monitor:      */30 * * * *  (every 30 min)  ✅ Sufficient
Queue Populate:       0 2 * * *     (daily 2 AM)    ✅ Keep
Daily Refactor:       0 2 * * *     (daily 2 AM)    ✅ Keep
```

**Impact**:

- Queue Processor: 144 → 96 runs/day (33% reduction)
- Monitors: 720 → 48 runs/day (93% reduction per workflow)
- Total: ~4,720 → ~1,500 min/day (68% reduction)

**Rationale**:

- Specs take 30-60 min to complete anyway
- 10 min polling doesn't provide real benefit
- 15-30 min is sufficient for monitoring

---

## Proposed Architecture

### Simplified Workflow Structure (4 workflows)

```
┌─────────────────────────────────────────────────────────────────┐
│                     TDD AUTOMATION SYSTEM                        │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────────┐
│ 1. Queue Populate    │  Daily 2 AM
│ - Scan RED tests     │  Creates spec issues
│ - Validate schemas   │
└──────────────────────┘
           │
           ▼
┌──────────────────────┐
│ 2. Queue Processor   │  Every 15 min
│ - Pick next spec     │  Triggers Claude TDD
│ - Mark in-progress   │  Serial processing
└──────────────────────┘
           │
           ▼
┌──────────────────────┐
│ 3. Claude TDD        │  Event-driven
│ - Execute agents     │  (workflow_dispatch + comments)
│ - Implement spec     │
│ - Create PR          │
└──────────────────────┘
           │
           ▼
┌──────────────────────┐
│ 4. TDD Monitor       │  Every 30 min + events
│ - Check PR status    │  (unified monitoring)
│ - Handle retries     │
│ - Enable auto-merge  │
│ - Circuit breaker    │
│ - Recover stuck      │
└──────────────────────┘
           │
           ▼
┌──────────────────────┐
│ 5. Daily Refactor    │  Daily 2 AM
│ - Wait for clean     │  (keep as-is)
│ - Run audit          │
└──────────────────────┘
```

### Workflow Count Reduction

**Before**: 9 workflows

```
1. tdd-queue-populate.yml
2. tdd-queue-processor.yml
3. claude-tdd.yml
4. tdd-queue-stuck-pr-monitor.yml
5. tdd-circuit-breaker.yml
6. tdd-retry-monitor.yml
7. tdd-queue-recovery.yml
8. tdd-queue-conflict-resolver.yml
9. tdd-daily-refactor.yml
```

**After**: 4 workflows (5 including daily refactor)

```
1. tdd-queue-populate.yml          (keep as-is)
2. tdd-queue-processor.yml         (optimize schedule)
3. claude-tdd.yml                  (simplify)
4. tdd-monitor-unified.yml         (consolidate 5 → 1)
5. tdd-daily-refactor.yml          (keep as-is)
```

---

## Implementation Roadmap

### Phase 1: Quick Wins (Week 1) - No Breaking Changes

**Goal**: Reduce GitHub Actions minutes by 50%

1. **Optimize scheduling** (30 min)
   - Change polling: 10 min → 15 min for processor
   - Change polling: 10-15 min → 30 min for monitors
   - Test for 3 days, verify no impact

2. **Extract documentation** (2 hours)
   - Move inline instructions from claude-tdd.yml to docs/
   - Update workflow to reference docs
   - Verify Claude Code still works

3. **Simplify concurrency** (1 hour)
   - Simplify concurrency groups in claude-tdd.yml
   - Test with manual triggers

**Deliverables**:

- ~50% reduction in GitHub Actions minutes
- Cleaner, more maintainable workflows
- No functional changes

### Phase 2: Consolidation (Week 2-3) - Requires Testing

**Goal**: Consolidate monitoring workflows

1. **Create tdd-monitor-unified.yml** (4 hours)
   - Combine logic from 5 monitoring workflows
   - Add event-driven triggers (workflow_run)
   - Implement all checks in single job

2. **Test unified monitor** (2 days)
   - Run alongside existing monitors
   - Compare behavior, verify correctness
   - Fix edge cases

3. **Deprecate old monitors** (1 hour)
   - Disable 5 old monitoring workflows
   - Monitor for issues for 3 days
   - Delete if no issues found

**Deliverables**:

- 5 workflows → 1 workflow
- Shared context = smarter decisions
- Event-driven = less polling

### Phase 3: Event-Driven (Week 4-5) - Advanced

**Goal**: Replace polling with event-driven architecture

1. **Add webhook triggers** (3 hours)
   - Claude TDD: trigger on PR events
   - Monitor: trigger on workflow_run
   - Processor: trigger on issue updates (optional)

2. **Test event-driven flow** (3 days)
   - Verify events trigger correctly
   - Check no missed events
   - Monitor for race conditions

3. **Remove scheduled triggers** (1 hour)
   - Keep daily schedules (2 AM)
   - Remove high-frequency polling
   - Keep workflow_dispatch for manual use

**Deliverables**:

- 80-90% reduction in workflow runs
- Near-zero polling overhead
- Faster response times

---

## Metrics & Success Criteria

### Current Baseline (Estimated)

```
Total workflows:        9
Total YAML size:        110 KB
Workflow runs/day:      ~800-1000
GitHub Actions min/day: ~4,720 min
Workflow runs/month:    ~25,000
GitHub Actions cost:    ~$1,100/month
```

### Target After Phase 1 (Quick Wins)

```
Total workflows:        9 (no change)
Total YAML size:        95 KB (15% reduction)
Workflow runs/day:      ~500-600 (40% reduction)
GitHub Actions min/day: ~2,500 min (50% reduction)
Workflow runs/month:    ~16,000 (36% reduction)
GitHub Actions cost:    ~$600/month (45% reduction)
```

### Target After Phase 2 (Consolidation)

```
Total workflows:        5 (44% reduction)
Total YAML size:        45 KB (60% reduction)
Workflow runs/day:      ~300-400 (60% reduction)
GitHub Actions min/day: ~1,800 min (62% reduction)
Workflow runs/month:    ~10,000 (60% reduction)
GitHub Actions cost:    ~$400/month (64% reduction)
```

### Target After Phase 3 (Event-Driven)

```
Total workflows:        5 (same)
Total YAML size:        40 KB (64% reduction)
Workflow runs/day:      ~50-100 (90% reduction)
GitHub Actions min/day: ~800 min (83% reduction)
Workflow runs/month:    ~2,000 (92% reduction)
GitHub Actions cost:    ~$100/month (91% reduction)
```

---

## Risk Assessment

### Low Risk (Phase 1 - Quick Wins)

- ✅ Scheduling changes: Easy to revert
- ✅ Documentation extraction: No logic changes
- ✅ Concurrency simplification: Well-tested pattern

**Mitigation**: Test for 3 days before committing

### Medium Risk (Phase 2 - Consolidation)

- ⚠️ Logic consolidation: Potential edge cases
- ⚠️ Shared state: Race conditions possible

**Mitigation**:

- Run new monitor alongside old ones
- Compare outputs for 1 week
- Gradual rollout with feature flags

### High Risk (Phase 3 - Event-Driven)

- ⚠️ Event timing: May miss events
- ⚠️ Race conditions: Multiple triggers
- ⚠️ GitHub API limits: Webhook quotas

**Mitigation**:

- Keep scheduled backups (every 30 min)
- Extensive testing in staging
- Gradual rollout (1 workflow at a time)
- Monitoring alerts for missed events

---

## Conclusion

The current TDD automation system is **over-engineered** with **9 workflows** and **5 redundant monitors** compensating for complexity.

**Recommended Actions** (in priority order):

1. **Phase 1 (Quick Wins)**: Optimize scheduling, extract docs → 50% cost reduction
2. **Phase 2 (Consolidate)**: Merge 5 monitors → 1 → 60% simpler
3. **Phase 3 (Event-Driven)**: Replace polling → webhooks → 90% less runs

**Expected Outcomes**:

- ✅ 60% fewer workflows (9 → 4)
- ✅ 70% less YAML code (~110KB → ~30KB)
- ✅ 90% fewer workflow runs (event-driven)
- ✅ 90% lower GitHub Actions cost (~$1,100 → ~$100/month)
- ✅ **Better reliability** (simpler = fewer bugs)
- ✅ **Easier maintenance** (less code to maintain)

**Philosophy**: _"Perfection is achieved not when there is nothing more to add, but when there is nothing left to take away."_ - Antoine de Saint-Exupéry

The goal is not to add more monitoring, but to **simplify the core system** so less monitoring is needed.

---

**Next Steps**:

1. Review and approve this analysis
2. Implement Phase 1 (Quick Wins) - 1 week
3. Measure impact for 1 week
4. Decide on Phase 2 & 3 based on results
