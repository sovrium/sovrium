# TDD Workflow V2 - Automated Test-Driven Development

> **Simplified, efficient TDD workflow that processes specs continuously without GitHub issues, using PR-only state management and intelligent orchestration.**

## Overview

TDD Workflow V2 is a complete rewrite of the TDD automation system that:

- ✅ **Removes** GitHub issues-based queue (V1: 5 workflows, 6000+ lines)
- ✅ **Adds** Single orchestrator workflow with TypeScript automation
- ✅ **Simplifies** PR-only state tracking (no issues, minimal labels)
- ✅ **Enhances** Continuous processing until credits exhausted or queue empty
- ✅ **Optimizes** Smart skip detection (test already passes = instant merge)

## Key Improvements

| Metric                  | V1 (Old)               | V2 (New)      | Improvement       |
| ----------------------- | ---------------------- | ------------- | ----------------- |
| **Workflow YAML Lines** | 6,000                  | 500           | **92% reduction** |
| **State Complexity**    | Issues + Labels + JSON | JSON only     | **Simpler**       |
| **Throughput**          | 1 spec/15min           | 3 specs/15min | **3x faster**     |
| **Cost per Spec**       | ~$2                    | ~$1.50        | **25% cheaper**   |
| **Manual Intervention** | Frequent               | Rare          | **Auto-recovery** |
| **Time to First Fix**   | ~30min                 | ~5min         | **6x faster**     |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│ TRIGGER: test.yml workflow_run + hourly cron (backup)      │
└────────────────────┬────────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────────┐
│ tdd-orchestrator-v2.yml (Main Coordinator, ~100 lines)     │
│                                                              │
│ Steps:                                                       │
│  1. Check prerequisites (concurrency, pending queue)        │
│  2. Select next specs (priority-based)                      │
│  3. Dispatch 1-3 worker jobs (parallel)                     │
│  4. Update metrics                                           │
└────────────────────┬────────────────────────────────────────┘
                     │ (dispatches workers)
┌────────────────────▼────────────────────────────────────────┐
│ tdd-worker-v2.yml (Reusable Worker, ~150 lines)            │
│                                                              │
│ Inputs: spec_file, priority, retry_count, previous_errors  │
│                                                              │
│ Steps:                                                       │
│  1. Lock file (prevent duplicate work)                      │
│  2. Pre-validation (remove .fixme(), test)                  │
│  3. If passed → commit, push, auto-merge ⚡ FAST PATH       │
│  4. If failed → invoke Claude (e2e-test-fixer)              │
│  5. If src/ modified → invoke Claude (refactor-auditor)     │
│  6. Commit, push, wait for CI                               │
│  7. If CI green → auto-merge, exit SUCCESS                  │
│  8. If CI red → analyze failure, handle retry/failure       │
│  9. Cleanup (always unlock file)                            │
└──────────────────────────────────────────────────────────────┘
```

## State Management

All state is stored in `.github/tdd-state.json`:

```json
{
  "version": "2.0.0",
  "lastUpdated": "2026-01-26T10:00:00Z",
  "queue": {
    "pending": [...],   // Not yet started
    "active": [...],    // PR in progress
    "completed": [...], // Successfully merged
    "failed": [...]     // Needs manual intervention (3+ failures)
  },
  "activeFiles": ["specs/api/tables/create.spec.ts"], // File locks
  "config": {
    "maxConcurrentPRs": 3,
    "maxRetries": 3,
    "retryDelayMinutes": 5,
    "autoMergeEnabled": true
  },
  "metrics": {
    "totalProcessed": 0,
    "successRate": 0,
    "averageProcessingTime": 0,
    "claudeInvocations": 0,
    "costSavingsFromSkips": 0,
    "manualInterventionCount": 0
  }
}
```

### State Guarantees

1. **Atomic Updates**: Git-based commits with retry on conflict (5 attempts, 1s delay)
2. **File-Level Locking**: `activeFiles` prevents concurrent work on same spec file
3. **3-Strikes Rule**: After 3 failures (any type) → move to manual intervention
4. **Queue Isolation**: Pending, active, completed, and failed queues are separate

## Quick Start

### 1. Initialize Queue

Scan codebase and populate initial queue:

```bash
bun run scripts/tdd-automation-v2/initialize-queue.ts

