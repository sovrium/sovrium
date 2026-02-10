# ADR 007: Soft Delete by Default for All Tables

**Status**: Accepted
**Date**: 2025-12-16 (retroactive - decision made 2025-11-25)
**Decision Makers**: Product Architecture Review
**Related**: [Pattern: Soft Delete by Default](../patterns/soft-delete-by-default.md)

---

## Context

Sovrium is a configuration-driven application platform that positions itself as a user-friendly business application tool (similar to Airtable, Notion, Google Workspace) rather than a developer-focused infrastructure platform (like Retool, PostgreSQL).

### Problem Statement

When users delete records in a business application, permanent deletion poses several risks:

1. **Data Loss Risk**: Accidental deletions cannot be recovered
2. **Audit Trail Gap**: No visibility into what was deleted, when, or by whom
3. **Compliance Issues**: Regulatory requirements often mandate data retention
4. **User Hesitation**: Fear of permanent deletion reduces platform confidence
5. **Business Intelligence Loss**: Deleted data may contain valuable insights

### Requirements

- **Safety First**: Prevent accidental permanent data loss
- **Audit Capability**: Track deletion events with full metadata (who, when, why)
- **Restore Functionality**: One-click restoration from trash
- **Compliance Support**: Meet data retention requirements without complexity
- **Consistent UX**: Same deletion behavior across all tables (user and internal)

---

## Decision

**All tables in Sovrium (both user-created and internal system tables) will use soft delete by default via a `deleted_at` intrinsic field.**

### Implementation Details

1. **Intrinsic Field**: `deleted_at` added to system-managed special fields (alongside `id`, `created_at`, `updated_at`)
2. **Database Schema**: All tables include `deleted_at TIMESTAMPTZ` column (nullable)
3. **Default Behavior**: Delete operations set `deleted_at = NOW()` instead of removing rows
4. **Query Filtering**: All read queries automatically filter `WHERE deleted_at IS NULL`
5. **Trash View**: Dedicated UI to view and restore deleted records
6. **Permanent Delete**: Separate admin-only operation for compliance (GDPR "right to be forgotten")

### User Experience Flow

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

## Rationale

### Why Soft Delete by Default?

1. **Platform Positioning**: Sovrium aligns with Airtable's UX philosophy (business users over developers)
2. **User Confidence**: Reversible deletions reduce fear and increase platform adoption
3. **Audit Trail**: Built-in deletion tracking without additional infrastructure
4. **Compliance Friendly**: Satisfies data retention requirements automatically
5. **Business Value**: Deleted records can be analyzed for churn insights, trend analysis
6. **Industry Standard**: Consumer-facing platforms (Gmail, Google Drive, Dropbox) use soft delete

### Comparison with Other Platforms

| Platform Type                     | Deletion Philosophy        | Target Users                      |
| --------------------------------- | -------------------------- | --------------------------------- |
| **Airtable, Notion, Google Docs** | Soft delete by default     | Business users, consumer apps     |
| **Retool, PostgreSQL, MongoDB**   | Hard delete by default     | Developers, infrastructure        |
| **Sovrium**                       | **Soft delete by default** | **Internal tools, business apps** |

---

## Consequences

### Positive Outcomes

- **Improved User Confidence**: Users aren't afraid to delete (reversible action)
- **Built-in Audit Trail**: Deletion tracking included without additional code
- **Regulatory Compliance**: Easier to meet data retention requirements
- **Reduced Support Burden**: Fewer "I accidentally deleted data" support tickets
- **Better Analytics**: Deleted records inform churn analysis and product insights
- **Consistent UX**: Same deletion behavior across all features

### Negative Trade-offs

- **Storage Overhead**: Deleted records consume database space indefinitely (mitigated by eventual permanent delete)
- **Query Complexity**: All queries must filter `deleted_at IS NULL` (mitigated by database views and ORM abstractions)
- **Performance Impact**: Larger table scans due to retained deleted records (mitigated by indexes on `deleted_at`)
- **Permission Model Complexity**: Separate permissions needed for trash access and permanent delete

