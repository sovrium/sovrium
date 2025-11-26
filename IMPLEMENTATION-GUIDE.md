# Implementation Guide - Test Scenario Execution

**Generated**: 2025-11-26
**Purpose**: Actionable guide for implementing P0-P2 test scenarios
**Target**: 0% → 95% test coverage over 24 weeks

---

## Quick Start

### Immediate Actions (This Week)

1. **Review the comprehensive analysis**
   - Read `/TEST-SCENARIOS-P0-CRITICAL.md` (critical foundation gaps)
   - Understand the priority roadmap
   - Familiarize with test scenario structure

2. **Set up development environment**

   ```bash
   # Ensure dependencies installed
   bun install

   # Verify tests run
   bun test:unit
   bun test:e2e:spec
   ```

3. **Pick your first test from P0**
   - Start with `MIG-MODIFY-TYPE-001` (simplest)
   - Remove `.fixme()` marker
   - Implement the test scenario
   - Verify it passes

---

## Document Structure

### Test Scenario Documents

| Document                             | Priority      | Tests        | Effort       | Coverage Gain |
| ------------------------------------ | ------------- | ------------ | ------------ | ------------- |
| **TEST-SCENARIOS-P0-CRITICAL.md**    | P0 - Critical | 19 tests     | 6 weeks      | 0% → 40%      |
| **TEST-SCENARIOS-P1-HIGH-IMPACT.md** | P1 - High     | 21 tests     | 9 weeks      | 40% → 75%     |
| **TEST-SCENARIOS-P2-ADVANCED.md**    | P2 - Medium   | 20 tests     | 9 weeks      | 75% → 95%     |
| **Total**                            | -             | **60 tests** | **24 weeks** | **0% → 95%**  |

### How to Use These Documents

Each document contains:

1. **Test Scenarios** - Complete, copy-paste-ready test code
2. **Implementation Details** - Given/When/Then structure
3. **Expected Assertions** - Specific validation criteria
4. **File Locations** - Where to create/update test files
5. **Dependencies** - What must be implemented first

---

## Implementation Workflow

### Phase 0: Setup (1 day)

```bash
# 1. Create feature branch
git checkout -b implement-p0-field-type-migrations

# 2. Review current test status
bun test:e2e:spec 2>&1 | grep "\.fixme"

# 3. Count fixme tests
grep -r "\.fixme" specs/ | wc -l
```

### Phase 1: P0 Implementation (6 weeks)

**Goal**: Achieve 40% test coverage by implementing critical foundation

#### Week 1-2: Field Type Migrations

**Focus**: `specs/migrations/schema-evolution/modify-field-type.spec.ts`

```bash
# 1. Open the spec file
code specs/migrations/schema-evolution/modify-field-type.spec.ts

# 2. For each test (MIG-MODIFY-TYPE-001 through MIG-MODIFY-TYPE-006):
#    a. Remove .fixme() marker
#    b. Copy test code from TEST-SCENARIOS-P0-CRITICAL.md
#    c. Replace stub with real implementation
#    d. Run test: bun test:e2e:spec modify-field-type
#    e. Fix any failures
#    f. Commit: git commit -m "fix: implement MIG-MODIFY-TYPE-001"

# 3. After all 6 tests pass:
bun run license  # Add copyright headers
bun run lint && bun run typecheck
git push
```

**Deliverables**:

- [ ] 6 type modification tests passing
- [ ] Type conversion matrix test passing
- [ ] Documentation updated

#### Week 3-4: Relationship Cascade

**Focus**: Create `specs/app/tables/field-types/relationship-field/cascade-delete.spec.ts` (NEW)

```bash
# 1. Create new spec file
mkdir -p specs/app/tables/field-types/relationship-field
touch specs/app/tables/field-types/relationship-field/cascade-delete.spec.ts

# 2. Copy test scenarios from TEST-SCENARIOS-P0-CRITICAL.md
#    - APP-REL-CASCADE-001 through APP-REL-CASCADE-005

# 3. Create co-located schema
touch specs/app/tables/field-types/relationship-field/cascade-delete.schema.json

# 4. Run tests
bun test:e2e:spec cascade-delete

# 5. Commit when passing
git add -A
bun run license
git commit -m "fix: implement relationship cascade specs (P0.2)"
git push
```

**Deliverables**:

