# Schema Recommendations for Missing Security Features

**Date**: 2025-01-15
**Author**: Product Specifications Architect (Claude Code)
**Context**: Analysis of missing features expected by security specs

---

## Executive Summary

After analyzing the security specs (particularly `specs/api/security/audit-logging.spec.ts`), the current auth schemas, and existing architectural patterns, I've identified **three missing features** that need schema support:

1. **`sensitive` property on field definitions** - For audit logging of sensitive data access
2. **`auth.roles` configuration** - For defining custom application-level roles
3. **`role` property in sign-up** - For assigning roles during registration

All three features follow the "activated by key existence" principle and integrate cleanly with existing schemas.

---

## Feature 1: `sensitive` Property on Field Definitions

### Description

**What it does**: Marks field definitions that contain sensitive data (SSN, credit cards, PII) for audit logging purposes.

**Why it's needed**:

- Compliance requirements (GDPR, HIPAA, SOC 2) mandate tracking access to sensitive data
- Security incident response needs to trace who accessed what sensitive data
- Audit trails must distinguish between regular data access and sensitive data access

**Use case from spec**:

```typescript
// API-SECURITY-AUDIT-004: should log sensitive data access
tables: [
  {
    name: 'sensitive_records',
    fields: [
      { id: 1, name: 'id', type: 'integer', required: true },
      { id: 2, name: 'ssn', type: 'single-line-text', sensitive: true },
      { id: 3, name: 'credit_card', type: 'single-line-text', sensitive: true },
    ],
  },
]
```

### Schema Location

**File**: `src/domain/models/app/table/field-types/base-field.ts`

**Justification**:

- `BaseFieldSchema` contains common properties shared across all field types
- All field types extend this base, so `sensitive` will be available everywhere
- Consistent with existing optional properties (`required`, `unique`, `indexed`)

### Schema Definition

````typescript
/**
 * Base Field Schema
 *
 * Common properties shared across all field types.
 * All field types should extend this base schema and add their specific properties.
 */
export const BaseFieldSchema = Schema.Struct({
  id: FieldIdSchema,
  name: FieldNameSchema,
  required: Schema.optional(Schema.Boolean),
  unique: Schema.optional(Schema.Boolean),
  indexed: Schema.optional(Schema.Boolean),

  /**
   * Sensitive data flag (optional)
   *
   * Marks fields containing sensitive data (PII, credentials, financial data).
   * When present and true, triggers:
   * - Audit logging for data access (if security.auditLogging enabled)
   * - Enhanced encryption at rest (future)
   * - Redaction in logs and error messages (future)
   *
   * Use for:
   * - SSN, tax IDs, national IDs
   * - Credit card numbers, bank accounts
   * - Medical records, biometric data
   * - Passwords, API keys, secrets
   *
   * @example
   * ```typescript
   * { id: 1, name: 'ssn', type: 'single-line-text', sensitive: true }
   * { id: 2, name: 'credit_card', type: 'single-line-text', sensitive: true }
   * ```
   */
  sensitive: Schema.optional(
    Schema.Boolean.pipe(
      Schema.annotations({
        description: 'Marks field as containing sensitive data for audit logging',
      })
    )
  ),
}).pipe(
  Schema.annotations({
    description: 'Base field properties: id, name, required, unique, indexed, sensitive',
  })
)
````

### Integration Points

1. **Audit Logging** (`security.auditLogging` - future feature):
   - When a field has `sensitive: true`, accessing its data creates audit log entry
   - Event type: `data.sensitive.accessed`
   - Metadata includes: table name, record ID, field names, user ID, timestamp

2. **API Response Filtering** (authorization layer):
   - Can use `sensitive` flag to determine field-level permissions
   - Integrate with existing field permissions in `table.permissions`

3. **Type Inference**:
   - All existing field type schemas automatically gain `sensitive` property
   - No breaking changes - property is optional

### Better Auth Compatibility

**No Better Auth changes required** - This is purely app-schema level.

Better Auth doesn't need to know about sensitive fields. The audit logging middleware (when implemented) will:

1. Inspect the schema to find fields with `sensitive: true`
2. Intercept API responses containing those fields
3. Create audit log entries

### Implementation Complexity

**Low** (1-2 hours)

**Why low**:

- Single-line change to `BaseFieldSchema`
- No validation logic needed (simple boolean flag)
- No breaking changes (optional property)
- Existing field type schemas automatically inherit it

