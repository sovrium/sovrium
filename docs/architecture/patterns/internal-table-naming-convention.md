# Internal Table Naming Convention

> **Purpose**: Document the `_sovrium_` prefix convention for internal system tables to prevent namespace conflicts with user-created tables.
>
> **Status**: ✅ Active - Convention established and implemented across all internal tables
>
> **Last Updated**: 2025-12-16

## Table of Contents

- [Overview](#overview)
- [Why This Pattern](#why-this-pattern)
- [Implementation](#implementation)
- [Enforcement](#enforcement)
- [Best Practices](#best-practices)
- [Common Pitfalls](#common-pitfalls)
- [Migration Guide](#migration-guide)
- [References](#references)

---

## Overview

All internal system tables in Sovrium MUST use the `_sovrium_` prefix to isolate them from user-created tables. This prevents naming conflicts and clearly identifies tables owned by the platform.

**Naming Pattern**:

```
_sovrium_<category>_<entity>
```

**Examples**:

- `_sovrium_auth_users` - Authentication users table
- `_sovrium_auth_sessions` - Authentication sessions table
- `_sovrium_migration_history` - Migration tracking table
- `_sovrium_activity_logs` - Activity audit log
- `_sovrium_record_comments` - Record comments table

**Key Principles**:

1. **Namespace Isolation** - User tables can use any name without conflict
2. **Platform Identification** - Immediately recognizable as system tables
3. **Category Grouping** - Related tables share common prefix (e.g., `_sovrium_auth_*`)
4. **Consistency** - All internal tables follow this pattern without exception

---

## Why This Pattern

### Problem: Namespace Conflicts

Without prefixing, Sovrium's internal tables conflict with user-created tables:

**Scenario: CRM Application**

```
User wants to create:
- "users" table (for CRM contacts)
- "organizations" table (for client companies)
- "members" table (for team assignments)

❌ CONFLICTS with Better Auth tables:
- users (Better Auth authentication)
- organizations (Better Auth multi-tenancy)
- members (Better Auth organization membership)

Result: User cannot create their business tables!
```

### Solution: Prefix Internal Tables

```
✅ Better Auth tables renamed:
- users → _sovrium_auth_users
- organizations → _sovrium_auth_organizations
- members → _sovrium_auth_members

✅ User can now create:
- users (CRM contacts)
- organizations (client companies)
- members (team assignments)

Result: No conflicts! Clear separation between platform and user tables.
```

### Benefits

| Benefit                 | Description                                                      |
| ----------------------- | ---------------------------------------------------------------- |
| **Namespace Isolation** | Users can create any table name without checking for conflicts   |
| **Clear Ownership**     | Developers immediately recognize `_sovrium_*` as platform tables |
| **Migration Safety**    | Schema migrations won't accidentally target user tables          |
| **Tool Compatibility**  | Database tools can filter system tables by prefix                |
| **Future-Proof**        | New internal tables won't conflict with existing user tables     |

### Trade-Offs

| ✅ Advantages                              | ⚠️ Considerations                                |
| ------------------------------------------ | ------------------------------------------------ |
| Eliminates user namespace conflicts        | Slightly longer table names (8 extra characters) |
| Clear visual distinction in DB tools       | Requires migration for existing tables           |
| Self-documenting (prefix explains purpose) | Must update Better Auth table configuration      |
| Consistent with industry patterns          | Queries must reference prefixed names            |

---

## Implementation

### Current Internal Tables (14 Total)

#### Authentication Tables (9 tables) - `_sovrium_auth_*`

Managed by Better Auth plugin, configured in `src/infrastructure/auth/better-auth/auth.ts`:

```typescript
// Custom table names with _sovrium_auth_ prefix for namespace isolation
const AUTH_TABLE_NAMES = {
  user: '_sovrium_auth_users',
  session: '_sovrium_auth_sessions',
  account: '_sovrium_auth_accounts',
  verification: '_sovrium_auth_verifications',
  organization: '_sovrium_auth_organizations',
  member: '_sovrium_auth_members',
  invitation: '_sovrium_auth_invitations',
  apiKey: '_sovrium_auth_api_keys',
  twoFactor: '_sovrium_auth_two_factors',
} as const

// Better Auth configuration with explicit modelName mappings
export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg', usePlural: true }),
  session: { modelName: AUTH_TABLE_NAMES.session },
  account: { modelName: AUTH_TABLE_NAMES.account },
  verification: { modelName: AUTH_TABLE_NAMES.verification },
  user: { modelName: AUTH_TABLE_NAMES.user },
  plugins: [
    organization({
      schema: {
        organization: { modelName: AUTH_TABLE_NAMES.organization },
        member: { modelName: AUTH_TABLE_NAMES.member },
        invitation: { modelName: AUTH_TABLE_NAMES.invitation },
      },
    }),
    twoFactor({ schema: { twoFactor: { modelName: AUTH_TABLE_NAMES.twoFactor } } }),
  ],
})
```

**Tables**:

1. `_sovrium_auth_users` - User accounts (authentication)
2. `_sovrium_auth_sessions` - Active sessions
3. `_sovrium_auth_accounts` - OAuth provider accounts
4. `_sovrium_auth_verifications` - Email/phone verification tokens
5. `_sovrium_auth_organizations` - Multi-tenant organizations (platform feature)
6. `_sovrium_auth_members` - Organization membership (platform feature)
7. `_sovrium_auth_invitations` - Organization invites
8. `_sovrium_auth_api_keys` - API authentication
9. `_sovrium_auth_two_factors` - 2FA configuration

**Schema Location**: `src/infrastructure/auth/better-auth/schema.ts`

**Migration**: `drizzle/0010_rename_auth_tables.sql`

#### Migration Audit Tables (3 tables) - `_sovrium_migration_*`

Tracks schema migrations and drift detection:

```typescript
// src/infrastructure/database/drizzle/schema/migration-audit.ts
export const sovriumMigrationHistory = pgTable('_sovrium_migration_history', {
  id: serial('id').primaryKey(),
  version: integer('version').notNull(),
  checksum: text('checksum').notNull(),
  schema: jsonb('schema'),
  appliedAt: timestamp('applied_at').defaultNow(),
})

export const sovriumMigrationLog = pgTable('_sovrium_migration_log', {
  id: serial('id').primaryKey(),
  operation: text('operation').notNull(),
  fromVersion: integer('from_version'),
  toVersion: integer('to_version'),
  reason: text('reason'),
  status: text('status').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
})

export const sovriumSchemaChecksum = pgTable('_sovrium_schema_checksum', {
  id: text('id').primaryKey(),
  checksum: text('checksum').notNull(),
  schema: jsonb('schema').notNull(),
  updatedAt: timestamp('updated_at').defaultNow(),
})
```

**Purpose**: Runtime migration system (see `@docs/architecture/decisions/003-runtime-sql-migrations.md`)

#### Activity Tracking Tables (2 tables) - `_sovrium_*`

System-wide audit logging and comments:

```typescript
// src/infrastructure/database/drizzle/schema/activity-log.ts
export const activityLogs = pgTable('_sovrium_activity_logs', {
  id: text('id').primaryKey(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  userId: text('user_id').references(() => users.id),
  action: text('action').notNull().$type<ActivityAction>(),
  tableName: text('table_name').notNull(),
  tableId: text('table_id').notNull(),
  recordId: text('record_id').notNull(),
  changes: jsonb('changes').$type<ActivityLogChanges>(),
  // ... other fields
})

// src/infrastructure/database/drizzle/schema/record-comments.ts
export const recordComments = pgTable('_sovrium_record_comments', {
  id: text('id').primaryKey(),
  recordId: text('record_id').notNull(),
  tableId: text('table_id').notNull(),
  userId: text('user_id').notNull(),
  content: text('content').notNull(),
  // ... other fields
})
```

**Purpose**: Cross-table features (audit trail, commenting system)

---

## Enforcement

### Current Enforcement Status

**❌ NOT automatically enforced** - No ESLint or TypeScript rules prevent creating tables without `_sovrium_` prefix.

**✅ Manual enforcement required** - Developers must follow this convention during code review.

### Why Not Automated?

**Technical Limitations**:

1. **Drizzle ORM limitation** - `pgTable()` is a runtime function, not a compile-time type
2. **ESLint limitation** - Cannot validate string literal arguments to functions without custom plugin
3. **TypeScript limitation** - Cannot enforce naming patterns on runtime values

**Potential Enforcement Approaches** (not implemented):

| Approach                          | Feasibility | Trade-Offs                                |
| --------------------------------- | ----------- | ----------------------------------------- |
| **Custom ESLint plugin**          | ⚠️ Moderate | Requires maintenance, complex AST parsing |
| **Pre-commit hook (grep tables)** | ✅ Easy     | Can be bypassed, doesn't prevent bad code |
| **Database migration validation** | ⚠️ Moderate | Only catches errors at runtime (too late) |
| **Code review checklist**         | ✅ Easy     | Current approach - documented below       |

### Code Review Checklist

When reviewing PRs that add new internal tables, verify:

- [ ] Table name starts with `_sovrium_` prefix
- [ ] Table uses appropriate category suffix (`_auth_`, `_migration_`, etc.)
- [ ] Schema file is in `src/infrastructure/database/drizzle/schema/`
- [ ] Table is NOT user-configurable (user tables should never use prefix)
- [ ] Drizzle migration generated via `bun run db:generate`
- [ ] Migration SQL reviewed for correctness

### Manual Validation Script

Run this script to detect tables violating the convention:

```bash
# Check for tables in schema files without _sovrium_ prefix
grep -rn "pgTable('" src/infrastructure/ \
  | grep -v "_sovrium_" \
  | grep -v "auth/better-auth/schema.ts" # Auth tables already checked
```

**Expected Output**: No results (all internal tables use prefix)

**If violations found**: Review table purpose:

- **User-created table?** → Correct (no prefix needed)
- **Platform table?** → ❌ Violation (add `_sovrium_` prefix)

---

## Best Practices

### When to Use `_sovrium_` Prefix

✅ **USE PREFIX** for:

- **Authentication tables** - Better Auth managed tables
- **Migration tracking** - Schema history, checksums, logs
- **System features** - Activity logs, comments, notifications
- **Platform services** - Background jobs, webhooks, API rate limits
- **Internal metadata** - Configuration, feature flags, telemetry

❌ **DO NOT USE PREFIX** for:

- **User-created tables** - Tables defined in app configuration
- **Business domain tables** - Tables representing user's business entities
- **Dynamic app tables** - Tables generated from user's schema configuration

### Naming Pattern Guidelines

**Format**: `_sovrium_<category>_<entity>`

**Categories** (use existing or create new as needed):

| Category      | Prefix Pattern             | Usage                                |
| ------------- | -------------------------- | ------------------------------------ |
| `auth`        | `_sovrium_auth_*`          | Authentication, authorization, users |
| `migration`   | `_sovrium_migration_*`     | Schema migration tracking            |
| (no category) | `_sovrium_activity_logs`   | Cross-cutting platform features      |
| (no category) | `_sovrium_record_comments` | Cross-cutting platform features      |

**When to use category**:

- **Multiple related tables** (3+) → Use category (`_sovrium_auth_users`, `_sovrium_auth_sessions`)
- **Single table** → No category (`_sovrium_activity_logs`)

**Examples**:

```typescript
// ✅ CORRECT - Category for related tables
export const users = pgTable('_sovrium_auth_users', {
  /* ... */
})
export const sessions = pgTable('_sovrium_auth_sessions', {
  /* ... */
})
export const accounts = pgTable('_sovrium_auth_accounts', {
  /* ... */
})

// ✅ CORRECT - No category for standalone table
export const activityLogs = pgTable('_sovrium_activity_logs', {
  /* ... */
})
export const recordComments = pgTable('_sovrium_record_comments', {
  /* ... */
})

// ❌ INCORRECT - Missing prefix
export const webhooks = pgTable('webhooks', {
  /* ... */
})

// ❌ INCORRECT - Wrong prefix format
export const webhooks = pgTable('sovrium_webhooks', {
  /* ... */
}) // Missing leading underscore
export const webhooks = pgTable('_sovrium-webhooks', {
  /* ... */
}) // Use underscore, not dash
```

### Schema Organization

**File Structure**:

```
src/infrastructure/database/drizzle/schema/
├── migration-audit.ts        # _sovrium_migration_* tables
├── activity-log.ts           # _sovrium_activity_logs
├── record-comments.ts        # _sovrium_record_comments
└── webhooks.ts               # Future: _sovrium_webhooks (example)

src/infrastructure/auth/better-auth/
└── schema.ts                 # _sovrium_auth_* tables
```

**Rules**:

- One file per logical grouping (all auth tables in one file)
- File name reflects purpose, not table prefix
- Co-locate related tables (migration history + log + checksum)

---

## Common Pitfalls

### ❌ Pitfall 1: Forgetting Prefix on New Tables

**Problem**:

```typescript
// ❌ INCORRECT - New internal table without prefix
export const backgroundJobs = pgTable('background_jobs', {
  id: serial('id').primaryKey(),
  // ...
})
```

**Solution**:

```typescript
// ✅ CORRECT - Use _sovrium_ prefix
export const backgroundJobs = pgTable('_sovrium_background_jobs', {
  id: serial('id').primaryKey(),
  // ...
})
```

**Detection**: Run validation script (see Enforcement section)

### ❌ Pitfall 2: Using Prefix on User Tables

**Problem**:

```typescript
// ❌ INCORRECT - User tables should NOT have prefix
export const userDefinedTable = pgTable('_sovrium_customers', {
  id: text('id').primaryKey(),
  // This is a user-created table from app config!
})
```

**Solution**:

```typescript
// ✅ CORRECT - User tables have NO prefix
export const userDefinedTable = pgTable('customers', {
  id: text('id').primaryKey(),
  // User owns this table name
})
```

**Rule**: Only platform-owned tables use `_sovrium_` prefix.

### ❌ Pitfall 3: Inconsistent Category Naming

**Problem**:

```typescript
// ❌ INCORRECT - Mixing category formats
export const users = pgTable('_sovrium_auth_users', {
  /* ... */
})
export const sessions = pgTable('_sovrium_authentication_sessions', {
  /* ... */
})
//                                        ^^^^^^ Different category name!
```

**Solution**:

```typescript
// ✅ CORRECT - Consistent category
export const users = pgTable('_sovrium_auth_users', {
  /* ... */
})
export const sessions = pgTable('_sovrium_auth_sessions', {
  /* ... */
})
//                                        ^^^^ Same category
```

**Rule**: Pick one category name and use it consistently for related tables.

### ❌ Pitfall 4: Forgetting to Update Better Auth Config

**Problem**:

After deciding to use `_sovrium_auth_` prefix, forgetting to configure Better Auth table names:

```typescript
// ❌ INCORRECT - Better Auth still uses unprefixed table names
export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg', usePlural: true }),
  // No custom table name configuration!
})
```

**Solution**:

```typescript
// ✅ CORRECT - Configure Better Auth with custom table names
const AUTH_TABLE_NAMES = {
  user: '_sovrium_auth_users',
  session: '_sovrium_auth_sessions',
  // ... other tables
} as const

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg', usePlural: true }),
  session: { modelName: AUTH_TABLE_NAMES.session },
  user: { modelName: AUTH_TABLE_NAMES.user },
  plugins: [
    organization({
      schema: {
        organization: { modelName: AUTH_TABLE_NAMES.organization },
        member: { modelName: AUTH_TABLE_NAMES.member },
      },
    }),
  ],
})
```

**Migration Required**: See [Migration Guide](#migration-guide) for existing tables.

---

## Migration Guide

### Migrating Existing Tables to Use Prefix

If you need to rename existing tables to add `_sovrium_` prefix:

**Step 1: Create Drizzle Schema with New Names**

```typescript
// src/infrastructure/database/drizzle/schema/example.ts
export const oldTable = pgTable('_sovrium_old_table', {
  // Change from 'old_table' to '_sovrium_old_table'
  id: serial('id').primaryKey(),
  // ... other columns
})
```

**Step 2: Generate Migration**

```bash
bun run db:generate
```

Drizzle will generate a migration SQL file like:

```sql
-- drizzle/0011_rename_old_table.sql
ALTER TABLE "old_table" RENAME TO "_sovrium_old_table";
```

**Step 3: Review Generated Migration**

**CRITICAL**: Verify migration SQL is correct:

- ✅ `RENAME TO` preserves data (no data loss)
- ✅ Foreign keys are updated automatically
- ✅ Indexes are preserved

**Step 4: Apply Migration**

```bash
bun run db:migrate
```

**Step 5: Update Application Code**

Search for references to old table name and update:

```bash
# Find hardcoded table name strings
grep -rn '"old_table"' src/
grep -rn "'old_table'" src/

# Update to new name
# "old_table" → "_sovrium_old_table"
```

**Step 6: Test Thoroughly**

- ✅ Run all unit tests: `bun test:unit`
- ✅ Run all E2E tests: `bun test:e2e`
- ✅ Manually test affected features

### Example: Auth Tables Migration

**Reference**: Commit `dbd43323` - Auth tables renamed to use `_sovrium_auth_` prefix

**What was migrated**:

```
users → _sovrium_auth_users
sessions → _sovrium_auth_sessions
accounts → _sovrium_auth_accounts
verifications → _sovrium_auth_verifications
organizations → _sovrium_auth_organizations
members → _sovrium_auth_members
invitations → _sovrium_auth_invitations
api_keys → _sovrium_auth_api_keys
two_factors → _sovrium_auth_two_factors
```

**Migration SQL**: `drizzle/0010_rename_auth_tables.sql` (73 lines)

**Changes Required**:

1. Schema file updated: `src/infrastructure/auth/better-auth/schema.ts`
2. Better Auth config updated: `src/infrastructure/auth/better-auth/auth.ts`
3. Migration generated and applied
4. No application code changes (Better Auth abstracts table names)

**Lesson**: Library-managed tables (like Better Auth) are easier to migrate because the library abstracts table names from application code.

---

## References

### Related Documentation

- **Database Access Strategy** - `@docs/architecture/patterns/database-access-strategy.md` (explains internal vs user tables)
- **Soft Delete by Default** - `@docs/architecture/patterns/soft-delete-by-default.md` (all tables include `deleted_at` intrinsic field)
- **Runtime SQL Migrations** - `@docs/architecture/decisions/003-runtime-sql-migrations.md` (migration system context)
- **Naming Conventions** - `@docs/architecture/naming-conventions.md` (code naming standards)
- **Drizzle ORM** - `@docs/infrastructure/database/drizzle.md` (schema definition guide)

### External References

- [PostgreSQL Schema Design Best Practices](https://www.postgresql.org/docs/current/ddl-schemas.html)
- [Better Auth Table Configuration](https://www.better-auth.com/docs/concepts/database#table-names)
- [Drizzle ORM Schema Definition](https://orm.drizzle.team/docs/sql-schema-declaration)

### Relevant Commits

- **dbd43323** - `refactor(auth): prefix auth tables with _sovrium_auth_ for namespace isolation` (2025-12-16)
- **c5d6db71** - `chore(db): add record comments table and make activity logs auth optional` (2025-12-14)
- **e6aad867** - `refactor: migrate internal tables to Drizzle ORM` (2025-11-28)

### Schema Files

- `src/infrastructure/auth/better-auth/schema.ts` - Auth tables (9 tables)
- `src/infrastructure/database/drizzle/schema/migration-audit.ts` - Migration tracking (3 tables)
- `src/infrastructure/database/drizzle/schema/activity-log.ts` - Activity logging (1 table)
- `src/infrastructure/database/drizzle/schema/record-comments.ts` - Comment system (1 table)

---

## Summary

### Key Takeaways

1. **All internal tables use `_sovrium_` prefix** - 14 tables currently implemented
2. **Prevents namespace conflicts** - Users can create any table name without collision
3. **Category grouping** - Related tables use `_sovrium_<category>_<entity>` pattern
4. **NOT automatically enforced** - Requires manual code review
5. **User tables NEVER use prefix** - Only platform-owned tables use `_sovrium_`

### Quick Reference

| Question                           | Answer                                                                |
| ---------------------------------- | --------------------------------------------------------------------- |
| **When to use prefix?**            | Platform-owned tables (auth, migrations, system features)             |
| **When NOT to use prefix?**        | User-created tables from app configuration                            |
| **How to name new table?**         | `_sovrium_<category>_<entity>` or `_sovrium_<entity>` (if standalone) |
| **How to migrate existing table?** | Update schema → Generate migration → Review SQL → Apply → Update code |
| **How to validate convention?**    | Run grep validation script (see Enforcement section)                  |

### Decision Checklist

When adding a new database table, ask:

1. **Who owns this table?**
   - Platform/Sovrium → Use `_sovrium_` prefix
   - User/Application → No prefix

2. **Is it part of a group?**
   - Yes (3+ related tables) → Use category (`_sovrium_auth_users`)
   - No (standalone table) → No category (`_sovrium_activity_logs`)

3. **Is it documented?**
   - Add to appropriate schema file
   - Update this document if new category created
   - Generate and review Drizzle migration

4. **Is it tested?**
   - Unit tests for schema logic
   - E2E tests for database operations
   - Migration tested in development environment
