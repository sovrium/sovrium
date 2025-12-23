# Better Auth Implementation Roadmap

**Goal**: Achieve 85% coverage of Better Auth features through comprehensive E2E specifications

**Total Target**: 287 spec files (2,009 individual test cases)

## Overview

This roadmap defines the complete implementation plan for Better Auth E2E specifications, organized by priority and dependencies.

## Implementation Phases

### Phase 1: Organization Teams & Dynamic Roles (114 tests) - HIGH PRIORITY

**Status**: 5/114 complete (4.4%)
**Estimated Completion**: 2-3 weeks
**Dependencies**: Basic organization plugin working

#### Organization Teams (71 tests)

##### ✅ Completed (21 tests)

- `create-team/post.spec.ts` (7 tests) - Create team
- `list-teams/get.spec.ts` (7 tests) - List teams
- `add-team-member/post.spec.ts` (7 tests) - Add member to team

##### 🔨 In Progress (50 tests)

- `get-team/get.spec.ts` (7 tests)
  - Get team details by ID
  - Validate team data structure
  - Permission checks for team access
  - 404 for non-existent teams

- `update-team/patch.spec.ts` (7 tests)
  - Update team name
  - Update team description
  - Update team metadata
  - Permission checks (owner/admin only)
  - Conflict when name already exists

- `delete-team/delete.spec.ts` (7 tests)
  - Delete team by ID
  - Cascade delete team members
  - Permission checks
  - 404 for non-existent teams
  - Prevent deletion of last team (if configured)

- `remove-team-member/delete.spec.ts` (7 tests)
  - Remove member from team
  - Permission checks
  - Validation (member must be in team)
  - 404 for non-existent team/member

- `list-team-members/get.spec.ts` (7 tests)
  - List all members in team
  - Empty team returns empty array
  - Permission checks
  - Include user details in response

- `set-active-team/post.spec.ts` (7 tests)
  - Set user's active team context
  - Validate user is team member
  - Update user session
  - Clear previous active team

- `get-active-team/get.spec.ts` (7 tests)
  - Get current active team
  - Return null if no active team
  - Include team details
  - Permission checks

- `team-permissions/permissions.spec.ts` (1 test)
  - **Regression**: Full team workflow with permissions

#### Dynamic Access Control (43 tests)

##### ✅ Completed (7 tests)

- `create-role/post.spec.ts` (7 tests) - Create custom role

##### 🔨 In Progress (36 tests)

- `update-role/patch.spec.ts` (7 tests)
  - Update role name
  - Update role permissions
  - Add/remove permissions
  - Permission checks
  - Conflict validation

- `delete-role/delete.spec.ts` (7 tests)
  - Delete custom role
  - Prevent deletion of default roles
  - Cascade update member roles
  - Permission checks

- `list-roles/get.spec.ts` (7 tests)
  - List all roles (default + custom)
  - Filter by organization
  - Include permission details
  - Sort by creation date

- `assign-role/post.spec.ts` (7 tests)
  - Assign custom role to member
  - Replace existing role
  - Validate role exists
  - Permission checks

- `check-permission/post.spec.ts` (7 tests)
  - Check if user has specific permission
  - Support resource:action format
  - Include role hierarchy
  - Return boolean result

- `role-inheritance.spec.ts` (1 test)
  - **Regression**: Role hierarchy and permission inheritance

---

### Phase 2: API Keys & Admin (75 tests) - MEDIUM PRIORITY

**Status**: 1/75 complete (1.3%)
**Estimated Completion**: 2-3 weeks
**Dependencies**: Admin plugin, API key plugin

#### API Key Permissions (42 tests)

##### ✅ Completed (7 tests)

- `permissions/scoped-access.spec.ts` (7 tests) - Read/write/admin scopes

##### 🔨 Pending (35 tests)

- `permissions/resource-permissions.spec.ts` (7 tests)
  - Resource-based permission scopes
  - Granular endpoint access (e.g., `users:read`, `posts:write`)
  - Permission inheritance
  - Wildcard permissions

- `rate-limiting/sliding-window.spec.ts` (7 tests)
  - Enforce rate limits per API key
  - Sliding window algorithm
  - Different limits per scope
  - Reset on window expiry

- `rate-limiting/rate-limit-headers.spec.ts` (7 tests)
  - X-RateLimit-Limit header
  - X-RateLimit-Remaining header
  - X-RateLimit-Reset header
  - Retry-After on limit exceeded

- `expiration/expired-key.spec.ts` (7 tests)
  - Reject expired API keys
  - Return 401 Unauthorized
  - Include expiration in error message
  - Validate expiration on every request

- `expiration/auto-rotate.spec.ts` (7 tests)
  - Automatic key rotation on expiration
  - Grace period for old keys
  - Notify user of rotation
  - Update key in database