**Implementation checklist**:

- [ ] Add `sensitive` property to `BaseFieldSchema`
- [ ] Update `BaseFieldSchema` annotations
- [ ] Add unit tests in `base-field.test.ts`
- [ ] Run schema export to regenerate JSON schemas
- [ ] Update field type examples in docs (if any)

---

## Feature 2: `auth.roles` Configuration

### Description

**What it does**: Defines custom application-level roles beyond Better Auth's default organization roles (owner, admin, member, viewer).

**Why it's needed**:

- Applications need domain-specific roles (e.g., "editor", "moderator", "analyst")
- Spec expects `auth.roles: ['admin', 'member', 'viewer']` for role-based permissions
- Better Auth supports custom roles via `additionalFields` on user, but we need schema definition

**Use case from spec**:

```typescript
// API-SECURITY-AUDIT-003: should log permission changes
auth: {
  emailAndPassword: true,
  roles: ['admin', 'member', 'viewer'],  // Application-level roles
}
```

**Use case from other specs**:

```typescript
// API-AUTH-ORG-DYNAMIC-ROLE-CREATE-001: Custom org-level roles
plugins: {
  organization: {
    dynamicRoles: {
      maxRolesPerOrganization: 10
    } // Runtime role creation
  }
}

// vs. auth.roles (static app-level roles)
auth: {
  roles: ['manager', 'employee'] // Fixed roles for whole app
}
```

### Schema Location

**File**: `src/domain/models/app/auth/index.ts`

**Justification**:

- Top-level auth configuration, not specific to any method or plugin
- Peer to `emailAndPassword`, `oauth`, `plugins` (follows flat structure)
- Affects entire application, not organization-specific

### Schema Definition

````typescript
// In src/domain/models/app/auth/roles.ts (new file)

/**
 * Application-Level Roles Configuration
 *
 * Defines custom roles for the entire application.
 * These are static roles defined at app schema level, distinct from:
 * - Better Auth organization roles (owner, admin, member, viewer)
 * - Dynamic roles (runtime role creation via organization plugin)
 *
 * When this configuration exists, custom application roles are enabled.
 *
 * Roles defined here:
 * - Apply globally to all users (not organization-specific)
 * - Can be assigned during sign-up (via `role` parameter)
 * - Used for table-level permissions (table.permissions.roles)
 * - Tracked in audit logs for permission changes
 *
 * Use cases:
 * - Domain-specific roles: "editor", "moderator", "analyst"
 * - Compliance roles: "auditor", "compliance-officer"
 * - Support roles: "support-agent", "customer-success"
 *
 * NOT for:
 * - Organization-level roles (use organization plugin's dynamicRoles)
 * - User metadata (use Better Auth's additionalFields)
 *
 * @example
 * ```typescript
 * // Simple role list
 * { roles: ['admin', 'member', 'viewer'] }
 *
 * // With role hierarchy (future enhancement)
 * { roles: {
 *   admin: { inherits: ['member'] },
 *   member: { inherits: ['viewer'] },
 *   viewer: {}
 * }}
 * ```
 */
export const AppRolesConfigSchema = Schema.Union(
  // Simple form: array of role names
  Schema.NonEmptyArray(
    Schema.String.pipe(
      Schema.pattern(/^[a-z][a-z0-9-]*$/),
      Schema.minLength(2),
      Schema.maxLength(50),
      Schema.annotations({
        description: 'Role name (kebab-case, 2-50 chars)',
      })
    )
  ).pipe(
    Schema.annotations({
      description: 'List of application-level role names',
      examples: [
        ['admin', 'member', 'viewer'],
        ['manager', 'employee'],
        ['editor', 'author', 'contributor'],
      ],
    })
  )

  // Future: Object form with role hierarchy (Phase 1+)
  // Schema.Record({
  //   key: Schema.String,
  //   value: Schema.Struct({
  //     inherits: Schema.optional(Schema.Array(Schema.String)),
  //     description: Schema.optional(Schema.String),
  //   })
  // })
).pipe(
  Schema.annotations({
    title: 'Application Roles Configuration',
    description:
      'Custom application-level roles (static, global). Use organization.dynamicRoles for runtime role creation.',
  })
)

export type AppRolesConfig = Schema.Schema.Type<typeof AppRolesConfigSchema>
````

````typescript
// In src/domain/models/app/auth/index.ts (update AuthSchema)

