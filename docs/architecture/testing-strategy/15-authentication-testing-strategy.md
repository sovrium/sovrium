# Authentication Testing Strategy

> **Document Version**: 0.0.1
> **Last Updated**: 2025-12-16
> **Status**: Active

## Overview

This document describes the testing strategy for authentication methods in Sovrium. Authentication tests are organized in **separate files by auth method** rather than merged into endpoint-specific files.

## Principle: Separate Auth Method Test Files

Authentication methods (cookie session, API key/Bearer token, OAuth) are tested in dedicated spec files separate from business logic tests.

```
specs/api/tables/
├── get.spec.ts              # Business logic tests (cookie auth)
├── api-key-auth.spec.ts     # API key auth tests (Bearer token)
└── {tableId}/
    ├── get.spec.ts          # Business logic tests
    └── api-key-auth.spec.ts # API key auth tests
```

## Rationale

### 1. TDD Pipeline Efficiency

Separate files mean smaller context windows:

- `get.spec.ts` (~400 LOC) processes faster than merged file (~1200+ LOC)
- Each auth method can be implemented independently
- Queue items are more focused and faster to complete

### 2. Test Isolation

Auth method failures don't cascade:

- Cookie auth regression? Only `get.spec.ts` fails
- Bearer token issue? Only `api-key-auth.spec.ts` fails
- Clear failure attribution in CI logs

### 3. Architectural Alignment

Matches Sovrium's layer-based architecture:

- Authentication = **Infrastructure** concern (cookie vs API key is infrastructure detail)
- Business logic = **Application/Domain** concern
- Tests mirror code structure

### 4. Future-Proofing

Easy to add/remove auth methods:

```
# Adding OAuth support:
specs/api/tables/
├── get.spec.ts              # Unchanged
├── api-key-auth.spec.ts     # Unchanged
├── oauth-auth.spec.ts       # NEW - isolated addition
```

## File Organization

### Business Logic Tests (`*.spec.ts`)

Test endpoint-specific functionality with cookie-based session auth:

```typescript
// specs/api/tables/get.spec.ts
test.describe('GET /api/tables', () => {
  test('should return all tables for authenticated user', async ({
    request,
    createAuthenticatedUser, // Cookie-based auth
  }) => {
    await createAuthenticatedUser({ email: 'user@example.com' })
    const response = await request.get('/api/tables')
    expect(response.status()).toBe(200)
  })
})
```

### Auth Method Tests (`api-key-auth.spec.ts`)

Test authentication flow with Bearer token:

```typescript
// specs/api/tables/api-key-auth.spec.ts
test.describe('API Key Authentication - Table Listing', () => {
  test.fixme(
    'API-TABLES-AUTH-001: should return 200 with valid Bearer token',
    { tag: '@spec' },
    async ({ request, createAuthenticatedUser, createApiKeyAuth }) => {
      await createAuthenticatedUser({ email: 'user@example.com' })
      const authHeaders = await createApiKeyAuth({ name: 'test-key' })

      const response = await request.get('/api/tables', authHeaders)
      expect(response.status()).toBe(200)
    }
  )
})
```

## Test Fixtures

### `createApiKeyAuth` Fixture

Creates an API key and returns Bearer token headers:

```typescript
// Usage
const authHeaders = await createApiKeyAuth({ name: 'my-key' })
// Returns: { headers: { Authorization: 'Bearer sk_xxx...' } }

// Use with request
const response = await request.get('/api/tables', authHeaders)
```

### `createApiKey` Fixture

Creates an API key and returns full key data:

```typescript
// Usage
const apiKey = await createApiKey({ name: 'my-key', expiresIn: 3600 })
// Returns: { id: '...', key: 'sk_xxx...', name: 'my-key', ... }
```

## Standard Test Categories

Every `api-key-auth.spec.ts` file should include:

### Authentication Tests

- ✅ 200/201 with valid Bearer token
- ❌ 401 without Authorization header
- ❌ 401 with invalid Bearer token
- ❌ 401 with expired API key
- ❌ 401 with malformed Bearer token
- ❌ 401 with non-Bearer auth scheme

### Permission Tests (Role-Based)

- ✅ 200 when user role allows action
- ❌ 403 when user role denies action

### owner isolation

- ✅ Returns only user's organization data
- ❌ 404 for cross-organization access (not 403, prevents enumeration)

### Field-Level Permissions

- ✅ Excludes protected fields based on role
- ❌ 403 when writing to protected field

## Spec ID Convention

Auth tests use concern-focused IDs:

| Pattern                       | Example                       | Description        |
| ----------------------------- | ----------------------------- | ------------------ |
| `API-TABLES-AUTH-XXX`         | `API-TABLES-AUTH-001`         | Table listing auth |
| `API-TABLES-GET-AUTH-XXX`     | `API-TABLES-GET-AUTH-001`     | Single table auth  |
| `API-TABLES-RECORDS-AUTH-XXX` | `API-TABLES-RECORDS-AUTH-001` | Records CRUD auth  |
| `API-ACTIVITY-AUTH-XXX`       | `API-ACTIVITY-AUTH-001`       | Activity logs auth |

## Bearer Token Format

Sovrium uses industry-standard Bearer token format:

```http
Authorization: Bearer sk_live_xxxxxxxxxxxxxxxxxxxxx
```

This matches APIs like:

- **Airtable**: `Authorization: Bearer pat...`
- **Notion**: `Authorization: Bearer secret_...`
- **Stripe**: `Authorization: Bearer sk_...`
- **GitHub**: `Authorization: Bearer ghp_...`

## Coverage Summary

| API Domain                                 | Cookie Auth                                      | API Key Auth           |
| ------------------------------------------ | ------------------------------------------------ | ---------------------- |
| `/api/tables`                              | `get.spec.ts`                                    | `api-key-auth.spec.ts` |
| `/api/tables/{tableId}`                    | `get.spec.ts`                                    | `api-key-auth.spec.ts` |
| `/api/tables/{tableId}/records`            | `get.spec.ts`, `post.spec.ts`                    | `api-key-auth.spec.ts` |
| `/api/tables/{tableId}/records/{recordId}` | `get.spec.ts`, `patch.spec.ts`, `delete.spec.ts` | `api-key-auth.spec.ts` |
| `/api/tables/{tableId}/records/batch`      | `post.spec.ts`                                   | `api-key-auth.spec.ts` |
| `/api/activity`                            | `get.spec.ts`                                    | `api-key-auth.spec.ts` |
| `/api/activity/{activityId}`               | `get.spec.ts`                                    | `api-key-auth.spec.ts` |

## Related Documentation

- [Test File Naming Convention](./06-test-file-naming-convention.md)
- [Managing Red Tests with .fixme()](./04-managing-red-tests-with-fixme.md)
- [Testing Principles](./07-testing-principles.md)
- [Playwright Best Practices](./08-playwright-best-practices.md)