- [ ] 5 cascade behavior tests passing
- [ ] CASCADE, SET NULL, RESTRICT tested
- [ ] Circular dependency detection working
- [ ] Orphan record handling implemented

#### Week 5: View API Endpoints

**Focus**: Create `specs/api/paths/tables/{tableId}/views/{viewId}/records/get.spec.ts` (NEW)

```bash
# 1. Create directory structure
mkdir -p specs/api/paths/tables/{tableId}/views/{viewId}/records

# 2. Create spec file
touch specs/api/paths/tables/{tableId}/views/{viewId}/records/get.spec.ts

# 3. Copy 4 test scenarios from TEST-SCENARIOS-P0-CRITICAL.md
#    - API-VIEW-RECORDS-001 through API-VIEW-RECORDS-004

# 4. Implement view filtering, sorting, field visibility

# 5. Run tests
bun test:e2e:spec view.*records

# 6. Commit
git add -A
bun run license
git commit -m "fix: implement view API endpoints (P0.3)"
git push
```

**Deliverables**:

- [ ] View filter application working
- [ ] View sort application working
- [ ] Field visibility enforcement working
- [ ] View permission checks working

#### Week 6: Migration Transactions

**Focus**: Create `specs/migrations/migration-system/transactions.spec.ts` (NEW)

```bash
# 1. Create spec file
mkdir -p specs/migrations/migration-system
touch specs/migrations/migration-system/transactions.spec.ts

# 2. Copy 3 test scenarios from TEST-SCENARIOS-P0-CRITICAL.md
#    - MIG-TRANSACTION-001 through MIG-TRANSACTION-003

# 3. Implement transaction rollback logic

# 4. Run tests
bun test:e2e:spec transactions

# 5. Commit
git add -A
bun run license
git commit -m "fix: implement migration transactions (P0.4)"
git push
```

**Deliverables**:

- [ ] Multi-step atomicity working
- [ ] Point-in-time recovery working
- [ ] Savepoint rollback working

---

### Phase 2: P1 Implementation (9 weeks)

**Goal**: Achieve 75% test coverage by completing high-impact features

#### Week 7-8: Computed Field Validation

**Files**:

- `specs/app/tables/field-types/formula-field/advanced-formulas.spec.ts` (NEW)
- `specs/app/tables/field-types/rollup-field/aggregations.spec.ts` (NEW)
- `specs/app/tables/field-types/lookup-field/traversal.spec.ts` (NEW)

**Process**:

```bash
# 1. Create all 3 spec files
mkdir -p specs/app/tables/field-types/{formula-field,rollup-field,lookup-field}

# 2. Copy test scenarios from TEST-SCENARIOS-P1-HIGH-IMPACT.md
#    Formula: APP-FORMULA-ADV-001 through APP-FORMULA-ADV-005
#    Rollup: APP-ROLLUP-AGG-001 through APP-ROLLUP-AGG-003
#    Lookup: APP-LOOKUP-TRAV-001 through APP-LOOKUP-TRAV-002

# 3. Implement computed field evaluation logic

# 4. Run tests
bun test:e2e:spec formula
bun test:e2e:spec rollup
bun test:e2e:spec lookup

# 5. Commit each group separately
git commit -m "fix: implement formula field validation (P1.1)"
git commit -m "fix: implement rollup field aggregations (P1.1)"
git commit -m "fix: implement lookup field traversal (P1.1)"
```

**Deliverables**:

- [ ] Formula syntax validation working
- [ ] Circular dependency detection working
- [ ] Cross-table formulas working
- [ ] Rollup aggregations (SUM, COUNT, AVG) working
- [ ] Multi-level lookup working

#### Week 9-10: API Pagination, Sorting, Filtering

**File**: `specs/api/paths/tables/{tableId}/records/query-params.spec.ts` (NEW)

```bash
# 1. Create spec file
touch specs/api/paths/tables/{tableId}/records/query-params.spec.ts

# 2. Copy 3 test scenarios from TEST-SCENARIOS-P1-HIGH-IMPACT.md
#    - API-QUERY-PAGE-001, API-QUERY-SORT-001, API-QUERY-FILTER-001

# 3. Implement query parameter handling

# 4. Run tests
bun test:e2e:spec query-params

# 5. Commit
git commit -m "fix: implement API pagination, sorting, filtering (P1.2)"
```

