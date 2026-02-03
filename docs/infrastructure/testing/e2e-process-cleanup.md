# E2E Test Process Cleanup

## Overview

This document explains the automated process cleanup system that prevents zombie Bun processes from accumulating during E2E test execution.

## Problem Statement

When running Playwright E2E tests with parallel execution, each test spawns a Bun process (`bun run src/cli.ts`) as the server. Previously, these processes could become zombies if:

- Tests crashed before fixture cleanup
- Test timeouts occurred
- Playwright workers terminated unexpectedly
- Parallel execution created race conditions in cleanup

This led to hundreds of zombie processes consuming 30GB+ RAM and causing system thrashing.

## Solution Architecture

### 1. **Improved `stopServer` Function** (`specs/fixtures.ts`)

**Features:**

- Race condition prevention with single-resolve promise
- Timeout properly cleared on early process exit
- Graceful SIGTERM followed by SIGKILL fallback (1 second timeout)
- Process tree cleanup (kills parent + all children)
- Global process registry for tracking

**Before:**

```typescript
async function stopServer(serverProcess: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    serverProcess.on('exit', () => resolve()) // ❌ Race condition
    serverProcess.kill('SIGTERM')
    setTimeout(() => {
      if (!serverProcess.killed) {
        serverProcess.kill('SIGKILL')
      }
      resolve() // ❌ Double resolve!
    }, 2000)
  })
}
```

**After:**

```typescript
async function stopServer(serverProcess: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    let resolved = false
    let timeoutId: NodeJS.Timeout | null = null

    const cleanup = () => {
      if (!resolved) {
        resolved = true
        if (timeoutId) clearTimeout(timeoutId)
        activeServerProcesses.delete(serverProcess)
        resolve()
      }
    }

    serverProcess.once('exit', cleanup)

    try {
      serverProcess.kill('SIGTERM')
    } catch (error) {
      cleanup()
      return
    }

    timeoutId = setTimeout(async () => {
      if (!resolved) {
        try {
          if (serverProcess.pid) {
            await killProcessTree(serverProcess.pid)
          }
          serverProcess.kill('SIGKILL')
        } catch (error) {
          // Process might already be dead
        }
        cleanup()
      }
    }, 1000)
  })
}
```

### 2. **Global Process Registry**

Tracks all spawned processes for emergency cleanup:

```typescript
const activeServerProcesses = new Set<ChildProcess>()

// Register on spawn
activeServerProcesses.add(serverProcess)

// Auto-remove on exit
serverProcess.once('exit', () => {
  activeServerProcesses.delete(serverProcess)
})
```

### 3. **Global Teardown** (`specs/global-teardown.ts`)

Runs after all tests complete, killing any remaining processes:

```typescript
export default async function globalTeardown() {
  console.log('🧹 Running global teardown...')

  // Count and kill remaining processes
  const count = execSync('ps aux | grep -c "bun.*src/cli.ts"', { encoding: 'utf-8' })

  if (count > 0) {
    console.log(`🧹 Killing ${count} remaining server processes...`)
    execSync('pkill -9 -f "bun.*src/cli.ts"', { stdio: 'ignore' })
  }

  console.log('✅ Global teardown complete')
}
```

**Why not use `activeServerProcesses` Set?**

- The Set is worker-local (each Playwright worker has its own process)
- Global teardown runs in the main process where the Set is empty
- Direct `pkill` command works across all processes

### 4. **Manual Cleanup Script** (`scripts/kill-zombie-processes.ts`)

Use when tests leave zombie processes:

```bash
bun run test:cleanup
```

**Features:**

- Counts zombie processes before cleanup
- Uses `pkill -9` for reliable killing
- Reports remaining processes after cleanup
- Cross-platform support (macOS, Linux, Windows)

## Usage

### Automatic Cleanup (Default)

Cleanup happens automatically:

1. **Per-test cleanup** (Playwright fixture): Each test's server process is killed after the test
2. **Global cleanup** (Global teardown): Any remaining processes are killed after all tests complete

```bash
bun test:e2e               # Cleanup happens automatically
bun test:e2e:spec          # Cleanup happens automatically
bun test:e2e:regression    # Cleanup happens automatically
```

### Manual Cleanup

If zombie processes accumulate (e.g., after Ctrl+C during tests):

```bash
# Kill all zombie Bun test processes
bun run test:cleanup

# Or use the full command
bun run scripts/kill-zombie-processes.ts
```