import { AppRolesConfigSchema } from './roles'

export const AuthSchema = Schema.Struct({
  // Authentication Methods
  emailAndPassword: Schema.optional(EmailAndPasswordConfigSchema),
  magicLink: Schema.optional(MagicLinkConfigSchema),
  oauth: Schema.optional(OAuthConfigSchema),

  // Feature Extensions
  plugins: Schema.optional(PluginsConfigSchema),
  emailTemplates: Schema.optional(AuthEmailTemplatesSchema),
  session: Schema.optional(SessionConfigSchema),
  security: Schema.optional(AuthSecurityConfigSchema),

  /**
   * Application-level roles (optional)
   *
   * Defines custom roles for the entire application.
   * These are static roles defined at schema level, used for:
   * - Table-level permissions (table.permissions.roles)
   * - Sign-up role assignment (via `role` parameter)
   * - Audit logging of permission changes
   *
   * Distinct from:
   * - Better Auth organization roles (owner, admin, member, viewer)
   * - Dynamic roles (organization.dynamicRoles for runtime creation)
   *
   * @example
   * ```typescript
   * { roles: ['admin', 'member', 'viewer'] }
   * { roles: ['editor', 'author', 'contributor'] }
   * ```
   */
  roles: Schema.optional(AppRolesConfigSchema),
})
  .pipe
  // Existing cross-field validation...
  ()
````

### Integration Points

1. **Table Permissions** (`src/domain/models/app/table/permissions/roles.ts`):
   - Already exists! `RolesPermissionSchema` expects role names
   - Current: Uses Better Auth's org roles (owner, admin, member, viewer)
   - With `auth.roles`: Can reference custom app-level roles
   - Validation: Ensure roles referenced in `table.permissions.roles` exist in `auth.roles`

2. **Sign-Up Role Assignment** (Feature 3 below):
   - `role` parameter in sign-up validates against `auth.roles`
   - If `auth.roles` not defined, only Better Auth org roles allowed

3. **Audit Logging** (`security.auditLogging` - future):
   - Event type: `auth.role.changed`
   - Metadata includes: old role, new role, changed by, target user

4. **Better Auth Integration**:
   - Store custom role in Better Auth's `user.role` field
   - Or use `additionalFields` for multi-role support (future)

### Better Auth Compatibility

**Requires Better Auth schema extension** (via `additionalFields`):

```typescript
// In Better Auth config
betterAuth({
  user: {
    additionalFields: {
      role: {
        type: 'string',
        required: false,
        // Validation against auth.roles happens at app level
      },
    },
  },
})
```

**Alternative**: Use Better Auth's organization roles as-is, and map `auth.roles` to them at app level (no DB schema changes).

### Implementation Complexity

**Medium** (4-6 hours)

**Why medium**:

- New schema file + integration with existing `AuthSchema`
- Need to validate cross-references (table permissions referencing auth.roles)
- Better Auth integration requires decision: new field vs. map to org roles
- Unit tests for role validation logic

**Implementation checklist**:

- [ ] Create `src/domain/models/app/auth/roles.ts`
- [ ] Update `AuthSchema` with `roles` property
- [ ] Add cross-validation: table permissions must reference valid roles
- [ ] Decide Better Auth integration approach (additionalFields vs. mapping)
- [ ] Add unit tests for role validation
- [ ] Update auth examples in docs
- [ ] Run schema export

---

## Feature 3: `role` Property in Sign-Up

### Description

**What it does**: Allows assigning a role to a user during registration.

**Why it's needed**:

- Admin workflows: Create users with pre-assigned roles
- Self-registration flows: Users select their role (e.g., "buyer" vs. "seller")
- Test setup: Quickly create users with specific roles for testing

**Use case from spec**:

```typescript
// API-SECURITY-AUDIT-003: Create users with roles
const adminUser = await signUp({
  name: 'Admin User',
  email: 'admin@example.com',
  password: 'AdminPass123!',
  role: 'admin', // Assign role during sign-up
})

const targetUser = await signUp({
  name: 'Target User',
  email: 'target@example.com',
  password: 'TargetPass123!',
  role: 'viewer', // Different role
})
```

### Schema Location

**This is NOT an app schema change** - It's an API parameter change.

**Justification**:

- App schema defines available roles (`auth.roles`)
- API endpoint (`POST /api/auth/sign-up/email`) accepts `role` parameter
- Validation: `role` must exist in `auth.roles` (or Better Auth org roles)