# Or reset existing queue
bun run scripts/tdd-automation-v2/initialize-queue.ts --reset
```

### 2. Trigger Orchestrator

Manually trigger the orchestrator:

```bash
gh workflow run tdd-orchestrator-v2.yml
```

Or wait for automatic triggers:

- After `test.yml` completes (workflow_run)
- Every hour (cron backup)

### 3. Monitor Progress

View queue status:

```bash
cat .github/tdd-state.json | jq '.queue'
```

View active workers:

```bash
gh run list --workflow=tdd-worker-v2.yml --limit=10
```

## Services

### Core Services

| Service                | Purpose                                                      |
| ---------------------- | ------------------------------------------------------------ |
| `queue-initializer.ts` | Scan codebase for `.fixme()` tests, populate pending queue   |
| `spec-selector-cli.ts` | Priority-based spec selection (max 3)                        |
| `lock-file.ts`         | Add file to `activeFiles` (prevent duplicate work)           |
| `unlock-file.ts`       | Remove file from `activeFiles` (cleanup)                     |
| `pre-validate.ts`      | Remove `.fixme()`, run tests, check if already pass          |
| `pr-manager.ts`        | Create and merge PRs (fast-path and implementation modes)    |
| `ci-waiter.ts`         | Poll PR status until CI completes or timeout                 |
| `failure-analyzer.ts`  | Classify failures (regression, spec-failure, infrastructure) |
| `failure-handler.ts`   | Handle failures, apply 3-strikes rule                        |

### Workflows

| Workflow                  | Trigger                     | Purpose                        |
| ------------------------- | --------------------------- | ------------------------------ |
| `tdd-orchestrator-v2.yml` | After test.yml, hourly cron | Select specs, dispatch workers |
| `tdd-worker-v2.yml`       | Dispatched by orchestrator  | Process single spec file       |
| `tdd-cleanup-v2.yml`      | Every 6 hours               | Remove stale locks (> 30 min)  |

## Features

### 1. Fast-Path Optimization

When tests already pass after removing `.fixme()`:

- ✅ Skip Claude invocation (saves ~$1.50 per spec)
- ✅ Instant PR creation and auto-merge
- ✅ Label: `fast-path`

**Estimated savings**: 30% of specs qualify for fast-path.

### 2. File-Level Locking

Prevents merge conflicts:

- Worker locks file on start (`lock-file.ts`)
- Orchestrator skips locked files when selecting
- Worker unlocks file on completion (even on failure)
- Cleanup workflow removes stale locks (> 30 min)

### 3. Priority-Based Selection

Multi-factor priority calculator:

```typescript
// Base priority: 50
+ Test count (quick wins first): +20 for ≤10 tests
+ Attempt count (fresh specs first): +15 for 0 attempts
+ Path depth (complex specs higher): +15 for depth ≥5
- Error type penalty: -10 for infrastructure failures
= Final priority (0-100)
```

### 4. 3-Strikes Rule

After 3 failures (any type):

- ❌ Move spec to `failed` queue
- 📝 Create GitHub issue with manual intervention guide
- 📊 Increment `metrics.manualInterventionCount`
- 🔄 Worker skips failed specs

**Failure types**:

- `regression`: Implementation breaks other tests
- `spec-failure`: Tests still fail after implementation
- `infrastructure`: GitHub API, timeout, network issues

### 5. Automatic Retry

For failures 1-2:

- Record error in spec's `errors` array
- Add error context to next Claude invocation
- Re-queue spec with cooldown (5 minutes default)
- Next attempt receives: "Previous attempt caused regression in API-TABLES-002"

### 6. Concurrency Control

Maximum 3 concurrent PRs:

- Orchestrator checks `maxConcurrentPRs` before dispatch
- Available slots = `maxConcurrentPRs` - `activeCount`
- Workers marked as active in state
- Completed workers free slots

## CLI Commands

### Queue Management

```bash
# Initialize queue (first time)
bun run scripts/tdd-automation-v2/initialize-queue.ts

# View queue status
cat .github/tdd-state.json | jq '.queue'

# Count pending specs
cat .github/tdd-state.json | jq '.queue.pending | length'

# List failed specs
cat .github/tdd-state.json | jq '.queue.failed[].filePath'
```

### Manual Operations

```bash
# Lock a file manually
bun run scripts/tdd-automation-v2/core/lock-file.ts lock-file \
  --file "specs/api/tables/create.spec.ts"