#### Admin Access Control (33 tests)

##### 🔨 Pending (33 tests)

- `admin/has-permission/post.spec.ts` (7 tests)
  - Check if user has admin permission
  - Support resource:action format
  - Admin role bypasses checks
  - Return boolean result

- `admin/custom-permissions/resource-action.spec.ts` (7 tests)
  - Define custom admin permissions
  - Resource:action format validation
  - Assign permissions to admin users
  - Check permissions in middleware

- `admin/role-management/assign-admin.spec.ts` (7 tests)
  - Assign admin role to user
  - Validate admin has permission
  - Update user role in database
  - Include audit log entry

- `admin/role-management/revoke-admin.spec.ts` (7 tests)
  - Revoke admin role from user
  - Prevent revoking last admin
  - Update user role in database
  - Include audit log entry

- `admin/impersonation/start.spec.ts` (7 tests)
  - Admin starts impersonating user
  - Create impersonation session
  - Preserve original admin session
  - Log impersonation start

- `admin/impersonation/stop.spec.ts` (7 tests)
  - Admin stops impersonating user
  - Restore original admin session
  - Clear impersonation data
  - Log impersonation end

- `admin/impersonation.spec.ts` (1 test)
  - **Regression**: Full impersonation workflow

---

### Phase 3: Configuration & Options (98 tests) - LOW PRIORITY

**Status**: 0/98 complete (0%)
**Estimated Completion**: 3-4 weeks
**Dependencies**: Organization plugin, admin plugin, 2FA plugin

#### Organization Options (28 tests)

##### 🔨 Pending (28 tests)

- `organization/options/member-limits.spec.ts` (7 tests)
  - Configure max members per organization
  - Reject invitations when limit reached
  - Update limit dynamically
  - Enforce limit on direct member add

- `organization/options/invitation-expiry.spec.ts` (7 tests)
  - Configure invitation expiration time
  - Reject expired invitations
  - Auto-delete expired invitations
  - Extend invitation expiry

- `organization/options/allowed-domains.spec.ts` (7 tests)
  - Restrict invitations to specific email domains
  - Validate email domain on invitation
  - Support multiple domains
  - Wildcard domain support

- `organization/options/creator-role.spec.ts` (7 tests)
  - Configure default role for organization creator
  - Apply role on organization creation
  - Override default role
  - Validate role exists

#### Admin Options (28 tests)

##### 🔨 Pending (28 tests)

- `admin/options/default-role.spec.ts` (7 tests)
  - Configure default user role
  - Apply role on user creation
  - Override default role
  - Validate role exists

- `admin/options/first-user-admin.spec.ts` (7 tests)
  - First user gets admin role automatically
  - Subsequent users get default role
  - Validate admin role applied
  - Include audit log entry

- `admin/ban-user.spec.ts` (7 tests)
  - Admin bans user account
  - Prevent banned user login
  - Revoke active sessions
  - Include ban reason

- `admin/unban-user.spec.ts` (7 tests)
  - Admin unbans user account
  - Restore user access
  - Include unban reason
  - Audit log entry

#### Two-Factor Authentication (42 tests)

##### 🔨 Pending (42 tests)

- `two-factor/enable/post.spec.ts` (7 tests)
  - Enable 2FA for user
  - Generate TOTP secret
  - Return QR code
  - Generate backup codes

- `two-factor/disable/post.spec.ts` (7 tests)
  - Disable 2FA for user
  - Require password confirmation
  - Invalidate TOTP secret
  - Clear backup codes

- `two-factor/verify/post.spec.ts` (7 tests)
  - Verify TOTP code during login
  - Accept valid code
  - Reject invalid code
  - Rate limit verification attempts

- `two-factor/backup-codes/post.spec.ts` (7 tests)
  - Generate new backup codes
  - Require password confirmation
  - Invalidate old codes
  - Return new codes (show once)

- `two-factor/recovery/post.spec.ts` (7 tests)
  - Use backup code for login
  - Mark code as used
  - Reject already-used codes
  - Warn when low on codes

- `two-factor/trusted-device.spec.ts` (7 tests)
  - Trust device after 2FA
  - Skip 2FA on trusted device
  - Expire trusted device after period
  - Revoke trusted device

---

### Phase 4: Advanced Features (43 tests) - FUTURE

**Status**: 0/43 complete (0%)
**Estimated Completion**: 2-3 weeks
**Dependencies**: Passkey plugin, magic link plugin, email OTP plugin

#### Passkeys/WebAuthn (21 tests)

##### 🔨 Pending (21 tests)

- `passkey/register/post.spec.ts` (7 tests)
  - Register passkey for user
  - Generate challenge
  - Verify registration response
  - Store credential

- `passkey/authenticate/post.spec.ts` (7 tests)
  - Authenticate with passkey
  - Generate authentication challenge
  - Verify authentication response
  - Create session on success