**Deliverables**:

- [ ] Cursor-based pagination working
- [ ] Multi-field sorting working
- [ ] Complex AND/OR filtering working

#### Week 11: Permission Inheritance

**File**: `specs/app/tables/permissions/inheritance.spec.ts` (NEW)

```bash
# Similar process as above
```

#### Week 12-13: File Upload Validation

**File**: `specs/app/tables/field-types/single-attachment-field/upload-validation.spec.ts` (NEW)

#### Week 14-15: Constraint Migrations

**File**: `specs/migrations/schema-evolution/constraint-migrations.spec.ts` (NEW)

---

### Phase 3: P2 Implementation (9 weeks)

**Goal**: Achieve 95% test coverage with advanced features

#### Weeks 16-17: Internationalization

#### Weeks 18-19: Data Import/Export

#### Weeks 20-21: API Versioning + Caching

#### Weeks 22-23: Full-Text Search

#### Weeks 24-25: Webhooks & Real-Time

---

## Troubleshooting Guide

### Common Issues

#### Issue 1: Test Fixture Setup Fails

**Symptoms**:

```
Error: startServerWithSchema timed out
```

**Solutions**:

```bash
# 1. Check Docker containers
docker ps

# 2. Restart database
docker-compose down
docker-compose up -d

# 3. Check database connection
psql -h localhost -U postgres -d sovrium_test

# 4. Verify schema migrations
bun run db:check
```

#### Issue 2: Type Conversion Tests Fail

**Symptoms**:

```
Error: cannot cast type character varying to integer
```

**Solutions**:

- Check that `_migration.strategy` is set correctly
- Verify pre-validation logic runs before ALTER TABLE
- Add USING clause for unsafe conversions

#### Issue 3: Relationship Cascade Not Working

**Symptoms**:

```
Error: foreign key constraint violated
```

**Solutions**:

- Verify ON DELETE clause in schema
- Check foreign key constraint exists: `\d+ table_name`
- Ensure relationship field config has `onDelete` property

---

## Performance Benchmarks

### Target Performance

| Operation                        | Target  | Current | Gap |
| -------------------------------- | ------- | ------- | --- |
| Formula evaluation (10k records) | < 2s    | TBD     | N/A |
| Full-text search (100k records)  | < 100ms | TBD     | N/A |
| View filtering (1M records)      | < 200ms | TBD     | N/A |
| Type conversion (100k rows)      | < 5s    | TBD     | N/A |

### Measuring Performance

```typescript
// Add to performance-critical tests
const startTime = performance.now()
// ... operation ...
const endTime = performance.now()

expect(endTime - startTime).toBeLessThan(targetMs)
```

---

## Code Quality Checklist

### Before Each Commit

```bash
# 1. Format code
bun run format

# 2. Lint
bun run lint

# 3. Type check
bun run typecheck

# 4. Add copyright headers
bun run license

# 5. Run affected tests
bun test:e2e:spec <test-name>

# 6. Stage changes
git add -A

# 7. Commit with conventional message
git commit -m "fix: implement <SPEC-ID>"
```

### Before Push

```bash
# 1. Run all E2E regression tests
bun test:e2e:regression

# 2. Run unit tests
bun test:unit

# 3. Verify quality
bun run quality

# 4. Push
git push
```

---

## Progress Tracking

### Weekly Progress Report Template

```markdown
# Week X Progress Report

**Goal**: [e.g., Implement field type migrations]
**Status**: [On Track / At Risk / Blocked]

## Completed This Week

- [ ] MIG-MODIFY-TYPE-001: VARCHAR to TEXT conversion
- [ ] MIG-MODIFY-TYPE-002: INTEGER to NUMERIC conversion
- ...

## Test Coverage

- **Before**: X%
- **After**: Y%
- **Change**: +Z%

## Blockers

- [Any blockers encountered]

## Next Week Plan

- [ ] Start relationship cascade specs
- [ ] Complete remaining type conversions
```

### Overall Progress Dashboard

Track in `TDD-PROGRESS.md` (auto-generated):

```bash
bun run scripts/tdd-automation/track-progress.ts
```

---

## Best Practices

### 1. Test Independence