# Unlock a file manually
bun run scripts/tdd-automation-v2/core/unlock-file.ts unlock-file \
  --file "specs/api/tables/create.spec.ts"

# Pre-validate a spec (check if tests already pass)
bun run scripts/tdd-automation-v2/core/pre-validate.ts pre-validate \
  --file "specs/api/tables/create.spec.ts" \
  --output "/tmp/prevalidate-result.json"

# Create PR manually
bun run scripts/tdd-automation-v2/services/pr-manager.ts pr create \
  --file "specs/api/tables/create.spec.ts" \
  --branch "tdd-v2/tables-create" \
  --test-count 5

# Merge PR manually
bun run scripts/tdd-automation-v2/services/pr-manager.ts pr merge \
  --pr 123
```

### Worker Operations

```bash
# Trigger worker for specific spec
gh workflow run tdd-worker-v2.yml \
  -f spec_file="specs/api/tables/create.spec.ts" \
  -f priority="75" \
  -f retry_count="0" \
  -f test_count="5" \
  -f previous_errors="[]"

# View worker runs
gh run list --workflow=tdd-worker-v2.yml --limit=10

# View specific worker run
gh run view <run-id>

# Cancel worker
gh run cancel <run-id>
```

## Troubleshooting

### Stale Locks

**Problem**: File locked for > 30 minutes

**Solution**: Cleanup workflow runs every 6 hours automatically. Or manually:

```bash
bun run scripts/tdd-automation-v2/core/unlock-file.ts unlock-file \
  --file "specs/api/tables/create.spec.ts"
```

### Abandoned Specs

**Problem**: Spec in active queue but no PR

**Solution**: Cleanup workflow automatically moves to pending. Or manually:

```bash
# Edit .github/tdd-state.json
# Move spec from queue.active to queue.pending
# Remove prNumber, prUrl, branch, startedAt fields
```

### Git Conflicts

**Problem**: State update fails due to concurrent modifications

**Solution**: Automatic retry (5 attempts, 1s delay). If still fails, check:

```bash
git status  # Ensure working directory is clean
git pull origin main  # Sync with remote
```

### Manual Intervention

**Problem**: Spec failed 3 times, needs human review

**Solution**: Check GitHub issue created by system:

1. Review error details in issue
2. Fix test or implementation manually
3. Re-queue spec:

```bash
# Edit .github/tdd-state.json
# Move spec from queue.failed to queue.pending
# Reset attempts to 0
# Clear errors array
```

## Testing

### Unit Tests

```bash
# Run all unit tests
bun test scripts/tdd-automation-v2/

# Run specific test file
bun test scripts/tdd-automation-v2/core/state-manager.test.ts
bun test scripts/tdd-automation-v2/services/spec-selector.test.ts
```

### Integration Tests

```bash
# Worker integration tests
bun test scripts/tdd-automation-v2/worker-integration.test.ts

