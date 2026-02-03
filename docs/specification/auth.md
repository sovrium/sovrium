# Auth Specification

> Authentication configuration for Better Auth integration

## Overview

The Auth configuration provides comprehensive authentication for Sovrium applications via Better Auth. It supports multiple authentication methods (email/password, magic link, OAuth), plugins (admin, two-factor), and customizable email templates.

**Vision Alignment**: Auth enables Sovrium's secure, configuration-driven authentication without requiring custom authentication code.

## Schema Structure

**Location**: `src/domain/models/app/auth/`

```
auth/
├── index.ts                     # AuthSchema (main config)
├── config.ts                    # Email templates
├── validation.ts                # Cross-field validation
├── methods/
│   ├── index.ts                 # Method exports
│   ├── email-and-password.ts    # Credential auth
│   └── magic-link.ts            # Passwordless auth
├── oauth/
│   ├── index.ts                 # OAuth exports
│   └── providers.ts             # Provider definitions
└── plugins/
    ├── index.ts                 # Plugin exports
    ├── admin.ts                 # Admin plugin
    └── two-factor.ts            # 2FA plugin
```

---

## AuthSchema

**Location**: `src/domain/models/app/auth/index.ts`

Root authentication configuration. If present, authentication is enabled. If omitted, no auth endpoints are available.

| Property           | Type                                  | Required | Description             |
| ------------------ | ------------------------------------- | -------- | ----------------------- |
| `emailAndPassword` | `boolean` \| `EmailAndPasswordConfig` | No       | Credential-based auth   |
| `magicLink`        | `boolean` \| `MagicLinkConfig`        | No       | Passwordless email auth |
| `oauth`            | `OAuthConfig`                         | No       | Social login providers  |
| `admin`            | `boolean` \| `AdminConfig`            | No       | Admin plugin            |
| `twoFactor`        | `boolean` \| `TwoFactorConfig`        | No       | Two-factor auth         |
| `emailTemplates`   | `EmailTemplates`                      | No       | Custom email content    |

### Validation Rules

1. **At least one method required**: Must enable `emailAndPassword`, `magicLink`, or `oauth`
2. **Two-factor requires credentials**: `twoFactor` requires `emailAndPassword` to be enabled
3. **OAuth requires providers**: If `oauth` is set, `providers` array must not be empty

---

## Authentication Methods

### Email and Password

**Location**: `src/domain/models/app/auth/methods/email-and-password.ts`

Traditional credential-based authentication.

| Property                   | Type      | Required | Default | Description                 |
| -------------------------- | --------- | -------- | ------- | --------------------------- |
| `requireEmailVerification` | `boolean` | No       | `false` | Verify email before sign-in |
| `minPasswordLength`        | `number`  | No       | `8`     | Minimum password (6-128)    |
| `maxPasswordLength`        | `number`  | No       | `128`   | Maximum password (8-256)    |

**Simple Enable**:

```yaml
auth:
  emailAndPassword: true
```

**With Configuration**:

```yaml
auth:
  emailAndPassword:
    requireEmailVerification: true
    minPasswordLength: 12
```

### Magic Link

**Location**: `src/domain/models/app/auth/methods/magic-link.ts`

Passwordless authentication via email link.

| Property            | Type     | Required | Default | Description          |
| ------------------- | -------- | -------- | ------- | -------------------- |
| `expirationMinutes` | `number` | No       | `15`    | Link expiration time |

**Simple Enable**:

```yaml
auth:
  magicLink: true
```

**With Configuration**:

```yaml
auth:
  magicLink:
    expirationMinutes: 30
```

### OAuth (Social Login)

**Location**: `src/domain/models/app/auth/oauth/providers.ts`

Social login with OAuth providers.

| Property    | Type              | Required | Description             |
| ----------- | ----------------- | -------- | ----------------------- |
| `providers` | `OAuthProvider[]` | Yes      | Array of provider names |

**Supported Providers**:

| Provider    | Environment Variables                            | Use Case              |
| ----------- | ------------------------------------------------ | --------------------- |
| `google`    | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`       | Workspace integration |
| `github`    | `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`       | Developer auth        |
| `microsoft` | `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` | Enterprise/Azure AD   |
| `slack`     | `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`         | Workspace teams       |
| `gitlab`    | `GITLAB_CLIENT_ID`, `GITLAB_CLIENT_SECRET`       | Developer/CI-CD       |

**Configuration**:

```yaml
auth:
  oauth:
    providers:
      - google
      - github
```

---

## Plugins

### Admin Plugin

**Location**: `src/domain/models/app/auth/plugins/admin.ts`

User management and administrative features.

| Property            | Type                            | Required | Description                      |
| ------------------- | ------------------------------- | -------- | -------------------------------- |
| `impersonation`     | `boolean`                       | No       | Allow admin to impersonate users |
| `userManagement`    | `boolean`                       | No       | Enable user CRUD operations      |
| `firstUserAdmin`    | `boolean`                       | No       | First user becomes admin         |
| `defaultRole`       | `'admin'`\|`'user'`\|`'viewer'` | No       | Default role for new users       |
| `customPermissions` | `Record<string, string[]>`      | No       | Resource:action permissions      |
| `roleManagement`    | `RoleManagement`                | No       | Role assignment config           |

**Simple Enable**:

```yaml
auth:
  emailAndPassword: true
  admin: true