- `passkey/list/get.spec.ts` (7 tests)
  - List user's registered passkeys
  - Include credential metadata
  - Show last used date
  - Permission checks

#### Magic Link (14 tests)

##### 🔨 Pending (14 tests)

- `magic-link/send/post.spec.ts` (7 tests)
  - Send magic link to email
  - Generate unique token
  - Set expiration time
  - Send email with link

- `magic-link/verify/get.spec.ts` (7 tests)
  - Verify magic link token
  - Create session on success
  - Reject expired tokens
  - One-time use validation

#### Email OTP (8 tests)

##### 🔨 Pending (8 tests)

- `email-otp/send/post.spec.ts` (7 tests)
  - Send OTP to email
  - Generate random code
  - Set expiration time
  - Rate limit OTP sending

- `email-otp/verify/post.spec.ts` (1 test)
  - **Regression**: OTP verification workflow

---

## Implementation Guidelines

### Test Structure Requirements

Every spec file MUST include:

1. **Copyright header** (automatically added by `bun run license`)
2. **JSDoc comment** with domain, spec count, test organization
3. **6 @spec tests** covering:
   - Happy path
   - Minimal data
   - Authorization/permissions
   - Validation
   - Conflicts
   - Authentication
4. **1 @regression test** covering full workflow

### Data Quality Standards

- ✅ Complete, realistic test data
- ✅ GIVEN-WHEN-THEN comments for @spec tests
- ✅ Behavioral assertions (not structure-only)
- ✅ Sequential spec IDs (no gaps)
- ❌ No empty arrays or placeholder values
- ❌ No TODO comments
- ❌ No ambiguous assertions

### Validation Commands

Before marking phase complete:

```bash
# Analyze all specs
bun run scripts/analyze-specs.ts

# Expected: 0 errors, 0 warnings

# Run specific phase tests
bun test:e2e -- specs/api/auth/organization/teams
bun test:e2e -- specs/api/auth/organization/dynamic-roles
```

## Progress Tracking

| Phase       | Tests   | Status             | Completion       |
| ----------- | ------- | ------------------ | ---------------- |
| **Phase 1** | 114     | 🔨 In Progress     | 5/114 (4.4%)     |
| **Phase 2** | 75      | ⏳ Pending         | 1/75 (1.3%)      |
| **Phase 3** | 98      | ⏳ Pending         | 0/98 (0%)        |
| **Phase 4** | 43      | ⏳ Pending         | 0/43 (0%)        |
| **TOTAL**   | **287** | 🔨 **In Progress** | **6/287 (2.1%)** |

## Estimated Timeline

**Total Effort**: 10-13 weeks (assuming 1 developer)

- **Phase 1**: 2-3 weeks (Organization teams + dynamic roles)
- **Phase 2**: 2-3 weeks (API keys + admin)
- **Phase 3**: 3-4 weeks (Configuration + 2FA)
- **Phase 4**: 2-3 weeks (Passkeys + magic link + email OTP)

## Success Criteria

Implementation is complete when:

- ✅ All 287 spec files created
- ✅ All tests have `test.fixme()` markers
- ✅ All specs pass `bun run scripts/analyze-specs.ts` with 0 errors/warnings
- ✅ Sequential spec IDs with no gaps
- ✅ GIVEN-WHEN-THEN comments in all @spec tests
- ✅ Realistic test data (no empty arrays or TODOs)
- ✅ One @regression test per feature

## Next Actions

### Immediate (This Week)

1. Complete Phase 1 organization teams (50 tests)
2. Complete Phase 1 dynamic roles (36 tests)
3. Validate all Phase 1 specs with analyzer
4. Handoff Phase 1 to e2e-test-fixer

### Short Term (Next 2 Weeks)

1. Begin Phase 2 API key permissions (35 tests)
2. Begin Phase 2 admin access control (33 tests)
3. Update SPEC-PROGRESS.md with new test counts

### Medium Term (Next Month)

1. Complete Phase 2
2. Begin Phase 3 configuration options
3. Begin Phase 3 two-factor authentication

### Long Term (Next Quarter)

1. Complete Phase 3
2. Complete Phase 4 advanced features
3. Achieve 85% Better Auth coverage
4. Comprehensive integration testing

## Resources

- **TDD Pipeline**: `@docs/development/tdd-automation-pipeline.md`
- **Better Auth Docs**: `@docs/infrastructure/framework/better-auth.md`
- **Fixture Reference**: `specs/fixtures.ts`
- **Implementation Summary**: `BETTER-AUTH-SPEC-IMPLEMENTATION.md`
- **Spec Progress**: `SPEC-PROGRESS.md`

---

**Created**: 2025-01-15
**Last Updated**: 2025-01-15
**Maintained By**: Claude Code (Spec Architect)