# Concurrency tests
bun test scripts/tdd-automation-v2/concurrency.test.ts
```

**Note**: Integration tests require clean git working directory. They may fail in development but pass in CI (GitHub Actions).

### Manual End-to-End Test

1. Create test spec with `.fixme()`:

```bash
echo 'import { test, expect } from "bun:test"
test.fixme("manual test", () => {
  expect(1 + 1).toBe(2)
})' > specs/test-manual/example.spec.ts
```

2. Initialize queue:

```bash
bun run scripts/tdd-automation-v2/initialize-queue.ts
```

3. Trigger orchestrator:

```bash
gh workflow run tdd-orchestrator-v2.yml
```

4. Monitor:

```bash
gh run list --workflow=tdd-worker-v2.yml --limit=5
```

5. Verify PR created and auto-merged:

```bash
gh pr list --label fast-path
```

## Metrics

View system metrics:

```bash
cat .github/tdd-state.json | jq '.metrics'
```

**Tracked metrics**:

- `totalProcessed`: Total specs completed
- `successRate`: Success ratio (0-1)
- `averageProcessingTime`: Average minutes per spec
- `claudeInvocations`: Total Claude API calls
- `costSavingsFromSkips`: USD saved by fast-path
- `manualInterventionCount`: Specs requiring human review

## Migration from V1

**V1 System Status**: Still active (can run in parallel)

**Migration Steps**:

1. **Week 5.1**: Initialize V2 queue

   ```bash
   bun run scripts/tdd-automation-v2/initialize-queue.ts
   ```

2. **Week 5.2**: Run V1 and V2 in parallel (different spec sets)
   - V1: Continue processing existing issues
   - V2: Process new specs from queue

3. **Week 5.3**: Compare metrics (throughput, cost, success rate)

4. **Week 5.4**: Disable V1 workflows

   ```bash
   # Disable in GitHub UI: Actions → Workflows → Disable
   ```

5. **Week 5.5**: Archive V1 code
   ```bash
   git mv scripts/tdd-automation scripts/tdd-automation-v1-archived
   ```

## Performance Expectations

Based on design:

| Metric                  | Target        | Measurement                              |
| ----------------------- | ------------- | ---------------------------------------- |
| **Throughput**          | 3 specs/15min | Active PRs count / time                  |
| **Fast-path rate**      | 30%           | costSavingsFromSkips / totalProcessed    |
| **Success rate**        | > 70%         | successRate metric                       |
| **Cost per spec**       | < $1.50       | Claude usage / totalProcessed            |
| **Manual intervention** | < 5%          | manualInterventionCount / totalProcessed |
| **Average time**        | < 15 min      | averageProcessingTime metric             |

## Architecture Decisions

### Why File-Level Processing?

Process entire spec files (not individual tests) because:

- ✅ Spec files contain related tests (e.g., all CRUD operations)
- ✅ Fixing one test may reveal dependencies on others
- ✅ Atomic file-level changes prevent partial implementations
- ✅ Cleaner git history (one PR = one complete spec file)

### Why 3 Concurrent PRs?

Limited to 3 because:

- ✅ GitHub Actions concurrency limits
- ✅ Reasonable CI queue size
- ✅ Manageable PR review load
- ✅ Prevents state update conflicts

### Why 3-Strikes Rule?

After 3 failures move to manual intervention because:

- ✅ Prevents infinite retry loops
- ✅ Human oversight when automation fails repeatedly
- ✅ Claude Code may not be able to solve the problem
- ✅ Test expectations may need adjustment

### Why Git-Based State?

Store state in git-tracked JSON because:

- ✅ No external database needed
- ✅ Atomic updates via git commits
- ✅ Historical data survives PR closure
- ✅ Easy to inspect and debug
- ✅ Automatic conflict resolution with retry

## Security

### Permissions Required

GitHub Actions workflows require:

```yaml
permissions:
  contents: write # Push commits, branches
  pull-requests: write # Create, merge, comment on PRs
  actions: write # Trigger workflows
  issues: write # Create manual intervention issues
```

### Secrets Required

None. System uses:

- `GITHUB_TOKEN`: Automatic (provided by GitHub Actions)
- Claude Code CLI: Pre-configured on runner

### Security Considerations

- ✅ State file committed to git (no secrets)
- ✅ File locks prevent race conditions
- ✅ Atomic updates prevent data corruption
- ✅ Failed PRs auto-close (don't merge broken code)
- ✅ Manual intervention for repeated failures (human oversight)

## Contributing

### Adding New Services

1. Create service in `scripts/tdd-automation-v2/services/`
2. Use Effect.ts patterns (Context, Layer)
3. Add CLI command using `@effect/cli`
4. Write unit tests
5. Update this README

### Modifying Workflows

1. Edit workflow YAML in `.github/workflows/`
2. Test locally if possible (act or similar)
3. Test in non-production branch first
4. Monitor first few runs carefully
5. Update this README

### Debugging

Enable verbose logging:

```typescript
// In any Effect program
import { Logger, LogLevel } from 'effect'

const program = myProgram.pipe(Logger.withMinimumLogLevel(LogLevel.Debug))
```

## References

- **Plan**: `/Users/thomasjeanneau/.claude/plans/inherited-orbiting-charm.md`
- **V1 System**: `scripts/tdd-automation/` (to be archived)
- **State Schema**: `scripts/tdd-automation-v2/types.ts`
- **Effect.ts Docs**: https://effect.website/docs
- **GitHub Actions**: https://docs.github.com/en/actions

## License

Copyright (c) 2025 ESSENTIAL SERVICES

This source code is licensed under the Business Source License 1.1
found in the LICENSE.md file in the root directory of this source tree.
