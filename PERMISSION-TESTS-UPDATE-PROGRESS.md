# Permission Tests Update - Progress Tracker

## Objective
Update all tests in `specs/app/tables/permissions/` to use `createAuthenticatedUser()` fixture for user-reference fields instead of arbitrary numeric IDs.

## Why This Matters
- User IDs in the auth system are UUIDs, not integers
- Foreign key constraints require valid user records to exist
- Tests failing with "violates foreign key constraint" when using arbitrary IDs (1, 2, 3)

## Pattern

**Before:**
```typescript
await executeQuery([
  "INSERT INTO tasks (title, owner_id) VALUES ('Task 1', 1)",
])
await executeQuery("SET LOCAL app.user_id = 1; SELECT * FROM tasks")
```

**After:**
```typescript
const user = await createAuthenticatedUser({ email: 'user@example.com' })

await executeQuery([
  `INSERT INTO tasks (title, owner_id) VALUES ('Task 1', '${user.user.id}')`,
])
await executeQuery(`SET LOCAL app.user_id = '${user.user.id}'; SELECT * FROM tasks`)
```

## Progress Status

### ✅ COMPLETED

#### 1. field-permissions.spec.ts
- [x] TEST-005: Updated `owner_id` field with user1, user2
- [x] TEST-007: Updated `owner_id` field in regression test

#### 2. record-permissions.spec.ts
- [x] TEST-001: Updated `created_by` field with user1, user2
- [x] TEST-002: Updated `assigned_to` field with user1, user2

#### 3. organization-isolation.spec.ts
- [x] Already using `createAuthenticatedUser` properly (no changes needed)

---

### 🔄 IN PROGRESS / TODO

#### 4. record-permissions.spec.ts (Remaining)
- [ ] TEST-003: `created_by` field - DELETE permissions
- [ ] TEST-004: `owner_id`, `department` fields - Multiple AND conditions
- [ ] TEST-005: `department` field - Custom user property
- [ ] TEST-006: `created_by`, `assigned_to` fields - OR condition
- [ ] TEST-007 (regression): `owner_id`, `status` fields

#### 5. permissions.spec.ts
- [ ] TEST-001: `owner_id` field - Admin-only table
- [ ] TEST-003: `owner_id`, `notes` field - Hierarchical permissions
- [ ] TEST-005: `author_id`, `draft` field - Complex filtering
- [ ] TEST-006 (regression): `author_id`, `status`, `salary_info` fields

#### 6. rls-enforcement.spec.ts
- [ ] TEST-001: `owner_id` field - Owner-based filtering
- [ ] TEST-002: `user_id` field - Cross-organization access prevention
- [ ] TEST-003-004: Field-level restrictions (no user fields, schema validation only)
- [ ] TEST-005: `created_by` field - INSERT operations
- [ ] TEST-006: `owner_id` field - UPDATE operations
- [ ] TEST-007: `author_id` field - DELETE operations
- [ ] TEST-008: Role-based permissions (no user fields, role validation)
- [ ] TEST-009 (regression): `user_id` field

#### 7. table-permissions.spec.ts
- [ ] TEST-001: `created_by` field - Role-based read
- [ ] TEST-006 (regression): `owner_id` field

---

## Files Already Committed

These files have already been updated and committed to git:
1. `field-permissions.spec.ts` - Fully updated
2. `organization-isolation.spec.ts` - Already correct

## Next Steps

1. **Complete record-permissions.spec.ts** - 5 remaining tests
2. **Update permissions.spec.ts** - 4 tests
3. **Update rls-enforcement.spec.ts** - 8 tests
4. **Update table-permissions.spec.ts** - 2 tests

**Total Remaining**: 19 tests across 4 files

## Testing Strategy

After all updates:
1. Run `bun run license` to ensure copyright headers
2. Run `bun run lint:fix` to fix formatting
3. Run `bun test:e2e:spec -- specs/app/tables/permissions/` to verify tests
4. Check for any failures related to foreign key constraints

## Notes

- User IDs are UUIDs (string format), not integers
- Must use template literals for string interpolation: `` `${user.user.id}` ``
- Quote user IDs in SQL: `'${user.user.id}'`
- Multiple users needed per test: create them all before INSERT statements
- Session variables: `SET LOCAL app.user_id = '${user.user.id}'`

---

*Last Updated: 2025-12-02*
*Status: 6 tests completed, 19 tests remaining*
