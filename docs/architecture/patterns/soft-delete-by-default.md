# Soft Delete by Default - Implementation Design

> **Product Decision**: Following Airtable's UX model, Sovrium implements soft delete as the default behavior for all tables. Records are moved to "trash" instead of permanently deleted, providing safety, audit trails, and restore capability.

---

## Table of Contents

1. [Product Vision & Rationale](#product-vision--rationale)
2. [Airtable's Deletion Model](#airtables-deletion-model)
3. [Technical Design](#technical-design)
4. [Implementation Roadmap](#implementation-roadmap)
5. [API Surface](#api-surface)
6. [Permission Model](#permission-model)
7. [Migration Strategy](#migration-strategy)
8. [Testing Strategy](#testing-strategy)

---

## Product Vision & Rationale

### Why Soft Delete by Default?

Sovrium positions itself as a **user-friendly, business-application platform** (similar to Airtable, Notion, Google Workspace) rather than a developer-focused infrastructure tool (like Retool, Postgres).

**Key Benefits**:

- **Safety First**: "Oops" moments don't lose data permanently
- **Audit Trail**: See what was deleted, when, and by whom
- **Compliance Friendly**: Data retention without complexity
- **UX Confidence**: Users aren't afraid to delete (reversible action)
- **Business Value**: Deleted data can be analyzed for insights

### Platform Positioning

| Platform Type                     | Deletion Philosophy        | Target Users                      |
| --------------------------------- | -------------------------- | --------------------------------- |
| **Airtable, Notion, Google Docs** | Soft delete by default     | Business users, consumer apps     |
| **Retool, Postgres, MongoDB**     | Hard delete by default     | Developers, infrastructure        |
| **Sovrium**                       | **Soft delete by default** | **Internal tools, business apps** |

**Decision**: Sovrium aligns with Airtable's approach to maximize user confidence and data safety.

---

## Airtable's Deletion Model

### How Airtable Handles Deletion

| Aspect               | Airtable's Implementation                   |
| -------------------- | ------------------------------------------- |
| **Default action**   | Soft delete - record marked as "trashed"    |
| **Visibility**       | Hidden from normal views automatically      |
| **Trash view**       | Dedicated filter to see deleted records     |
| **Restoration**      | One-click restore from trash                |
| **Retention**        | Deleted records retained indefinitely       |
| **Permanent delete** | Separate action (admin-only)                |
| **Permission model** | Delete = trash, permanent delete = elevated |

### UX Flow in Airtable

```
User clicks "Delete Record"
  ↓
Confirmation: "Move to trash?"
  ↓
Record disappears from view (deleted_at = NOW())
  ↓
User can view "Trash" to see deleted records
  ↓
User can "Restore" (deleted_at = NULL)
  ↓
OR admin can "Delete Permanently" (hard delete)
```

---

## Technical Design

### 1. Intrinsic Metadata Field: `deleted_at`

**Change Required**: Add `deleted_at` to system-managed special fields.

**File**: `src/domain/models/app/table/index.ts`

```typescript
// Current (line 113)
const SPECIAL_FIELDS = new Set(['id', 'created_at', 'updated_at'])

// Updated
const SPECIAL_FIELDS = new Set(['id', 'created_at', 'updated_at', 'deleted_at'])
```

**Impact**:

- All tables implicitly have `deleted_at` available
- Formula fields can reference `deleted_at` without explicit definition
- Consistent with `created_at` and `updated_at` pattern

### 2. Database Schema

**Automatic Column Addition**:

```sql
-- All tables automatically get:
ALTER TABLE {table_name}
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Index for query performance (most queries filter deleted_at IS NULL)
CREATE INDEX IF NOT EXISTS idx_{table_name}_deleted_at
  ON {table_name}(deleted_at);
```

**Column Characteristics**:

- **Type**: `TIMESTAMP WITH TIME ZONE` (matches `created_at`, `updated_at`)
- **Nullable**: `YES` (NULL = active, NOT NULL = deleted)
- **Default**: `NULL` (all records start active)
- **Indexed**: `YES` (critical for query performance)

**Rationale**:

- Nullable column with index performs well even with millions of rows
- Timestamp provides audit trail (when deleted)
- Consistent with existing metadata fields

### 3. Automatic Query Filtering

**Query Layer Changes** (`src/infrastructure/database/`):

All SELECT queries automatically inject soft-delete filter:

```typescript
// Before (developer writes):
SELECT * FROM contacts WHERE email = 'user@example.com'

// After (automatic injection):
SELECT * FROM contacts
WHERE email = 'user@example.com'
  AND deleted_at IS NULL
```

**Implementation Strategy**:

```typescript
// Query generator utility
function addSoftDeleteFilter(sql: string, tableName: string): string {
  // Parse SQL and inject deleted_at IS NULL filter
  // Combine with existing WHERE clause using AND
}
```

**View Behavior**:

- User-defined views automatically inherit `deleted_at IS NULL` filter
- User filters are AND-ed with soft delete filter
- Exception: Explicit trash views filter `deleted_at IS NOT NULL`

### 4. Cascade Behavior

**Soft Delete Propagation**:

When a parent record is soft-deleted, related records are also soft-deleted:

```sql
-- Example: Delete contact with related tasks
UPDATE contacts SET deleted_at = NOW() WHERE id = 1;

-- Trigger automatically executes:
UPDATE tasks SET deleted_at = NOW()
WHERE contact_id = 1 AND deleted_at IS NULL;
```

**Restore Cascade**:

Restoring a parent record can optionally restore children:

```typescript
// API: POST /api/tables/1/records/1/restore?cascade=true
{
  "restoreRelated": true  // Optional: restore child records too
}
```

---

## Implementation Roadmap

### Phase 1: Core Infrastructure (Week 1)

**Minimal Viable Implementation**:

1. **Update Domain Model** (`src/domain/models/app/table/index.ts`)
   - Add `deleted_at` to `SPECIAL_FIELDS`
   - Unit test: formula fields can reference `deleted_at`

2. **Database Migration Generator** (`src/infrastructure/database/sql-generators.ts`)
   - Generate `deleted_at` column for all tables
   - Generate index: `idx_{table}_deleted_at`
   - Migration test: verify column and index creation

3. **Query Filtering** (`src/infrastructure/database/`)
   - Inject `deleted_at IS NULL` in all SELECT queries
   - Unit test: verify filter injection
   - E2E test: deleted records invisible to normal queries

4. **Basic API Endpoints**
   - `DELETE /api/tables/{id}/records/{id}` → soft delete (update `deleted_at`)
   - `POST /api/tables/{id}/records/{id}/restore` → restore (clear `deleted_at`)
   - `GET /api/tables/{id}/trash` → list deleted records

**Acceptance Criteria**:

- ✅ All tables have `deleted_at` column with index
- ✅ Normal queries exclude soft-deleted records
- ✅ Soft delete API sets `deleted_at = NOW()`
- ✅ Restore API clears `deleted_at`
- ✅ Trash API returns only soft-deleted records

### Phase 2: UI & UX (Week 2)

**User Interface**:

1. **Delete Confirmation Dialog**
   - Default: "Move to trash" (soft delete)
   - Checkbox: "Permanently delete" (admin only)

2. **Trash View** (built-in view for all tables)
   - Filter: `deleted_at IS NOT NULL`
   - Columns: include `deleted_at` timestamp
   - Actions: "Restore" button per row

3. **Record Detail View**
   - Show "deleted_at" metadata if record is in trash
   - Show "Restore" action button

**React Components** (`src/presentation/components/`):

- `DeleteRecordDialog.tsx` - Confirmation with permanent option
- `TrashView.tsx` - Dedicated trash view component
- `RestoreButton.tsx` - One-click restore action

### Phase 3: Advanced Features (Week 3)

**Enhancements**:

1. **Cascade Delete Configuration** (table-level setting)

   ```typescript
   {
     name: 'contacts',
     deleteBehavior: {
       cascade: true,  // Soft-delete related records
       onRestore: 'restore_all'  // or 'restore_none', 'ask_user'
     }
   }
   ```

2. **Retention Policy** (organization-level setting)

   ```typescript
   {
     retentionPolicy: {
       autoDeleteAfterDays: 30,  // null = indefinite
       permanentDeleteAfterDays: 90  // null = never
     }
   }
   ```

3. **Permanent Delete API** (admin only)

   ```typescript
   DELETE /api/tables/{id}/records/{id}?permanent=true
   ```

4. **Batch Operations**
   ```typescript
   POST /api/tables/{id}/records/batch/restore
   DELETE /api/tables/{id}/records/batch?permanent=true
   ```

### Phase 4: GDPR & Compliance (Week 4)

**Regulatory Compliance**:

1. **Right to be Forgotten**
   - API endpoint for hard delete (GDPR requirement)
   - Audit log: who requested, when, reason
   - Cascade to all related data

2. **Data Retention Compliance**
   - Auto-purge after configured retention period
   - Admin notification before purge
   - Audit trail of purged records

3. **Export Deleted Records**
   - Download deleted records as CSV/JSON
   - Include deletion metadata (who, when)

---

## API Surface

### REST Endpoints

| Method   | Endpoint                                                  | Description           | Permission |
| -------- | --------------------------------------------------------- | --------------------- | ---------- |
| `DELETE` | `/api/tables/{tableId}/records/{recordId}`                | Soft delete (default) | `delete`   |
| `DELETE` | `/api/tables/{tableId}/records/{recordId}?permanent=true` | Hard delete           | `admin`    |
| `POST`   | `/api/tables/{tableId}/records/{recordId}/restore`        | Restore from trash    | `update`   |
| `GET`    | `/api/tables/{tableId}/trash`                             | List deleted records  | `read`     |
| `POST`   | `/api/tables/{tableId}/records/batch/restore`             | Bulk restore          | `update`   |
| `DELETE` | `/api/tables/{tableId}/records/batch?permanent=true`      | Bulk hard delete      | `admin`    |

### Request/Response Examples

**Soft Delete**:

```http
DELETE /api/tables/1/records/42
Authorization: Bearer {token}

Response 200 OK:
{
  "success": true,
  "message": "Record moved to trash",
  "record": {
    "id": 42,
    "deleted_at": "2025-12-16T10:30:00Z"
  }
}
```

**Restore**:

```http
POST /api/tables/1/records/42/restore
Authorization: Bearer {token}

Response 200 OK:
{
  "success": true,
  "message": "Record restored",
  "record": {
    "id": 42,
    "deleted_at": null
  }
}
```

**Permanent Delete**:

```http
DELETE /api/tables/1/records/42?permanent=true
Authorization: Bearer {token}

Response 200 OK:
{
  "success": true,
  "message": "Record permanently deleted",
  "audit": {
    "deleted_by": "user_123",
    "deleted_at": "2025-12-16T10:30:00Z",
    "reason": "GDPR right to be forgotten"
  }
}
```

---

## Permission Model

### Separation of Concerns

| Action               | Permission Check    | Default Roles         | Rationale                |
| -------------------- | ------------------- | --------------------- | ------------------------ |
| **Soft delete**      | `delete` permission | member, admin         | Low risk (reversible)    |
| **Restore**          | `update` permission | member, admin         | Reversible action        |
| **View trash**       | `read` permission   | member, admin, viewer | Audit transparency       |
| **Permanent delete** | `admin` role        | admin                 | High risk (irreversible) |

### Permission Configuration Example

```typescript
{
  name: 'contacts',
  permissions: {
    organizationScoped: true,
    read: { type: 'roles', roles: ['member'] },
    delete: { type: 'roles', roles: ['member'] },  // Soft delete
    // Permanent delete is implicitly admin only (hardcoded)
  }
}
```

### GDPR Override

For GDPR "right to be forgotten" requests, permanent delete can be triggered by:

- Admin with audit trail
- API call with legal compliance flag

---

## Migration Strategy

### Existing Tables

**Backward Compatibility**:

1. **Migration Script** (run once on existing databases):

   ```sql
   -- For each existing table:
   ALTER TABLE {table_name}
     ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

   CREATE INDEX IF NOT EXISTS idx_{table_name}_deleted_at
     ON {table_name}(deleted_at);
   ```

2. **No Data Loss**:
   - All existing records have `deleted_at = NULL` (active)
   - No behavior change for existing records

3. **Query Compatibility**:
   - Old queries still work (automatic filter injection)
   - Existing views automatically get soft-delete filter

### Rollout Plan

**Phased Deployment**:

1. **Phase 1**: Deploy backend changes (soft delete API)
2. **Phase 2**: Add UI components (trash view)
3. **Phase 3**: Enable automatic query filtering
4. **Phase 4**: Migrate existing tables (add `deleted_at` column)

**Feature Flag** (temporary):

```typescript
{
  features: {
    softDeleteByDefault: true // Can toggle per organization during rollout
  }
}
```

---

## Testing Strategy

### Test Coverage

**E2E Tests** (`specs/app/table/soft-delete.spec.ts`):

| Test ID               | Description                                  | Category    |
| --------------------- | -------------------------------------------- | ----------- |
| `APP-SOFT-DELETE-001` | Automatic `deleted_at` column creation       | Schema      |
| `APP-SOFT-DELETE-002` | Soft delete sets timestamp                   | Behavior    |
| `APP-SOFT-DELETE-003` | Automatic filtering of deleted records       | Query       |
| `APP-SOFT-DELETE-004` | Formula fields reference `deleted_at`        | Integration |
| `APP-SOFT-DELETE-005` | Restore clears `deleted_at`                  | Behavior    |
| `APP-SOFT-DELETE-006` | Trash endpoint lists deleted records         | API         |
| `APP-SOFT-DELETE-007` | Permanent delete removes record              | Behavior    |
| `APP-SOFT-DELETE-008` | Views respect deleted_at filter              | Query       |
| `APP-SOFT-DELETE-009` | Cascade soft delete to related records       | Integration |
| `APP-SOFT-DELETE-010` | Permission model for soft vs hard delete     | Security    |
| `APP-SOFT-DELETE-011` | Full workflow (delete → restore → permanent) | Regression  |

**Unit Tests** (domain/infrastructure layers):

- `SPECIAL_FIELDS` includes `deleted_at`
- Query generator injects soft-delete filter
- Migration generator creates column and index
- Permission checker validates permanent delete

---

## Codebase Changes Summary

### Files to Modify

| File                                                | Change                               | Priority |
| --------------------------------------------------- | ------------------------------------ | -------- |
| `src/domain/models/app/table/index.ts`              | Add `deleted_at` to `SPECIAL_FIELDS` | **P0**   |
| `src/infrastructure/database/sql-generators.ts`     | Generate `deleted_at` column         | **P0**   |
| `src/infrastructure/database/schema-initializer.ts` | Add column to CREATE TABLE           | **P0**   |
| `src/infrastructure/database/query-generators.ts`   | Inject soft-delete filter            | **P0**   |
| `src/infrastructure/database/view-generators.ts`    | Handle trash views                   | **P1**   |
| `src/presentation/api/routes/tables/records.ts`     | Add restore endpoint                 | **P0**   |
| `src/presentation/api/routes/tables/trash.ts`       | Add trash endpoint                   | **P1**   |
| `src/presentation/components/DeleteDialog.tsx`      | Add permanent option                 | **P1**   |
| `src/presentation/components/TrashView.tsx`         | Create trash view                    | **P1**   |

### Test Files to Create

- ✅ `specs/app/table/soft-delete.spec.ts` - E2E tests (CREATED)
- `src/domain/models/app/table/index.test.ts` - Update unit tests
- `src/infrastructure/database/sql-generators.test.ts` - Add column tests
- `src/infrastructure/database/query-generators.test.ts` - Filter injection tests

---

## Success Metrics

### Technical Metrics

- ✅ 100% of tables have `deleted_at` column with index
- ✅ 0 hard deletes in production (except GDPR/admin actions)
- ✅ Query performance: `deleted_at IS NULL` filter adds <5ms overhead
- ✅ Test coverage: 11 E2E specs + unit tests for all generators

### UX Metrics

- 📊 Soft delete usage vs permanent delete ratio (target: 95% soft)
- 📊 Restore rate (% of deleted records restored)
- 📊 Time to restore (avg time from delete to restore)
- 📊 User confidence in delete actions (survey)

---

## FAQ

### Q: What about storage costs for deleted records?

**A**: Deleted records consume minimal storage. For organizations concerned about costs, implement auto-purge after configurable retention period (e.g., 30 days).

### Q: How does this affect query performance?

**A**: Negligible impact (<5ms) when `deleted_at` column is indexed. Most queries will be: `WHERE ... AND deleted_at IS NULL`, which uses the index efficiently.

### Q: Can users opt-out of soft delete?

**A**: Yes, via `permanent=true` query parameter. However, this requires elevated permissions (admin).

### Q: What about GDPR compliance?

**A**: Permanent delete API satisfies "right to be forgotten". Soft delete provides audit trail without violating GDPR (data is still under user control).

### Q: How is this different from Airtable?

**A**: Nearly identical UX. Key difference: Sovrium is self-hosted (your infrastructure), while Airtable is SaaS (their servers).

---

## Next Steps

1. **Review & Approval**: Product decision validated ✅
2. **Spec Creation**: E2E tests created ✅
3. **Implementation**: Follow roadmap Phase 1 → Phase 4
4. **Handoff to e2e-test-fixer**: Implement RED tests
5. **Deployment**: Phased rollout with feature flag

---

**Document Status**: Design Complete - Ready for Implementation

**Last Updated**: 2025-12-16

**Related Documentation**:

- [Database Access Strategy](./database-access-strategy.md) - Soft delete applies to both Drizzle ORM (internal) and manual SQL (user tables)
- [Internal Table Naming Convention](./internal-table-naming-convention.md) - Internal audit tables use `_sovrium_` prefix
- [ADR 003: Runtime SQL Migrations](../decisions/003-runtime-sql-migrations.md) - Migration system for user tables
- `specs/app/table/soft-delete.spec.ts` - E2E test specifications
- `src/domain/models/app/table/field-types/deleted-at-field.ts` - Field schema
- `VISION.md` - Product vision alignment