### Preventive Cleanup

Run cleanup before starting tests to ensure clean state:

```bash
bun run test:cleanup && bun test:e2e
```

## Monitoring

### Check for Zombie Processes

```bash
# Count zombie processes
ps aux | grep "bun.*src/cli.ts" | grep -v grep | wc -l

# View zombie processes
ps aux | grep "bun.*src/cli.ts" | grep -v grep

# Check memory usage by Bun
ps aux | awk '{sum[$11]+=$6} END {for (app in sum) printf "%s: %.0f MB\n", app, sum[app]/1024}' | grep bun
```

### Expected Process Count

- **During test execution**: 1-4 processes per worker (depending on `--workers` setting)
- **After test completion**: 0 processes
- **⚠️ Alert threshold**: > 20 processes (indicates cleanup failure)

## Performance Impact

### Before Optimization

- **Zombie processes**: 300+ after full test suite
- **Memory usage**: 33GB (Bun alone)
- **Swap usage**: 46GB / 47GB (98% full)
- **System state**: Thrashing, apps paused

### After Optimization

- **Zombie processes**: 0 after test suite
- **Memory usage**: ~500MB (Bun test execution)
- **Swap usage**: ~700MB / 2GB (35% used)
- **System state**: Normal operation

### Benchmark Results

Test: 7 parallel specs (`--workers=4`)

| Metric              | Before | After  |
| ------------------- | ------ | ------ |
| Zombie processes    | 8      | 0      |
| Memory per process  | ~50MB  | ~50MB  |
| Total leaked memory | 400MB  | 0MB    |
| Cleanup time        | N/A    | <100ms |

## Troubleshooting

### Issue: Zombie processes still accumulating

**Cause**: Global teardown not running (e.g., Ctrl+C during tests)

**Solution**:

```bash
bun run test:cleanup
```

### Issue: "Process might already be dead" warnings

**Cause**: Normal - race condition where process exits between check and kill

**Solution**: Ignore - these warnings are harmless

### Issue: Processes not dying with SIGTERM

**Cause**: Bun process hung or stuck

**Solution**: Automatic - `stopServer` uses SIGKILL fallback after 1 second

### Issue: Child processes remain after parent killed

**Cause**: Process tree not cleaned up

**Solution**: Automatic - `killProcessTree` kills entire process group

## Architecture Decisions

### Why 1-second timeout instead of 2 seconds?

**Reason**: Bun processes typically respond to SIGTERM within 100-200ms. 1 second is sufficient buffer while minimizing wait time.

### Why kill process tree instead of just parent?

**Reason**: Bun might spawn child processes (e.g., TypeScript compiler, esbuild). Killing only parent leaves orphaned children.

### Why use `pkill -9` in global teardown instead of graceful shutdown?

**Reason**: Global teardown runs after all tests complete. Any remaining processes are definitely zombies and should be force-killed immediately.

### Why not use `process.on('exit')` for cleanup?

**Reason**: Doesn't work reliably with Playwright workers. Global teardown is the correct Playwright API for post-test cleanup.

## Related Documentation

- **Playwright Configuration**: `playwright.config.ts`
- **Test Fixtures**: `specs/fixtures.ts`
- **Global Setup**: `specs/global-setup.ts`
- **Global Teardown**: `specs/global-teardown.ts`
- **Cleanup Script**: `scripts/kill-zombie-processes.ts`

## Future Improvements

Potential enhancements:

1. **Process tracking metrics**: Log process spawn/kill events for debugging
2. **Timeout configuration**: Make SIGKILL timeout configurable per-test
3. **Health check before kill**: Verify process is actually zombie before killing
4. **Resource usage alerts**: Warn if memory/CPU usage exceeds thresholds
5. **Automatic cleanup on test failure**: Kill processes immediately when test fails

## Contributing

When modifying process lifecycle code:

1. **Test with parallel execution**: Use `--workers=4` or higher
2. **Test with intentional failures**: Ensure cleanup works when tests crash
3. **Monitor process count**: Check `ps aux | grep bun` before and after
4. **Verify memory cleanup**: Use Activity Monitor to confirm processes are gone
5. **Test global teardown**: Run full suite and verify zero processes remain

## License

Copyright (c) 2025 ESSENTIAL SERVICES

This source code is licensed under the Business Source License 1.1
found in the LICENSE.md file in the root directory of this source tree.
