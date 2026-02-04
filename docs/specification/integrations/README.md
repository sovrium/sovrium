# Integrations Domain

> User stories for Integrations (Connected Accounts) - external service connections in Sovrium applications. Integrations enable OAuth-based connections to third-party services for authentication and data access.

---

## Feature Areas

| Feature Area       | Description                                      | Role Files                         |
| ------------------ | ------------------------------------------------ | ---------------------------------- |
| oauth-connections  | OAuth integration configuration and token flows  | as-developer, as-end-user          |
| connected-accounts | Admin management of OAuth integrations           | as-app-administrator, as-developer |
| capabilities       | Integration features (auth, sync, triggers, API) | as-developer, as-app-administrator |
| services           | Supported external service providers             | as-developer                       |

---

## Coverage Summary

| Feature Area       | Stories | Complete | Partial | Not Started | Coverage |
| ------------------ | ------- | -------- | ------- | ----------- | -------- |
| oauth-connections  | 7       | 0        | 0       | 7           | 0%       |
| connected-accounts | 7       | 0        | 0       | 7           | 0%       |
| capabilities       | 7       | 0        | 0       | 7           | 0%       |
| services           | 5       | 0        | 0       | 5           | 0%       |

**Total**: 26 stories, 0 complete, 0 partial, 26 not started (0% complete)

---

## Schema Paths

- **OAuth Connections**: `src/domain/models/integrations/oauth/`
- **Connected Accounts**: `src/domain/models/integrations/accounts/`
- **Capabilities**: `src/domain/models/integrations/capabilities/`
- **Services**: `src/domain/models/integrations/services/`

## Spec Paths

- **API Specs**: `specs/api/integrations/`
- **App Specs**: `specs/app/integrations/`

---

> **Navigation**: [← Back to Specification](../README.md)