### Mitigation Strategies

1. **Storage**: Implement scheduled cleanup of old trash records (e.g., auto-delete after 90 days)
2. **Performance**: Index `deleted_at` column, use partial indexes for active records
3. **Queries**: Abstract filtering via database views and Effect.ts services
4. **Permissions**: Clear RBAC rules (admin can permanent delete, all roles can trash/restore)

---

## Alternatives Considered

### Alternative 1: Hard Delete by Default

**Rejected** because:

- Violates user-friendly platform positioning
- Increases support burden from accidental deletions
- Requires separate audit logging infrastructure
- Misaligned with consumer application standards

### Alternative 2: Optional Soft Delete (Per-Table Configuration)

**Rejected** because:

- Inconsistent user experience across tables
- Increased cognitive load ("Which tables have trash?")
- Fragmented audit trail implementation
- Additional configuration complexity

### Alternative 3: Trash Retention Period (Auto-Cleanup)

**Deferred** for future consideration:

- Not a replacement for soft delete
- Could be added later as an enhancement
- Example: Auto-delete trash records older than 90 days
- Status: Planned for Phase 2 implementation

### Alternative 4: Version History Instead of Trash

**Rejected** because:

- Significantly higher storage overhead (all versions retained)
- More complex to implement (JSONB diffs, version tracking)
- Doesn't address accidental deletion UX problem
- Adds cognitive complexity for users

---

## Implementation Roadmap

### Phase 1: Core Soft Delete (CURRENT)

- Add `deleted_at` to special fields
- Update domain models to include `deleted_at`
- Modify SQL generators to create column
- Update query builders to filter deleted records

### Phase 2: Trash UI

- Trash view component
- Restore functionality
- Bulk restore operations
- Trash filter in table views

### Phase 3: Permissions & Admin

- Permission model for trash access
- Admin permanent delete API
- Audit logging for permanent deletions
- GDPR compliance tooling

### Phase 4: Performance & Optimization

- Partial indexes for active records
- Scheduled cleanup jobs
- Performance monitoring
- Query optimization

---

## Review Date

**Next Review**: 2025-07-01 (6 months after implementation)

**Review Questions**:

- Is storage overhead acceptable?
- Are users utilizing trash/restore features?
- Do we need auto-cleanup of old trash records?
- Are there performance issues with large deleted datasets?
- Should we add version history in addition to soft delete?

---

## References

### Related Documentation

- [Pattern: Soft Delete by Default](../patterns/soft-delete-by-default.md) - Complete implementation design (567 lines)
- [Database Access Strategy](../patterns/database-access-strategy.md) - Applies to both Drizzle ORM and manual SQL
- [Internal Table Naming Convention](../patterns/internal-table-naming-convention.md) - Internal audit tables

### E2E Specifications

- `specs/app/table/soft-delete.spec.ts` - Test specifications for soft delete behavior

### Product Inspiration

- [Airtable Deletion Model](https://www.airtable.com/) - Primary UX inspiration
- [Gmail Trash](https://mail.google.com/) - Consumer-grade soft delete UX
- [Google Drive Trash](https://drive.google.com/) - File deletion patterns

### Academic References

- ["Soft Delete Pattern"](https://martinfowler.com/eaaCatalog/softDelete.html) - Martin Fowler's Enterprise Application Architecture Catalog
- [GDPR Data Retention](https://gdpr.eu/data-retention/) - Legal framework for data lifecycle

---

## Summary

Sovrium adopts soft delete by default for all tables (user-created and internal) to:

1. **Align with platform positioning** as a user-friendly business application tool
2. **Provide safety** against accidental data loss
3. **Enable audit trails** without additional infrastructure
4. **Support compliance** with data retention regulations
5. **Improve user confidence** through reversible deletion

This decision mirrors Airtable's UX philosophy and positions Sovrium as a consumer-grade platform for internal business tools.
