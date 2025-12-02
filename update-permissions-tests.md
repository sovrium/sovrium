# Updates Needed for Permission Tests

## Summary

Update all test files in `specs/app/tables/permissions/` to use `createAuthenticatedUser()` fixture instead of arbitrary user IDs (1, 2, 3, etc.).

## Files to Update

### 1. field-permissions.spec.ts

- ✅ TEST-005: Updated to use createAuthenticatedUser
- ✅ TEST-007: Updated to use createAuthenticatedUser

### 2. permissions.spec.ts

Lines with arbitrary user IDs:

- Line 60: INSERT INTO admin_data - owner_id = 1
- Line 221: INSERT INTO tasks - owner_id = 1, 2
- Lines 234, 240, 246: SET LOCAL app.user_id = 1
- Line 362: INSERT INTO posts - author_id = 1, 1, 2
- Lines 380, 387: SET LOCAL app.user_id = 1
- Line 452: INSERT INTO documents - author_id = 1, 2
- Line 466: SET LOCAL app.user_id = 3

### 3. record-permissions.spec.ts

Lines with arbitrary user IDs:

- Line 63: INSERT INTO documents - created_by = 1, 2, 1
- Lines 78, 85, 92: SET LOCAL app.user_id = 1, 2, 1
- Line 135: INSERT INTO tasks - assigned_to = 1, 2
- Lines 150, 157, 164: SET LOCAL app.user_id = 1, 1, 2
- Line 207: INSERT INTO articles - created_by = 1, 1, 2
- Lines 222, 229, 236: SET LOCAL app.user_id = 1, 1, 1
- Line 284: INSERT INTO projects - owner_id = 1, 1, 2
- Line 429: INSERT INTO tickets - created_by = 1, 2, 1, 3, assigned_to = 2, 1, 1, 3
- Lines 446, 453, 464: SET LOCAL app.user_id = 1, 1, 2
- Line 521: INSERT INTO items - owner_id = 1, 2
- Lines 528, 535, 542, 549: SET LOCAL app.user_id = 1, 1, 1, 1

### 4. rls-enforcement.spec.ts

Lines with arbitrary user IDs:

- Multiple INSERT statements with owner_id, user_id, created_by, author_id fields

### 5. table-permissions.spec.ts

Lines with arbitrary user IDs:

- Multiple INSERT statements with created_by, owner_id fields

### 6. organization-isolation.spec.ts

- ✅ Already using createAuthenticatedUser properly!

## Pattern for Updates

Before:

```typescript
await executeQuery(["INSERT INTO tasks (title, owner_id) VALUES ('Task 1', 1), ('Task 2', 2)"])
```

After:

```typescript
const user1 = await createAuthenticatedUser({ email: 'user1@example.com' })
const user2 = await createAuthenticatedUser({ email: 'user2@example.com' })

await executeQuery([
  `INSERT INTO tasks (title, owner_id) VALUES ('Task 1', '${user1.user.id}'), ('Task 2', '${user2.user.id}')`,
])
```

Before:

```typescript
await executeQuery('SET LOCAL app.user_id = 1; ...')
```

After:

```typescript
await executeQuery(`SET LOCAL app.user_id = '${user1.user.id}'; ...`)
```