**Files affected**:

1. `src/presentation/api/schemas/auth-schemas.ts` (Zod schema for API)
2. `src/application/use-cases/auth/SignUp.ts` (Effect program)
3. Better Auth integration layer

### Schema Definition (API Level - Zod)

```typescript
// In src/presentation/api/schemas/auth-schemas.ts

/**
 * Sign-up request schema
 *
 * Validates user registration data including optional role assignment.
 */
export const signUpRequestSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(100),

  /**
   * Role to assign (optional)
   *
   * When provided:
   * - Must be a valid role from auth.roles (app-level)
   * - Or a valid Better Auth organization role (owner, admin, member, viewer)
   * - Validation happens at application layer against app schema
   *
   * When omitted:
   * - Uses admin.defaultRole (if configured)
   * - Otherwise defaults to 'user' or 'member'
   *
   * @example "admin", "member", "viewer"
   */
  role: z.string().optional(),
})

export type SignUpRequest = z.infer<typeof signUpRequestSchema>
```

### Integration Points

1. **Validation Against `auth.roles`** (Application Layer):

   ```typescript
   // In src/application/use-cases/auth/SignUp.ts

   export const SignUp = (input: SignUpRequest) =>
     Effect.gen(function* () {
       const appConfig = yield* AppConfig // Get app schema

       if (input.role) {
         // Validate role exists in auth.roles or Better Auth org roles
         const validRoles = [
           ...(appConfig.auth?.roles ?? []),
           'owner',
           'admin',
           'member',
           'viewer', // Better Auth org roles
         ]

         if (!validRoles.includes(input.role)) {
           return yield* Effect.fail(new InvalidRoleError({ role: input.role, validRoles }))
         }
       }

       // Proceed with Better Auth sign-up...
       const user = yield* BetterAuthService.signUp({
         ...input,
         role: input.role ?? appConfig.auth?.plugins?.admin?.defaultRole ?? 'user',
       })

       return user
     })
   ```

2. **Better Auth Integration**:
   - Pass `role` to Better Auth's `signUp` via `additionalFields`
   - Or use organization plugin's role assignment

3. **Audit Logging** (future):
   - Event type: `auth.user.created`
   - Metadata includes: assigned role, created by (admin vs. self-registration)

### Better Auth Compatibility

**Uses existing Better Auth patterns**:

Option 1: Organization plugin (recommended):

```typescript
// Better Auth automatically handles org roles
await betterAuth.signUp.email({
  email,
  password,
  name,
  // Organization role is assigned via plugin
})
```

Option 2: User additionalFields:

```typescript
// Store app-level role in user table
await betterAuth.signUp.email({
  email,
  password,
  name,
  additionalFields: {
    role: 'admin', // Custom role from auth.roles
  },
})
```

### Implementation Complexity

**Low** (2-3 hours)

**Why low**:

- Zod schema change (simple optional field)
- Application layer validation (straightforward logic)
- Better Auth already supports custom fields
- No database migration (uses existing user table)

**Implementation checklist**:

- [ ] Update `signUpRequestSchema` in Zod schemas
- [ ] Add role validation in `SignUp` use case
- [ ] Create `InvalidRoleError` effect error
- [ ] Add unit tests for role validation
- [ ] Test integration with Better Auth
- [ ] Update API docs (if any)

---

## Relationship Between Features

```
┌─────────────────────────────────────────────────────────────────┐
│ App Schema Configuration (src/domain/models/app/auth/index.ts) │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│ auth: {                                                         │
│   emailAndPassword: true,                                       │
│   roles: ['admin', 'member', 'viewer'],  ◄─── Feature 2        │
│ }                                                               │
└─────────────────────────────────────────────────────────────────┘
                                │
                ┌───────────────┼───────────────┐
                ▼               ▼               ▼
┌───────────────────┐  ┌──────────────┐  ┌─────────────────┐
│ Sign-Up Endpoint  │  │ Table Perms  │  │ Audit Logging   │
│ (Feature 3)       │  │ Validation   │  │ (future)        │
│                   │  │              │  │                 │
│ POST /sign-up     │  │ Validates    │  │ Logs role       │
│ { role: 'admin' } │  │ roles exist  │  │ changes         │
└───────────────────┘  └──────────────┘  └─────────────────┘
```

