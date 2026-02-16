# Auth Strategy Configuration

> **Feature Area**: Authentication - Strategy Configuration
> **Schema**: `src/domain/models/app/auth/strategies.ts`

---

## US-AUTH-STRATEGIES-001: Configure Authentication Strategies

**As a** developer building a Sovrium app,
**I want to** define authentication strategies as a list of typed objects,
**so that** I can enable and configure each strategy explicitly.

### Configuration

```yaml
auth:
  strategies:
    - type: emailAndPassword
      minPasswordLength: 12
    - type: magicLink
    - type: oauth
      providers: ['google', 'github']
```

### Acceptance Criteria

| ID     | Criterion                                                                               | E2E Spec                         | Status |
| ------ | --------------------------------------------------------------------------------------- | -------------------------------- | ------ |
| AC-001 | `strategies` accepts an array of strategy objects with `type` field                     | `APP-AUTH-STRATEGIES-001`        | ✅     |
| AC-002 | Supported strategy types: `emailAndPassword`, `magicLink`, `oauth`                      | `APP-AUTH-STRATEGIES-002`        | ✅     |
| AC-003 | Each strategy type has its own configuration options (e.g., `minPasswordLength`)        | `APP-AUTH-STRATEGIES-003`        | ✅     |
| AC-004 | Schema validates at least one strategy is defined                                       | `APP-AUTH-STRATEGIES-004`        | ✅     |
| AC-005 | Duplicate strategy types trigger validation error                                       | `APP-AUTH-STRATEGIES-005`        | ✅     |
| AC-006 | Unknown strategy types trigger validation error                                         | `APP-AUTH-STRATEGIES-006`        | ✅     |
| AC-007 | Strategy-specific options are validated per type (e.g., `providers` required for oauth) | `APP-AUTH-STRATEGIES-007`        | ✅     |
| AC-008 | `emailAndPassword` defaults: `minPasswordLength: 8`, `autoSignIn: true`                 | `APP-AUTH-STRATEGIES-008`        | ✅     |
| AC-009 | Auth strategy configuration workflow completes successfully (regression)                | `APP-AUTH-STRATEGIES-REGRESSION` | ✅     |

### Strategy Types

#### emailAndPassword

Traditional credential-based authentication.

```yaml
- type: emailAndPassword
  minPasswordLength: 12 # optional, default: 8, range: 6-128
  maxPasswordLength: 128 # optional, default: 128
  requireEmailVerification: true # optional, default: false
```

#### magicLink

Passwordless authentication via email link.

```yaml
- type: magicLink
  expirationMinutes: 30 # optional, default: 15
```

#### oauth

Social login with OAuth providers.

```yaml
- type: oauth
  providers: ['google', 'github'] # required, at least one provider
```

Supported providers: `google`, `github`, `microsoft`, `slack`, `gitlab`

### Implementation References

- **Schema**: `src/domain/models/app/auth/strategies.ts`
- **E2E Spec**: `specs/app/auth/strategies.spec.ts`

---

## Coverage Summary

| User Story             | Title                     | Spec Count | Status  |
| ---------------------- | ------------------------- | ---------- | ------- |
| US-AUTH-STRATEGIES-001 | Configure Auth Strategies | 8          | Pending |
| **Total**              |                           | **8**      |         |

### E2E Test Coverage

| Spec Test ID                     | Description                                         | Status |
| -------------------------------- | --------------------------------------------------- | ------ |
| `APP-AUTH-STRATEGIES-001`        | Strategies accept array with type field             | ⏳     |
| `APP-AUTH-STRATEGIES-002`        | Supported types: emailAndPassword, magicLink, oauth | ⏳     |
| `APP-AUTH-STRATEGIES-003`        | Each strategy has its own config options            | ⏳     |
| `APP-AUTH-STRATEGIES-004`        | At least one strategy required                      | ⏳     |
| `APP-AUTH-STRATEGIES-005`        | Duplicate strategy types rejected                   | ⏳     |
| `APP-AUTH-STRATEGIES-006`        | Unknown strategy types rejected                     | ⏳     |
| `APP-AUTH-STRATEGIES-007`        | Strategy-specific options validated                 | ⏳     |
| `APP-AUTH-STRATEGIES-008`        | emailAndPassword defaults applied                   | ⏳     |
| `APP-AUTH-STRATEGIES-REGRESSION` | Auth strategy configuration workflow successful     | ⏳     |
