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

| ID     | Criterion                                                                               | E2E Spec | Status |
| ------ | --------------------------------------------------------------------------------------- | -------- | ------ |
| AC-001 | `strategies` accepts an array of strategy objects with `type` field                     |          |        |
| AC-002 | Supported strategy types: `emailAndPassword`, `magicLink`, `oauth`                      |          |        |
| AC-003 | Each strategy type has its own configuration options (e.g., `minPasswordLength`)        |          |        |
| AC-004 | Schema validates at least one strategy is defined                                       |          |        |
| AC-005 | Duplicate strategy types trigger validation error                                       |          |        |
| AC-006 | Unknown strategy types trigger validation error                                         |          |        |
| AC-007 | Strategy-specific options are validated per type (e.g., `providers` required for oauth) |          |        |
| AC-008 | `emailAndPassword` defaults: `minPasswordLength: 8`, `autoSignIn: true`                 |          |        |

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

---

## Coverage Summary

| User Story             | Title                     | Spec Count | Status  |
| ---------------------- | ------------------------- | ---------- | ------- |
| US-AUTH-STRATEGIES-001 | Configure Auth Strategies | 8          | Pending |
| **Total**              |                           | **8**      |         |
