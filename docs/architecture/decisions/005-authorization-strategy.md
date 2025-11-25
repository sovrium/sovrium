# ADR-003: Authorization Strategy for Table APIs

## Status

**Accepted** (2025-01-25)

## Context

Sovrium requires fine-grained access control for table records APIs with:

- Multi-tenant organization isolation
- Role-based access control (RBAC) with Better Auth
- Table-level operation permissions (CRUD)
- Field-level read/write permissions
- Protection against cross-org enumeration attacks

## Decision

We will implement a layered authorization strategy:

### 1. Authentication Layer (Better Auth)

- Use Better Auth 1.3.34 with Organization plugin
- Extract user context (id, organizationId, role) from session
- Middleware validates all requests require authentication

### 2. Authorization Service (Effect.ts)

- Application layer service using Effect.ts for typed error handling
- Centralized permission checks: table-level, field-level, organization isolation
- Dependency injection via Effect Layer

### 3. Permission Model (RBAC + FBAC)

**Four default roles**:

- `owner`: Full access to all tables and fields
- `admin`: Full access to all tables and fields
- `member`: Read/create/update (no delete), field restrictions configurable
- `viewer`: Read-only, field restrictions configurable

**Permission structure**:

```typescript
{
  [role: string]: {
    table: { read, create, update, delete },
    fields: { [fieldName: string]: { read?, write? } }
  }
}
```

**Default behavior**:

- If field not listed: `read: true`, `write: true`
- Empty `fields: {}` grants full field access

### 4. Organization Isolation (Multi-Tenancy)

- Database-level isolation with `organization_id` column on all tables
- Auto-inject `organization_id` on CREATE
- Filter by `organization_id` on READ/UPDATE/DELETE
- Return 404 (not 403) for cross-org access to prevent enumeration

### 5. Permission Check Order

Critical order to prevent information leakage:

1. **Authentication** (401) - Check user is authenticated
2. **Organization Isolation** (404) - Check record belongs to user's org
3. **Table-Level Permissions** (403) - Check user can perform operation
4. **Field-Level Permissions** (403) - Check user can access specific fields

### 6. Readonly System Fields

Always protected regardless of permissions: `id`, `created_at`, `updated_at`

## Consequences

### Positive

- **Security**: Multi-layered defense with auth, org isolation, and permissions
- **Flexibility**: Field-level granularity allows fine-tuned access control
- **Type Safety**: Effect.ts provides typed errors and composable authorization logic
- **Testability**: Centralized service easy to mock and test
- **Performance**: Permission checks cached, field lists computed once per request
- **Privacy**: 404 for cross-org access prevents organization enumeration

### Negative

- **Complexity**: Multiple permission layers increase implementation effort
- **Database Queries**: Organization filtering adds WHERE clause to all queries
- **Cache Management**: Permission configuration changes require cache invalidation
- **Migration Path**: Existing APIs must be retrofitted with permission checks

### Mitigations

- **Linter enforcement**: ESLint rules detect missing organization filters
- **Spec coverage**: 100+ E2E specs validate all permission scenarios
- **Documentation**: Comprehensive patterns guide implementation
- **Caching**: Permission config cached per user+table to minimize DB queries

## Alternatives Considered

### Alternative 1: Attribute-Based Access Control (ABAC)

**Rejected**: Too complex for Phase 0. RBAC + field-level permissions sufficient.

### Alternative 2: ACLs (Access Control Lists)

**Rejected**: Per-record ACLs don't scale well for multi-tenant systems. Role-based approach simpler.

### Alternative 3: GraphQL Field-Level Permissions

**Rejected**: Sovrium uses REST APIs, not GraphQL. Field filtering implemented at route layer.

### Alternative 4: JWT Claims for Permissions

**Rejected**: Permissions can change frequently. Better to fetch from database on each request with caching.

### Alternative 5: 403 for Cross-Org Access

**Rejected**: Returning 403 for cross-org access reveals record existence, enabling enumeration attacks. 404 is safer.

## Related Documentation

- Implementation: `docs/architecture/patterns/authorization-api-routes.md`
- Better Auth: `docs/architecture/patterns/authorization-better-auth-integration.md`
- Effect Service: `docs/architecture/patterns/authorization-effect-service.md`
- Field Permissions: `docs/architecture/patterns/authorization-field-level-permissions.md`
- Org Isolation: `docs/architecture/patterns/authorization-organization-isolation.md`
- Error Handling: `docs/architecture/patterns/authorization-error-handling.md`

## References

- Better Auth Organization Plugin: https://www.better-auth.com/docs/plugins/organization
- Effect.ts Error Handling: https://effect.website/docs/error-management/expected-errors
- OWASP Access Control: https://owasp.org/www-project-web-security-testing-guide/latest/4-Web_Application_Security_Testing/05-Authorization_Testing/README
