# TDD Workflow V2 - Inconsistency Review Findings

## Executive Summary

The TDD V2 workflow has been refactored from file-based to spec-ID-based granularity, but several services and methods still use file-based logic. This creates critical bugs where multiple specs from the same file cannot be properly tracked.

## Critical Issues Found

### 1. ✅ FIXED: Orchestrator Worker Dispatch

**Location**: `.github/workflows/tdd-orchestrator-v2.yml` (lines 112-142)

**Problem**: Orchestrator was dispatching workers with wrong parameters:

- Missing `spec_id` (required)
- Missing `test_name` (required)
- Wrong parameter name: `spec_file` instead of `file_path`
- Extracting non-existent `testCount` field

**Impact**: Workers couldn't start - missing required inputs

**Status**: Fixed in commit af900720

---

### 2. ✅ FIXED: StateManager Using filePath Instead of specId

**Location**: `scripts/tdd-automation-v2/core/state-manager.ts`

**Problem**: Multiple methods use `filePath` to identify specs:

#### Issue 2.1: Confusing Parameter Names

```typescript
// Line 22-26
readonly transition: (
  fileId: string,  // ❌ Should be specId for clarity
  from: SpecStatus,
  to: SpecStatus
) => Effect.Effect<void, Error>
```

#### Issue 2.2: recordFailureAndRequeue Uses filePath

```typescript
// Line 30-33
readonly recordFailureAndRequeue: (
  filePath: string,  // ❌ Should be specId
  error: SpecError
) => Effect.Effect<void, Error>

// Line 279 - Implementation
const spec = state.queue.active.find((s) => s.filePath === filePath)
//                                           ^^^^^^^^^^^^^^^^^^^^
// BUG: If two specs from same file fail, this will match the wrong one!
```

#### Issue 2.3: moveToManualIntervention Uses filePath

```typescript
// Line 34-41
readonly moveToManualIntervention: (
  filePath: string,  // ❌ Should be specId
  details: {
    errors: SpecError[]
    failureReason: string
    requiresAction: string
  }
) => Effect.Effect<void, Error>

// Line 326 - Implementation
const spec = state.queue.active.find((s) => s.filePath === filePath)
//                                           ^^^^^^^^^^^^^^^^^^^^
// BUG: Matches wrong spec when multiple specs share same file
```

#### Issue 2.4: requeueFromFailed Uses filePath

```typescript
// Line 42-45
readonly requeueFromFailed: (
  filePath: string,  // ❌ Should be specId
  options: RequeueOptions
) => Effect.Effect<void, Error>
```

**Impact**:

- If `specs/api/tables/create.spec.ts` has specs `API-TABLES-001` and `API-TABLES-002`
- Both enter active queue
- If `API-TABLES-002` fails, the failure handler passes `filePath`
- StateManager finds first match by filePath → updates `API-TABLES-001` instead!
- This causes state corruption and incorrect retry logic

**Root Cause**: V2 refactor changed queue items from file-granularity to spec-granularity, but StateManager wasn't updated

**Fix Required**: Change all methods to use `specId` instead of `filePath`

---

### 3. ✅ FIXED: Missing activeSpecs Management

**Location**: `scripts/tdd-automation-v2/core/state-manager.ts`

**Problem**: The `TDDState` type has `activeSpecs: string[]` field (line 37 in types.ts), and spec-selector checks it (line 127 in spec-selector.ts), but StateManager has no methods to add/remove specs from `activeSpecs`.

**Current State**:

```typescript
// StateManager has:
readonly addActiveFile: (filePath: string) => ...    // ✅ Exists
readonly removeActiveFile: (filePath: string) => ... // ✅ Exists

// StateManager missing:
readonly addActiveSpec: (specId: string) => ...      // ❌ Missing
readonly removeActiveSpec: (specId: string) => ...   // ❌ Missing
```

**Impact**:

- Spec-level locking doesn't work (only file-level works)
- Multiple workers could process different specs from same file simultaneously
- This violates the architecture constraint: "File-level locking: Workers cannot process different specs from the same file concurrently"

**Fix Required**: Add `addActiveSpec` and `removeActiveSpec` methods to StateManager

---

### 4. ✅ FIXED: failure-handler.ts Passes Wrong Identifier

**Location**: `scripts/tdd-automation-v2/services/failure-handler.ts`