```

**With Configuration**:

```yaml
auth:
  emailAndPassword: true
  admin:
    impersonation: true
    userManagement: true
    firstUserAdmin: true
    defaultRole: user
    customPermissions:
      posts: [create, read, update, delete]
      analytics: [read]
    roleManagement:
      assignAdmin: true
      revokeAdmin: true
      preventSelfRevocation: true
```

**Environment Variables**:

```bash
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=secure-password
ADMIN_NAME=Admin User
```

### Two-Factor Authentication

**Location**: `src/domain/models/app/auth/plugins/two-factor.ts`

TOTP-based two-factor authentication.

| Property      | Type      | Required | Default  | Description                    |
| ------------- | --------- | -------- | -------- | ------------------------------ |
| `issuer`      | `string`  | No       | App name | Shown in authenticator apps    |
| `backupCodes` | `boolean` | No       | `false`  | Generate backup codes          |
| `digits`      | `number`  | No       | `6`      | TOTP code length (4-8)         |
| `period`      | `number`  | No       | `30`     | Code rotation period (seconds) |

**Simple Enable**:

```yaml
auth:
  emailAndPassword: true
  twoFactor: true
```

**With Configuration**:

```yaml
auth:
  emailAndPassword: true
  twoFactor:
    issuer: MyApp
    backupCodes: true
    digits: 6
    period: 30
```

---

## Email Templates

**Location**: `src/domain/models/app/auth/config.ts`

Customize authentication emails with variable substitution.

### Available Templates

| Template               | Purpose                   | Variables Available         |
| ---------------------- | ------------------------- | --------------------------- |
| `verification`         | Email verification        | `$url`, `$name`, `$email`   |
| `resetPassword`        | Password reset            | `$url`, `$name`, `$email`   |
| `magicLink`            | Magic link login          | `$url`, `$name`, `$email`   |
| `emailOtp`             | One-time password         | `$code`, `$name`, `$email`  |
| `twoFactorBackupCodes` | Backup codes delivery     | `$codes`, `$name`, `$email` |
| `welcome`              | Post-verification welcome | `$name`, `$email`           |
| `accountDeletion`      | Deletion confirmation     | `$name`, `$email`           |

### Template Properties

| Property  | Type     | Required | Description        |
| --------- | -------- | -------- | ------------------ |
| `subject` | `string` | Yes      | Email subject line |
| `text`    | `string` | No       | Plain text body    |
| `html`    | `string` | No       | HTML body          |

**Example**:

```yaml
auth:
  emailAndPassword:
    requireEmailVerification: true
  emailTemplates:
    verification:
      subject: Verify your email for MyApp
      text: Hi $name, click here to verify your email: $url
      html: <p>Hi $name,</p><p>Click <a href="$url">here</a> to verify.</p>
    resetPassword:
      subject: Reset your password
      text: Click to reset your password: $url