```
┌─────────────────────────────────────────────────────────────────┐
│ Table Schema Configuration (src/domain/models/app/table/...)   │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│ fields: [                                                       │
│   { name: 'ssn', type: 'single-line-text',                     │
│     sensitive: true }  ◄─── Feature 1                          │
│ ]                                                               │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│ Audit Logging Middleware (future)                              │
│ - Detects fields with sensitive: true                          │
│ - Creates audit log on data access                             │
│ - Event: 'data.sensitive.accessed'                             │
└─────────────────────────────────────────────────────────────────┘
```

---

## Recommended Implementation Order

### Phase 1: Foundation (Week 1)

1. **Feature 1: `sensitive` property** (1-2 hours)
   - Lowest complexity, no dependencies
   - Enables schema definition for audit logging specs
   - No Better Auth integration needed

2. **Feature 2: `auth.roles`** (4-6 hours)
   - Medium complexity, prerequisite for Feature 3
   - Defines role vocabulary for sign-up validation
   - Decide Better Auth integration approach

### Phase 2: Integration (Week 1-2)

3. **Feature 3: `role` in sign-up** (2-3 hours)
   - Depends on Feature 2 for role validation
   - API-level change (Zod schema + use case)
   - Completes the role assignment workflow

### Phase 3: Validation & Testing (Week 2)

4. **Cross-validation logic**
   - Validate `table.permissions.roles` references exist in `auth.roles`
   - Add schema export tests
   - Integration tests with Better Auth

### Phase 4: Audit Logging (Future - Phase 1+)

5. **Implement audit logging middleware**
   - Uses `sensitive` flag to detect audit-worthy access
   - Uses `auth.roles` for permission change tracking
   - Creates `security.auditLogging` schema (separate feature)

---

## Open Questions & Decisions Needed

### Question 1: Better Auth Role Storage

**Context**: Where should `auth.roles` values be stored?

**Option A: User `additionalFields`** (Recommended)

```typescript
// Pros: Flexible, supports custom roles, no org dependency
// Cons: Requires Better Auth schema extension

user: {
  additionalFields: {
    appRole: {
      type: 'string'
    }
  }
}
```

**Option B: Map to Organization Roles**

```typescript
// Pros: No schema changes, uses Better Auth's built-in roles
// Cons: Forces organization plugin usage, less flexible

// Map auth.roles to org roles
'admin' → organization.role = 'admin'
'member' → organization.role = 'member'
```

**Recommendation**: **Option A** for flexibility, but implement mapping layer for Better Auth compatibility.

---

### Question 2: Role Hierarchy

**Context**: Should `auth.roles` support role inheritance in Phase 0?

**Option A: Simple list** (Recommended for Phase 0)

```typescript
roles: ['admin', 'member', 'viewer']
```

**Option B: Hierarchy object** (Phase 1+)

```typescript
roles: {
  admin: { inherits: ['member', 'viewer'] },
  member: { inherits: ['viewer'] },
  viewer: {}
}
```

**Recommendation**: **Option A** for Phase 0 (simple list), plan for Option B in Phase 1.

---

### Question 3: Sensitive Field Encryption

**Context**: Should `sensitive: true` automatically enable field encryption?

**Option A: Flag only** (Recommended for Phase 0)

- `sensitive` is metadata for audit logging
- Encryption is separate concern (Phase 1+)

**Option B: Auto-encrypt**

- `sensitive: true` → auto-encrypt at rest
- More secure, but complex

**Recommendation**: **Option A** - Start with audit logging flag, add encryption later.

---

## Success Criteria

### Feature 1: `sensitive` Property

- [ ] Schema compiles without errors
- [ ] All field types inherit `sensitive` property
- [ ] Unit tests pass for base field schema
- [ ] Schema export generates correct JSON
- [ ] Spec `API-SECURITY-AUDIT-004` can reference `sensitive: true`

### Feature 2: `auth.roles`

- [ ] Schema validates role name format (kebab-case, 2-50 chars)
- [ ] Non-empty array constraint enforced
- [ ] Table permissions can reference roles
- [ ] Cross-validation prevents orphaned role references
- [ ] Better Auth integration approach documented

### Feature 3: `role` in Sign-Up

- [ ] Zod schema accepts optional `role` parameter
- [ ] Application layer validates role against `auth.roles`
- [ ] Invalid role returns `InvalidRoleError`
- [ ] Role stored in Better Auth user record
- [ ] Spec `API-SECURITY-AUDIT-003` can assign roles

