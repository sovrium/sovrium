# HTTP Status Code Testing Guidelines

## Overview

This document establishes guidelines for testing HTTP status codes in E2E tests, explaining when to use exact matching vs. accepting multiple status codes.

## Guiding Principles

### 1. **Exact Match for Definitive Outcomes**

Use exact status code matching when the expected behavior is unambiguous and implementation-specific:

```typescript
// ✅ GOOD: Exact match for well-defined success
expect(response.status()).toBe(200) // Sign-in succeeded
expect(response.status()).toBe(201) // Resource created
expect(response.status()).toBe(204) // Resource deleted (no content)

// ✅ GOOD: Exact match for specific errors
expect(response.status()).toBe(404) // Resource not found
expect(response.status()).toBe(409) // Conflict (duplicate email)
```

**When to use:**

- Success responses (200, 201, 204)
- Specific client errors with clear semantics (404, 409, 422)
- Resource creation/deletion operations
- Well-documented API contract requirements

### 2. **Range Match for Flexible Error Handling**

Use status code ranges when multiple valid error responses exist or when the exact code may vary based on implementation details:

```typescript
// ✅ GOOD: Accept multiple auth error codes
expect([400, 401]).toContain(response.status())
// Invalid credentials could be 400 (bad request) or 401 (unauthorized)

expect([400, 401, 403]).toContain(response.status())
// Email verification could fail with multiple error types

// ✅ GOOD: Accept validation errors
expect([400, 422]).toContain(response.status())
// Validation errors may use different codes based on framework
```

**When to use:**

- Authentication/authorization failures (400, 401, 403)
- Validation errors (400, 422)
- Cross-cutting concerns (security, rate limiting)
- Third-party library error responses (Better Auth, etc.)

## Error Response Formats

### Generic API Errors

**Format:** `{ error: string }`

**Used for:**

- Security errors (CSRF, XSS, injection)
- System errors (500, infrastructure failures)
- Generic API endpoints (tables, resources)
- Rate limiting
- Payload validation

**Example:**

```json
{
  "error": "CSRF token validation failed"
}
```

### Better Auth Errors

**Format:** `{ message: string }`

**Used for:**

- Authentication errors (sign-in, sign-up)
- Authorization errors (permissions)
- Session management errors
- Password validation
- Email verification

**Example:**

```json
{
  "message": "Invalid email or password"
}
```

### Dual-Format Errors

Some errors may include both properties for compatibility:

```json
{
  "error": "Invalid request",
  "message": "Email is required"
}
```

## Testing Patterns

### Pattern 1: Exact Status + Error Field

```typescript
test('should reject invalid email format', async ({ request }) => {
  const response = await request.post('/api/auth/sign-up/email', {
    data: { email: 'not-an-email', password: 'Pass123!' },
  })

  // Exact status code (well-defined error)
  expect(response.status()).toBe(400)

  const data = await response.json()
  // Better Auth uses 'message'
  expect(data).toHaveProperty('message')
})
```

### Pattern 2: Range Match + Error Field

```typescript
test('should prevent access without verification', async ({ request }) => {
  const response = await request.post('/api/auth/sign-in/email', {
    data: { email: 'unverified@example.com', password: 'Pass123!' },
  })

  // Multiple valid codes (implementation may vary)
  expect([400, 401, 403]).toContain(response.status())

  const data = await response.json()
  expect(data).toHaveProperty('message')
  expect(data.message.toLowerCase()).toMatch(/verif/i)
})
```

### Pattern 3: Security Errors

```typescript
test('should reject CSRF attack', async ({ request }) => {
  const response = await request.post('/api/tables/1/records', {
    data: { title: 'Task' },
    // No CSRF token
  })

  // CSRF always returns 403
  expect(response.status()).toBe(403)

  const data = await response.json()
  // Generic API errors use 'error'
  expect(data).toHaveProperty('error')
})
```

## Decision Matrix