```

---

## API Endpoints

Authentication endpoints are automatically generated at `/api/auth/*`:

### Core Endpoints

| Endpoint                    | Method | Description            |
| --------------------------- | ------ | ---------------------- |
| `/api/auth/sign-up/email`   | POST   | Register with email    |
| `/api/auth/sign-in/email`   | POST   | Login with credentials |
| `/api/auth/sign-out`        | POST   | End current session    |
| `/api/auth/get-session`     | GET    | Get current session    |
| `/api/auth/update-user`     | POST   | Update user profile    |
| `/api/auth/change-password` | POST   | Change password        |
| `/api/auth/change-email`    | POST   | Change email address   |

### Email Verification

| Endpoint                            | Method | Description         |
| ----------------------------------- | ------ | ------------------- |
| `/api/auth/verify-email`            | GET    | Verify email token  |
| `/api/auth/send-verification-email` | POST   | Resend verification |

### Password Reset

| Endpoint                           | Method | Description         |
| ---------------------------------- | ------ | ------------------- |
| `/api/auth/request-password-reset` | POST   | Request reset email |
| `/api/auth/reset-password`         | POST   | Reset with token    |

### Magic Link

| Endpoint                      | Method | Description       |
| ----------------------------- | ------ | ----------------- |
| `/api/auth/magic-link/send`   | POST   | Send magic link   |
| `/api/auth/magic-link/verify` | GET    | Verify magic link |

### Session Management

| Endpoint                          | Method | Description               |
| --------------------------------- | ------ | ------------------------- |
| `/api/auth/list-sessions`         | GET    | List user sessions        |
| `/api/auth/revoke-session`        | POST   | Revoke specific session   |
| `/api/auth/revoke-other-sessions` | POST   | Revoke all except current |

### Two-Factor Authentication

| Endpoint                       | Method | Description             |
| ------------------------------ | ------ | ----------------------- |
| `/api/auth/two-factor/enable`  | POST   | Enable 2FA (returns QR) |
| `/api/auth/two-factor/disable` | POST   | Disable 2FA             |
| `/api/auth/two-factor/verify`  | POST   | Verify TOTP code        |

### Admin Endpoints

| Endpoint                              | Method | Description          |
| ------------------------------------- | ------ | -------------------- |
| `/api/auth/admin/list-users`          | GET    | List all users       |
| `/api/auth/admin/get-user`            | GET    | Get user by ID       |
| `/api/auth/admin/create-user`         | POST   | Create new user      |
| `/api/auth/admin/set-role`            | POST   | Set user role        |
| `/api/auth/admin/set-user-password`   | POST   | Set user password    |
| `/api/auth/admin/impersonate-user`    | POST   | Impersonate user     |
| `/api/auth/admin/stop-impersonating`  | POST   | Stop impersonation   |
| `/api/auth/admin/list-user-sessions`  | GET    | List user's sessions |
| `/api/auth/admin/revoke-user-session` | POST   | Revoke user session  |

---

## E2E Test Coverage

| Category            | Spec Files | Tests | Status   |
| ------------------- | ---------- | ----- | -------- |
| Sign Up/Sign In     | 3          | ~20   | 🟢 100%  |
| Session Management  | 4          | ~25   | 🟢 100%  |
| Password Operations | 4          | ~25   | 🟢 100%  |
| Email Verification  | 2          | ~15   | 🟢 100%  |
| Magic Link          | 2          | ~15   | 🟢 100%  |
| Two-Factor Auth     | 3          | ~20   | 🟢 100%  |
| Admin Operations    | 11         | ~60   | 🟡 76%   |
| Rate Limiting       | 1          | ~5    | 🟡 fixme |
| Enforcement         | 1          | ~5    | 🟡 fixme |

**Total**: 34 spec files, ~190 tests

---

## Implementation Status

**Overall**: 🟡 76%

| Component          | Status | Notes                       |
| ------------------ | ------ | --------------------------- |
| Email & Password   | ✅     | Full credential auth        |
| Magic Link         | ✅     | Passwordless flow           |
| OAuth Providers    | ✅     | 5 providers supported       |
| Session Management | ✅     | List, revoke, multi-session |
| Email Verification | ✅     | With custom templates       |
| Password Reset     | ✅     | With custom templates       |
| Admin Plugin       | 🟡     | Core features complete      |
| Two-Factor Auth    | ✅     | TOTP with backup codes      |
| Rate Limiting      | 🟡     | Basic implementation        |

---

## Environment Variables

Infrastructure configuration via environment variables:

| Variable                   | Required  | Description                   |
| -------------------------- | --------- | ----------------------------- |
| `AUTH_SECRET`              | Yes       | Secret key for signing tokens |
| `BASE_URL`                 | No        | Base URL for email links      |
| `ADMIN_EMAIL`              | No        | Default admin email           |
| `ADMIN_PASSWORD`           | No        | Default admin password        |
| `ADMIN_NAME`               | No        | Default admin display name    |
| `{PROVIDER}_CLIENT_ID`     | Per OAuth | OAuth client ID               |
| `{PROVIDER}_CLIENT_SECRET` | Per OAuth | OAuth client secret           |

---

## Use Cases

### Example 1: Minimal (Email/Password Only)

```yaml
auth:
  emailAndPassword: true
```

### Example 2: With Email Verification

```yaml
auth:
  emailAndPassword:
    requireEmailVerification: true
    minPasswordLength: 12
```

### Example 3: OAuth Only

```yaml
auth:
  oauth:
    providers:
      - google
      - github
```

### Example 4: Enterprise Setup

```yaml
auth:
  emailAndPassword:
    requireEmailVerification: true
    minPasswordLength: 12
  magicLink: true
  oauth:
    providers:
      - google
      - microsoft
  admin:
    impersonation: true
    userManagement: true
    firstUserAdmin: true
    defaultRole: user
  twoFactor:
    issuer: MyCompany
    backupCodes: true
  emailTemplates:
    verification:
      subject: Verify your $name account
      text: Click to verify: $url
    resetPassword:
      subject: Reset your password
      text: Password reset link: $url
```

### Example 5: Social Login with Email Backup

```yaml
auth:
  emailAndPassword: true
  oauth:
    providers:
      - google
      - github
      - slack
  emailTemplates:
    welcome:
      subject: Welcome to MyApp!
      text: Hi $name, thanks for signing up!
```

---

## Related Features

- [Tables](./tables.md) - User-related tables with permissions
- [API](./api.md) - REST API endpoints

## Related Documentation

- [Better Auth](../infrastructure/framework/better-auth.md) - Full library documentation
- [Authorization Patterns](../architecture/patterns/authorization-overview.md) - RBAC patterns
- [Nodemailer](../infrastructure/email/nodemailer.md) - Email sending
