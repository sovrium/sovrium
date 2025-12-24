# Auth Schema Refactoring: Flattened Plugin Structure

## Overview

This document outlines the refactoring of the auth schema structure to move plugin configurations (admin, organization, twoFactor) from a nested `plugins` object to the root level of the auth configuration.

## Motivation

The original nested structure created unnecessary complexity:

- Extra nesting for accessing plugin configuration
- Inconsistency with authentication methods (emailAndPassword, magicLink, oauth) which were already at root level
- More verbose code when checking plugin status

## Changes Made

### Before (Nested Structure)

```typescript
{
  emailAndPassword: true,
  oauth: { providers: ['google', 'github'] },
  plugins: {
    admin: { impersonation: true },
    organization: { maxMembersPerOrg: 50 },
    twoFactor: { issuer: 'MyCompany', backupCodes: true }
  }
}
```

### After (Flattened Structure)

```typescript
{
  emailAndPassword: true,
  oauth: { providers: ['google', 'github'] },
  admin: { impersonation: true },
  organization: { maxMembersPerOrg: 50 },
  twoFactor: { issuer: 'MyCompany', backupCodes: true }
}
```

## Files Modified

### 1. Domain Layer

#### `src/domain/models/app/auth/index.ts`

- **Change**: Removed `PluginsConfigSchema` import, imported individual plugin schemas directly
- **Change**: Removed `plugins` field from `AuthSchema`, added individual plugin fields at root level
- **Change**: Updated validation logic to access plugins at root level (`config.twoFactor` instead of `config.plugins?.twoFactor`)
- **Change**: Updated `hasPlugin()` helper to access plugins directly on auth object
- **Change**: Added `PluginName` type for type-safe plugin checking
- **Change**: Updated all JSDoc examples to use flattened structure
- **Impact**: All consumers of `AuthSchema` now receive flattened structure

#### `src/domain/models/app/auth/validation.ts`

- **Change**: Updated `AuthConfigForValidation` interface to have individual plugin fields instead of nested `plugins` object
- **Change**: Updated `validateTwoFactorRequiresPrimary()` to access `config.twoFactor` directly
- **Impact**: Validation functions now work with flattened structure

### 2. Infrastructure Layer

#### `src/infrastructure/auth/better-auth/auth.ts`

- **Change**: Updated `buildAdminPlugin()` to check `authConfig?.admin` instead of `authConfig?.plugins?.admin`
- **Change**: Updated `buildOrganizationPlugin()` to check `authConfig?.organization` instead of `authConfig?.plugins?.organization`
- **Change**: Updated `buildTwoFactorPlugin()` to check `authConfig?.twoFactor` instead of `authConfig?.plugins?.twoFactor`
- **Impact**: Better Auth integration now reads plugins from flattened structure

### 3. Test Files

#### `src/domain/models/app/auth/index.test.ts`

- **Change**: Updated all test cases to use flattened structure
- **Change**: Changed `plugins: { admin: true }` to `admin: true`
- **Change**: Changed `plugins: { organization: true }` to `organization: true`
- **Change**: Changed `result.plugins?.twoFactor` to `result.twoFactor`
- **Impact**: 197 tests passing with new structure

#### `src/domain/models/app/auth/validation.test.ts`

- **Change**: Updated all validation test cases to use flattened structure
- **Change**: Changed `plugins: { twoFactor: true }` to `twoFactor: true`
- **Impact**: All validation tests passing

## Backward Compatibility

### Breaking Changes

This is a **BREAKING CHANGE** for any existing auth configurations using the nested `plugins` structure.

#### Migration Guide

**Old configuration:**

```typescript
{
  emailAndPassword: true,
  plugins: {
    admin: true,
    organization: { maxMembersPerOrg: 50 }
  }
}
```

**New configuration:**

```typescript
{
  emailAndPassword: true,
  admin: true,
  organization: { maxMembersPerOrg: 50 }
}
```

#### Migration Steps

1. Locate all auth configurations in your codebase
2. Move any properties from `plugins.admin` → `admin`
3. Move any properties from `plugins.organization` → `organization`
4. Move any properties from `plugins.twoFactor` → `twoFactor`
5. Remove the `plugins` wrapper object

### Code That Needs Migration

**Domain Models:**

```typescript
// OLD
if (auth.plugins?.admin) { ... }

// NEW
if (auth.admin) { ... }
```

**Helper Functions:**

```typescript
// OLD
hasPlugin(auth, 'admin') // accessed auth.plugins?.admin

// NEW
hasPlugin(auth, 'admin') // accesses auth.admin
```

**Better Auth Integration:**

```typescript
// OLD
authConfig?.plugins?.admin

// NEW
authConfig?.admin
```

## Benefits

1. **Simpler Access**: Direct access to plugins without nested traversal
2. **Consistency**: All auth features (methods + plugins) at same level
3. **Cleaner Code**: Less nesting, more readable configuration
4. **Type Safety**: TypeScript types are simpler and more intuitive
5. **Better DX**: Autocomplete works better with flatter structure

## Testing

All tests have been updated and are passing:

- **Domain tests**: 197 tests passing
- **Unit tests**: 3768 tests passing
- **Test coverage**: No regressions detected

## Validation

The following validation rules remain intact:

1. At least one authentication method must be enabled
2. Two-factor authentication requires emailAndPassword
3. OAuth requires at least one provider

## Future Considerations

### Plugin Index File

The `src/domain/models/app/auth/plugins/index.ts` file still exists and exports the old `PluginsConfigSchema`. This could be:

- Removed entirely if no longer needed
- Kept for backward compatibility in edge cases
- Deprecated with a warning for migration

### Documentation Updates

Update the following documentation:

- `VISION.md` - Update auth examples
- `SPEC-PROGRESS.md` - Update auth configuration examples
- Any API documentation showing auth configuration

## Related Files

No changes were needed in the following files:

- `src/domain/models/app/auth/plugins/admin.ts` - Plugin schema unchanged
- `src/domain/models/app/auth/plugins/organization.ts` - Plugin schema unchanged
- `src/domain/models/app/auth/plugins/two-factor.ts` - Plugin schema unchanged
- `src/domain/models/app/auth/config.ts` - Email templates unchanged
- `src/domain/models/app/auth/methods/*.ts` - Authentication methods unchanged
- `src/domain/models/app/auth/oauth/*.ts` - OAuth configuration unchanged

## Summary

This refactoring successfully flattens the auth schema structure by moving plugin configurations (admin, organization, twoFactor) from a nested `plugins` object to the root level. All tests are passing, and the codebase is now more consistent and easier to work with.

**Total files modified**: 5
**Total tests passing**: 3768
**Breaking changes**: Yes (requires configuration migration)
**Backward compatibility**: No (this is a breaking change)