| Scenario                | Status Code Pattern        | Error Property       | Rationale               |
| ----------------------- | -------------------------- | -------------------- | ----------------------- |
| **Resource creation**   | `toBe(201)`                | `error` or `message` | Well-defined success    |
| **Resource not found**  | `toBe(404)`                | `error`              | Clear 404 semantics     |
| **Duplicate resource**  | `toBe(409)` or `toBe(422)` | `message`            | Better Auth may use 422 |
| **Invalid credentials** | `[400, 401]`               | `message`            | Multiple valid codes    |
| **Email verification**  | `[400, 401, 403]`          | `message`            | Implementation varies   |
| **CSRF protection**     | `toBe(403)`                | `error`              | Security standard       |
| **Rate limiting**       | `toBe(429)`                | `error`              | RFC standard            |
| **XSS/Injection**       | `toBe(400)`                | `error`              | Validation error        |
| **Server error**        | `toBe(500)`                | `error`              | System error            |

## Common Mistakes

### ❌ Too Restrictive

```typescript
// BAD: Forces specific code when multiple are valid
expect(response.status()).toBe(400)
// Sign-in could reasonably be 401 (unauthorized)
```

**Fix:**

```typescript
// GOOD: Accept both reasonable codes
expect([400, 401]).toContain(response.status())
```

### ❌ Too Permissive

```typescript
// BAD: Accepts any error code
expect([400, 401, 403, 404, 422, 500]).toContain(response.status())
// This doesn't validate anything meaningful
```

**Fix:**

```typescript
// GOOD: Limit to reasonable alternatives
expect([400, 401]).toContain(response.status())
// Or use exact match if outcome is well-defined
expect(response.status()).toBe(400)
```

### ❌ Wrong Error Property

```typescript
// BAD: Using wrong property for endpoint
const data = await response.json()
expect(data).toHaveProperty('error') // Sign-in uses 'message'
```

**Fix:**

```typescript
// GOOD: Use correct property for Better Auth
const data = await response.json()
expect(data).toHaveProperty('message')
```

## Testing Strategy

### For New Tests

1. **Check existing similar tests** - Follow established patterns
2. **Consult API documentation** - Use documented status codes
3. **Test actual implementation** - Verify what code is returned
4. **Use exact match first** - Default to exact, widen if needed
5. **Document rationale** - Add comment explaining why range is used

### Example Documentation

```typescript
test('API-AUTH-SIGN-IN-EMAIL-005: should return 401 with wrong password', async () => {
  // ... test setup

  const response = await request.post('/api/auth/sign-in/email', {
    data: { email: 'user@example.com', password: 'wrong' },
  })

  // Exact match: Better Auth consistently returns 401 for auth failures
  expect(response.status()).toBe(401)

  const data = await response.json()
  expect(data).toHaveProperty('message')
})
```

```typescript
test('API-AUTH-SIGN-UP-EMAIL-012: should prevent sign-in before verification', async () => {
  // ... test setup

  const response = await request.post('/api/auth/sign-in/email', {
    data: { email: unverifiedEmail, password },
  })

  // Range match: Implementation may use 400 (validation), 401 (unauthorized),
  // or 403 (forbidden) depending on verification strategy
  expect([400, 401, 403]).toContain(response.status())

  const data = await response.json()
  expect(data).toHaveProperty('message')
  expect(data.message.toLowerCase()).toMatch(/verif/i)
})
```

## References

- [MDN HTTP Status Codes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status)
- [RFC 7231 - HTTP/1.1 Semantics](https://tools.ietf.org/html/rfc7231#section-6)
- [Better Auth Error Responses](https://www.better-auth.com/docs/concepts/error-handling)
- Error Disclosure: `specs/api/security/error-disclosure.spec.ts`
- CSRF Protection: `specs/api/security/csrf-protection.spec.ts`

## Summary

- **Use exact match** when the status code is well-defined and unambiguous
- **Use range match** when multiple codes are valid or implementation may vary
- **Check error property** - `error` for generic API, `message` for Better Auth
- **Document decisions** - Explain why range match is used in comments
- **Follow patterns** - Be consistent within related test suites