```typescript
// ✅ Good - Each test creates its own schema
test('APP-FIELD-001', async ({ startServerWithSchema }) => {
  await startServerWithSchema({
    name: 'test-app',
    tables: [
      /* ... */
    ],
  })

  // Test logic
})

// ❌ Bad - Tests share state
let sharedSchema
beforeAll(async () => {
  sharedSchema = await startServerWithSchema(/* ... */)
})
```

### 2. Clear Assertions

```typescript
// ✅ Good - Specific assertions
expect(columnInfo.data_type).toBe('text')
expect(columnInfo.character_maximum_length).toBeNull()

// ❌ Bad - Generic assertions
expect(columnInfo).toBeDefined()
```

### 3. Error Message Testing

```typescript
// ✅ Good - Test specific error messages
await expect(executeQuery(/* ... */)).rejects.toThrow(
  /duplicate key value violates unique constraint/
)

// ❌ Bad - Test any error
await expect(executeQuery(/* ... */)).rejects.toThrow()
```

### 4. Test Data Uniqueness

```typescript
// ✅ Good - Unique test data
const testEmail = `test-${Date.now()}@example.com`

// ❌ Bad - Hardcoded data (potential conflicts)
const testEmail = 'test@example.com'
```

---

## Getting Help

### Resources

1. **Test Scenario Documents**
   - `/TEST-SCENARIOS-P0-CRITICAL.md`
   - `/TEST-SCENARIOS-P1-HIGH-IMPACT.md`
   - `/TEST-SCENARIOS-P2-ADVANCED.md`

2. **Product Specs Analysis**
   - Full detailed report available from product-specs-architect agent

3. **Architecture Documentation**
   - `@docs/architecture/layer-based-architecture.md`
   - `@docs/infrastructure/testing/playwright.md`
   - `@docs/development/tdd-automation-pipeline.md`

### Common Questions

**Q: Should I implement all P0 tests before moving to P1?**
A: Yes. P0 tests are critical foundation and block P1/P2 work.

**Q: Can I modify existing test scenarios?**
A: Yes, but keep the spec ID and core behavior. Improvements welcome.

**Q: What if a test scenario doesn't match current architecture?**
A: Update the scenario and document changes in commit message.

**Q: How do I handle test failures in CI?**
A: Check GitHub Actions logs, reproduce locally, fix, and push.

---

## Success Metrics

### Phase Completion Criteria

**P0 Complete (Week 6)**:

- [ ] All 19 P0 tests passing
- [ ] 40% overall test coverage
- [ ] Field type migrations working
- [ ] Relationship cascades working
- [ ] View API endpoints functional
- [ ] Migration transactions atomic

**P1 Complete (Week 15)**:

- [ ] All 21 P1 tests passing
- [ ] 75% overall test coverage
- [ ] Computed fields working
- [ ] API pagination/sorting/filtering working
- [ ] Permission inheritance working
- [ ] File upload validation working
- [ ] Constraint migrations working

**P2 Complete (Week 24)**:

- [ ] All 20 P2 tests passing
- [ ] 95% overall test coverage
- [ ] Internationalization working
- [ ] Import/export working
- [ ] API caching working
- [ ] Full-text search working
- [ ] Webhooks/real-time working

---

## Next Steps

### Start Now

1. **Read P0 scenarios**: Open `TEST-SCENARIOS-P0-CRITICAL.md`
2. **Pick first test**: `MIG-MODIFY-TYPE-001`
3. **Create branch**: `git checkout -b implement-field-type-migrations`
4. **Remove `.fixme()`**: Edit the spec file
5. **Copy test code**: From P0 document
6. **Run test**: `bun test:e2e:spec modify-field-type`
7. **Fix failures**: Implement missing functionality
8. **Commit**: `git commit -m "fix: implement MIG-MODIFY-TYPE-001"`
9. **Repeat**: For remaining P0 tests

### Weekly Cadence

- **Monday**: Review week's goals, pick tests
- **Tuesday-Thursday**: Implement tests, fix failures
- **Friday**: Review progress, commit all changes, update tracking
- **Weekend**: Optional - prep next week's tests

---

**Good luck! You're on your way to 95% test coverage.**

🎯 **Current Progress**: 0% → Target: 95%
📅 **Timeline**: 24 weeks (6 months)
🚀 **Start Date**: [Fill in when you begin]
✅ **Completion Date**: [Fill in when P2 complete]