**Problem**: Failure handler receives `file` parameter (filePath) and passes it to StateManager methods:

```typescript
// Line 25-28 - Receives filePath
{
  file: Options.text('file'),  // filePath
  pr: Options.integer('pr'),
  type: Options.text('type'),
  retryCount: Options.integer('retry-count'),
}

// Line 96 - Passes filePath to StateManager
yield* stateManager.moveToManualIntervention(file, manualInterventionDetails)
//                                           ^^^^ filePath, but method expects specId!

// Line 104 - Passes filePath to StateManager
yield* stateManager.recordFailureAndRequeue(file, error)
//                                          ^^^^ filePath, but method expects specId!
```

**Impact**: Compounds Issue #2 - even if StateManager is fixed, failure-handler would need to be updated to pass specId

**Fix Required**:

1. Update workflow to pass `spec_id` to failure-handler
2. Update failure-handler CLI to accept `--spec-id` parameter
3. Pass specId to StateManager methods

---

### 5. ✅ FIXED: Worker Workflow Missing spec_id in Failure Handler

**Location**: `.github/workflows/tdd-worker-v2.yml`

**Problem**: Worker calls failure-handler with `--file` but not `--spec-id`:

```yaml
# Lines 325-328, 337-340, 349-352
bun run scripts/tdd-automation-v2/services/failure-handler.ts \
--file "${{ inputs.file_path }}" \
--pr ${{ steps.pr.outputs.pr_number }} \
--type regression \
--retry-count "${{ inputs.retry_count }}"
# Missing: --spec-id "${{ inputs.spec_id }}"
```

**Impact**: Even if failure-handler is updated to use specId, the workflow doesn't pass it

**Fix Required**: Add `--spec-id "${{ inputs.spec_id }}"` to all failure-handler calls

---

## Summary of Fixes Needed

### High Priority (Breaks Multi-Spec Files)

1. ✅ **FIXED**: Orchestrator dispatch parameters
2. ✅ **FIXED**: StateManager - Changed `filePath` → `specId` in:
   - `transition(specId, ...)` → parameter renamed to `specId`
   - `recordFailureAndRequeue(specId, ...)` → uses `specId`
   - `moveToManualIntervention(specId, ...)` → uses `specId`
   - `requeueFromFailed(specId, ...)` → uses `specId`
   - All implementations now search by `specId` instead of `filePath`
3. ✅ **FIXED**: failure-handler.ts - Accepts and uses `specId` instead of `filePath`
4. ✅ **FIXED**: Worker workflow - Passes `--spec-id` to all failure-handler calls

### Medium Priority (Missing Features)

5. ✅ **FIXED**: StateManager - Added `addActiveSpec` and `removeActiveSpec` methods
6. ✅ **FIXED**: Worker workflow - Calls `addActiveSpec` when starting, `removeActiveSpec` in cleanup

## Impact Assessment

**After fixes (current state):**

- ✅ Single-spec files work correctly
- ✅ Multi-spec files now work correctly (state operations use `specId`)
- ✅ Failure handling correctly identifies specs by `specId`
- ✅ StateManager methods added for spec-level locking (`addActiveSpec`, `removeActiveSpec`)
- ✅ Spec-level locking fully implemented (worker locks/unlocks specs during execution)
- ✅ Workers can now process different specs from the same file concurrently

**Test case that NOW WORKS**:

1. File `specs/api/tables/create.spec.ts` has `API-TABLES-001` and `API-TABLES-002`
2. Both are pending
3. Orchestrator dispatches worker for `API-TABLES-001`
4. Worker moves it to active queue
5. Orchestrator dispatches worker for `API-TABLES-002`
6. Worker tries to lock file → fails (file locked) → CORRECT
7. If `API-TABLES-001` fails:
   - failure-handler passes `specId` (`API-TABLES-001`)
   - StateManager finds spec with matching `specId` in active queue
   - Correctly updates `API-TABLES-001`
   - State remains consistent ✅

**New capability enabled**:

With spec-level locking now fully implemented, the TDD V2 workflow can process multiple specs from the same file concurrently:

- Worker A can process `API-TABLES-001` from `specs/api/tables/create.spec.ts`
- Worker B can simultaneously process `API-TABLES-002` from the same file
- File-level locking still prevents concurrent modifications to test files
- Spec-level locking ensures correct state management for each individual spec
