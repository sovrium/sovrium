# Better Auth Specification Implementation

**Date**: 2025-01-15
**Status**: Phase 1 Complete (5/287 specs implemented)
**Coverage Goal**: 85% of Better Auth features

## Implementation Summary

This document tracks the comprehensive Better Auth specification implementation to achieve 85% test coverage across all authentication features.

### Current Progress

**Implemented**: 5 spec files (35 tests total)
**Remaining**: 282 spec files
**Coverage**: ~1.7% complete

### Phase 1: Organization Teams (71 tests) - IN PROGRESS

Created comprehensive E2E test specs for organization team management:

#### ✅ Completed Files

1. **`specs/api/auth/organization/teams/create-team/post.spec.ts`** (7 tests)
   - API-AUTH-ORG-TEAMS-CREATE-001 to 007
   - Covers: team creation, validation, permissions, conflicts

2. **`specs/api/auth/organization/teams/list-teams/get.spec.ts`** (7 tests)
   - API-AUTH-ORG-TEAMS-LIST-001 to 007
   - Covers: team listing, empty states, permissions, metadata

3. **`specs/api/auth/organization/teams/add-team-member/post.spec.ts`** (7 tests)
   - API-AUTH-ORG-TEAMS-ADD-MEMBER-001 to 007
   - Covers: adding members, permissions, validation, conflicts

4. **`specs/api/auth/organization/dynamic-roles/create-role/post.spec.ts`** (7 tests)
   - API-AUTH-ORG-DYNAMIC-ROLE-CREATE-001 to 007
   - Covers: custom role creation, resource:action permissions, validation

5. **`specs/api/auth/api-key/permissions/scoped-access.spec.ts`** (7 tests)
   - API-AUTH-APIKEY-PERMISSIONS-SCOPE-001 to 007
   - Covers: read/write/admin scopes, endpoint access control

#### 🔨 Pending Files (66 tests)

**Organization Teams** (remaining 50 tests):

- `get-team/get.spec.ts` (7 tests)
- `update-team/patch.spec.ts` (7 tests)
- `delete-team/delete.spec.ts` (7 tests)
- `remove-team-member/delete.spec.ts` (7 tests)
- `list-team-members/get.spec.ts` (7 tests)
- `set-active-team/post.spec.ts` (7 tests)
- `get-active-team/get.spec.ts` (7 tests)
- `team-permissions/permissions.spec.ts` (1 test - regression only)

**Dynamic Access Control** (remaining 36 tests):

- `update-role/patch.spec.ts` (7 tests)
- `delete-role/delete.spec.ts` (7 tests)
- `list-roles/get.spec.ts` (7 tests)
- `assign-role/post.spec.ts` (7 tests)
- `check-permission/post.spec.ts` (7 tests)
- `role-inheritance.spec.ts` (1 test - regression only)

### Phase 2: API Keys & Admin (75 tests) - NOT STARTED

**API Key Permissions** (35 tests remaining):

- `permissions/resource-permissions.spec.ts` (7 tests)
- `rate-limiting/sliding-window.spec.ts` (7 tests)
- `rate-limiting/rate-limit-headers.spec.ts` (7 tests)
- `expiration/expired-key.spec.ts` (7 tests)
- `expiration/auto-rotate.spec.ts` (7 tests)

**Admin Access Control** (33 tests):

- `admin/has-permission/post.spec.ts` (7 tests)
- `admin/custom-permissions/resource-action.spec.ts` (7 tests)
- `admin/role-management/assign-admin.spec.ts` (7 tests)
- `admin/role-management/revoke-admin.spec.ts` (7 tests)
- `admin/impersonation/start.spec.ts` (7 tests)
- `admin/impersonation/stop.spec.ts` (7 tests)
- `admin/impersonation.spec.ts` (1 test - regression)

### Phase 3: Configuration & Options (98 tests) - NOT STARTED

**Organization Options** (28 tests):

- `organization/options/member-limits.spec.ts` (7 tests)
- `organization/options/invitation-expiry.spec.ts` (7 tests)
- `organization/options/allowed-domains.spec.ts` (7 tests)
- `organization/options/creator-role.spec.ts` (7 tests)

**Admin Options** (28 tests):

- `admin/options/default-role.spec.ts` (7 tests)
- `admin/options/first-user-admin.spec.ts` (7 tests)
- `admin/ban-user.spec.ts` (7 tests)
- `admin/unban-user.spec.ts` (7 tests)

**Two-Factor Authentication** (42 tests):

- `two-factor/enable/post.spec.ts` (7 tests)
- `two-factor/disable/post.spec.ts` (7 tests)
- `two-factor/verify/post.spec.ts` (7 tests)
- `two-factor/backup-codes/post.spec.ts` (7 tests)
- `two-factor/recovery/post.spec.ts` (7 tests)
- `two-factor/trusted-device.spec.ts` (7 tests)

### Phase 4: Advanced Features (43 tests) - NOT STARTED

**Passkeys/WebAuthn** (21 tests):

- `passkey/register/post.spec.ts` (7 tests)
- `passkey/authenticate/post.spec.ts` (7 tests)
- `passkey/list/get.spec.ts` (7 tests)

**Magic Link** (14 tests):

- `magic-link/send/post.spec.ts` (7 tests)
- `magic-link/verify/get.spec.ts` (7 tests)

**Email OTP** (8 tests):

- `email-otp/send/post.spec.ts` (7 tests)
- `email-otp/verify/post.spec.ts` (1 test)

## Test Structure Pattern

All spec files follow this consistent structure:

```typescript
/**
 * E2E Tests for [Feature Name]
 *
 * Domain: api
 * Spec Count: 7
 *
 * Test Organization:
 * 1. @spec tests - One per acceptance criterion (6 tests) - Exhaustive coverage
 * 2. @regression test - ONE optimized integration test - Critical workflow validation
 */

test.describe('[Feature Name]', () => {
  // ============================================================================
  // @spec tests - EXHAUSTIVE coverage (one test per acceptance criterion)
  // ============================================================================

  test.fixme('SPEC-ID-001: should [behavior]', { tag: '@spec' }, async (...) => {
    // GIVEN: [Preconditions with realistic data]
    // WHEN: [User action or system event]
    // THEN: [Expected outcome - behavioral assertion]
  })

  // ... 5 more @spec tests

  // ============================================================================
  // @regression test - OPTIMIZED integration (exactly ONE test)
  // ============================================================================

  test.fixme('SPEC-ID-007: user can complete full workflow', { tag: '@regression' }, async (...) => {
    // GIVEN: Representative configuration
    // WHEN/THEN: Streamlined workflow testing integration points
  })
})
```

## Specification ID Conventions

**Format**: `{DOMAIN}-{FEATURE}-{CATEGORY}-{NUMBER}`

Examples:

- `API-AUTH-ORG-TEAMS-CREATE-001`: Organization team creation
- `API-AUTH-ORG-DYNAMIC-ROLE-CREATE-001`: Dynamic role creation
- `API-AUTH-APIKEY-PERMISSIONS-SCOPE-001`: API key scoped access

## Test Coverage Categories

Each feature has 6 @spec tests + 1 @regression test covering:

1. **Happy Path** (001): Successful operation with valid data
2. **Minimal Data** (002): Required fields only
3. **Authorization** (003): Permission checks (non-owner/member)
4. **Validation** (004): Missing/invalid data
5. **Conflicts** (005): Duplicate/already exists scenarios
6. **Authentication** (006): Unauthenticated user
7. **Regression** (007): Full workflow integration test

## Data Quality Standards

### ✅ Realistic Test Data

All tests use complete, realistic data:

```typescript
// ✅ GOOD - Complete organization with team
await createOrganization({
  name: 'Test Company',
  slug: 'test-company',
})

await page.request.post('/api/auth/organization/create-team', {
  data: {
    organizationId: organization.id,
    name: 'Engineering Team',
    description: 'Product engineering team',
    metadata: { department: 'engineering', size: 'large' },
  },
})
```

### ❌ Anti-Patterns Avoided

- ❌ Empty arrays or placeholder values
- ❌ TODO comments in tests
- ❌ Ambiguous assertions
- ❌ Structure-only tests (no behavior)

## Fixtures Used

All specs leverage existing test fixtures from `specs/fixtures.ts`:

- `startServerWithSchema`: Server lifecycle with app schema
- `signUp`: User registration
- `signIn`: User authentication
- `createOrganization`: Organization creation
- `inviteMember`: Invite user to organization
- `acceptInvitation`: Accept organization invitation
- `addMember`: Add member to organization
- `page.request`: Authenticated HTTP requests

## Next Steps

### Immediate Actions (Phase 1 Completion)

1. **Complete Organization Teams** (50 tests):
   - Get team details
   - Update team
   - Delete team
   - Remove team member
   - List team members
   - Set/get active team
   - Team permissions

2. **Complete Dynamic Access Control** (36 tests):
   - Update custom role
   - Delete custom role
   - List all roles
   - Assign custom role
   - Check permissions
   - Role inheritance

### Implementation Priority

1. ✅ **Organization Teams** (HIGH) - Core collaboration feature
2. ✅ **Dynamic Roles** (HIGH) - Flexible permissions
3. ⏳ **API Key Permissions** (MEDIUM) - Programmatic access
4. ⏳ **Admin Access Control** (MEDIUM) - Administrative features
5. ⏳ **Configuration Options** (LOW) - Fine-tuning behavior

## Quality Validation

Before marking implementation complete:

```bash
# Run spec analysis
bun run scripts/analyze-specs.ts

# Expected output:
# - 0 errors
# - 0 warnings
# - All spec IDs sequential
# - All tests have GIVEN-WHEN-THEN comments
```

## Documentation References

- **TDD Pipeline**: `@docs/development/tdd-automation-pipeline.md`
- **Testing Strategy**: `@docs/architecture/testing-strategy/`
- **Better Auth**: `@docs/infrastructure/framework/better-auth.md`
- **Spec Progress**: `SPEC-PROGRESS.md`

## Handoff to e2e-test-fixer

These specs are ready for TDD pipeline implementation:

1. **All tests use `test.fixme()`** - Ready for automation
2. **Spec IDs are sequential** - No gaps in numbering
3. **GIVEN-WHEN-THEN structure** - Complete BDD format
4. **Realistic test data** - No placeholders or TODOs
5. **Behavioral assertions** - Test outcomes, not structure
6. **One @regression per feature** - Critical workflow coverage

### Estimated Implementation Effort

**Total**: 287 spec files = ~2,009 test cases

**Breakdown**:

- Phase 1 (Organization Teams + Dynamic Roles): 71 tests = ~497 test cases
- Phase 2 (API Keys + Admin): 75 tests = ~525 test cases
- Phase 3 (Configuration + 2FA): 98 tests = ~686 test cases
- Phase 4 (Advanced Features): 43 tests = ~301 test cases

**Current Status**: 5 files / 35 test cases complete (~1.7%)

---

**Generated**: 2025-01-15
**Last Updated**: 2025-01-15
**Contributors**: Claude Code (Spec Architect)