---

## Migration Impact

### Backward Compatibility

**All three features are backward compatible**:

- `sensitive` is optional on fields (existing schemas unaffected)
- `auth.roles` is optional in auth config (existing apps continue to work)
- `role` is optional in sign-up (existing sign-up flows unchanged)

### Database Migrations

**No migrations required** for Phase 0:

- `sensitive` is metadata (schema-only, not DB column)
- `auth.roles` stored in app schema, not database
- `role` in sign-up uses existing Better Auth user table (or `additionalFields`)

**Future migrations** (Phase 1+):

- `audit_logs` table for `security.auditLogging`
- `app_roles` table if moving away from Better Auth org roles

---

## Testing Strategy

### Unit Tests

**Feature 1: `sensitive`**

- Test `BaseFieldSchema` accepts `sensitive: true`
- Test field type schemas inherit `sensitive`
- Test `sensitive` is optional (can be omitted)

**Feature 2: `auth.roles`**

- Test role name validation (format, length)
- Test non-empty array constraint
- Test cross-validation with table permissions
- Test union type (array vs. object form - future)

**Feature 3: `role` in Sign-Up**

- Test role validation against `auth.roles`
- Test invalid role returns error
- Test default role assignment
- Test Better Auth integration

### Integration Tests

- E2E spec `API-SECURITY-AUDIT-003` (role assignment)
- E2E spec `API-SECURITY-AUDIT-004` (sensitive data access)
- Sign-up with role + table permissions with custom roles

---

## Appendix: Code Examples

### Example 1: Complete Auth Configuration

```typescript
{
  name: 'test-app',
  auth: {
    emailAndPassword: true,
    roles: ['admin', 'member', 'viewer'],  // Feature 2
  },
  tables: [{
    name: 'sensitive_records',
    fields: [
      { id: 1, name: 'id', type: 'integer', required: true },
      { id: 2, name: 'ssn', type: 'single-line-text', sensitive: true },  // Feature 1
    ],
    permissions: {
      create: { roles: ['admin'] },  // References auth.roles
      read: { roles: ['admin', 'member'] },
    }
  }]
}
```

### Example 2: Sign-Up with Role

```typescript
// Frontend (React Hook Form + Zod)
const formSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['admin', 'member', 'viewer']).optional(), // Feature 3
})

// Backend (Application Layer)
export const SignUp = (input: SignUpRequest) =>
  Effect.gen(function* () {
    const appConfig = yield* AppConfig

    // Validate role (Feature 3 integration with Feature 2)
    if (input.role) {
      const validRoles = appConfig.auth?.roles ?? []
      if (!validRoles.includes(input.role)) {
        return yield* Effect.fail(new InvalidRoleError({ role: input.role }))
      }
    }

    const user = yield* BetterAuthService.signUp(input)
    return user
  })
```

### Example 3: Audit Logging Middleware (Future)

```typescript
// Detects sensitive field access using Feature 1
export const auditLoggingMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const originalJson = res.json.bind(res)

  res.json = (data) => {
    const appConfig = getAppConfig()
    const table = detectTable(req.path) // e.g., /api/tables/sensitive_records/1

    if (table) {
      const sensitiveFields = table.fields.filter((f) => f.sensitive === true) // Feature 1

      if (sensitiveFields.length > 0) {
        // Create audit log entry
        auditLog.create({
          eventType: 'data.sensitive.accessed',
          userId: req.user.id,
          metadata: {
            tableName: table.name,
            recordId: req.params.id,
            sensitiveFields: sensitiveFields.map((f) => f.name),
          },
        })
      }
    }

    return originalJson(data)
  }

  next()
}
```

---

## Conclusion

All three missing features have clear, low-to-medium complexity implementations that follow Sovrium's "activated by key existence" principle. They integrate cleanly with existing schemas and Better Auth without breaking changes.

**Recommended next steps**:

1. **Decision**: Choose Better Auth role storage approach (Option A: `additionalFields` recommended)
2. **Implementation**: Start with Feature 1 (`sensitive` property) - quickest win
3. **Validation**: Ensure schema export works correctly after each feature
4. **Testing**: Write comprehensive unit tests before moving to next feature
5. **Documentation**: Update schema examples and API docs as features are added

This phased approach allows for incremental validation and reduces risk of integration issues.
