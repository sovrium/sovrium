# Authentication Domain

> **Domain**: auth
> **Schema Path**: `src/domain/models/app/auth/`
> **Spec Path**: `specs/api/auth/`

---

## Overview

Authentication handles user identity, access management, and security features in Sovrium applications. This domain covers everything from basic email/password login to advanced features like two-factor authentication, session management, and administrative user controls.

## Feature Areas

| Feature Area                                         | Description                                                   | Role-Based Stories                 |
| ---------------------------------------------------- | ------------------------------------------------------------- | ---------------------------------- |
| [user-management/](./user-management/)               | User listing, invitations, role assignment, account lifecycle | as-app-administrator, as-developer |
| [authentication-methods/](./authentication-methods/) | Email/password, OAuth, magic link, SSO configuration          | as-developer, as-end-user          |
| [sessions-security/](./sessions-security/)           | Session duration, logout, active sessions, security features  | as-developer, as-end-user          |
| [authorization/](./authorization/)                   | Roles, permissions, field-level access, page access           | as-developer, as-app-administrator |
| [admin-plugin/](./admin-plugin/)                     | Better Auth admin plugin features                             | as-app-administrator               |

## Domain Schema Structure

```
src/domain/models/app/auth/
├── index.ts                     # Main auth schema export
├── config.ts                    # Auth configuration schema
├── validation.ts                # Auth validation rules
├── methods/
│   ├── index.ts                 # Auth methods aggregation
│   ├── email-and-password.ts    # Email/password config
│   └── magic-link.ts            # Magic link config
├── oauth/
│   ├── index.ts                 # OAuth config
│   └── providers.ts             # OAuth providers schema
└── plugins/
    ├── index.ts                 # Plugins aggregation
    ├── admin.ts                 # Admin plugin config
    └── two-factor.ts            # 2FA config
```

## API Endpoints

| Endpoint                              | Method | Feature Area           | Spec Path                                   |
| ------------------------------------- | ------ | ---------------------- | ------------------------------------------- |
| `/api/auth/sign-up/email`             | POST   | authentication-methods | `specs/api/auth/sign-up/email/`             |
| `/api/auth/sign-in/email`             | POST   | authentication-methods | `specs/api/auth/sign-in/email/`             |
| `/api/auth/sign-out`                  | POST   | sessions-security      | `specs/api/auth/sign-out/`                  |
| `/api/auth/get-session`               | GET    | sessions-security      | `specs/api/auth/get-session/`               |
| `/api/auth/list-sessions`             | GET    | sessions-security      | `specs/api/auth/list-sessions/`             |
| `/api/auth/revoke-session`            | POST   | sessions-security      | `specs/api/auth/revoke-session/`            |
| `/api/auth/revoke-other-sessions`     | POST   | sessions-security      | `specs/api/auth/revoke-other-sessions/`     |
| `/api/auth/magic-link/send`           | POST   | authentication-methods | `specs/api/auth/magic-link/send/`           |
| `/api/auth/magic-link/verify`         | GET    | authentication-methods | `specs/api/auth/magic-link/verify/`         |
| `/api/auth/update-user`               | POST   | user-management        | `specs/api/auth/update-user/`               |
| `/api/auth/change-password`           | POST   | sessions-security      | `specs/api/auth/change-password/`           |
| `/api/auth/change-email`              | POST   | user-management        | `specs/api/auth/change-email/`              |
| `/api/auth/request-password-reset`    | POST   | authentication-methods | `specs/api/auth/request-password-reset/`    |
| `/api/auth/reset-password`            | POST   | authentication-methods | `specs/api/auth/reset-password/`            |
| `/api/auth/send-verification-email`   | POST   | authentication-methods | `specs/api/auth/send-verification-email/`   |
| `/api/auth/verify-email`              | GET    | authentication-methods | `specs/api/auth/verify-email/`              |
| `/api/auth/two-factor/enable`         | POST   | sessions-security      | `specs/api/auth/two-factor/enable/`         |
| `/api/auth/two-factor/disable`        | POST   | sessions-security      | `specs/api/auth/two-factor/disable/`        |
| `/api/auth/two-factor/verify`         | POST   | sessions-security      | `specs/api/auth/two-factor/verify/`         |
| `/api/auth/admin/list-users`          | GET    | admin-plugin           | `specs/api/auth/admin/list-users/`          |
| `/api/auth/admin/get-user`            | GET    | admin-plugin           | `specs/api/auth/admin/get-user/`            |
| `/api/auth/admin/create-user`         | POST   | admin-plugin           | `specs/api/auth/admin/create-user/`         |
| `/api/auth/admin/set-role`            | POST   | admin-plugin           | `specs/api/auth/admin/set-role/`            |
| `/api/auth/admin/set-user-password`   | POST   | admin-plugin           | `specs/api/auth/admin/set-user-password/`   |
| `/api/auth/admin/list-user-sessions`  | GET    | admin-plugin           | `specs/api/auth/admin/list-user-sessions/`  |
| `/api/auth/admin/revoke-user-session` | POST   | admin-plugin           | `specs/api/auth/admin/revoke-user-session/` |
| `/api/auth/admin/impersonate-user`    | POST   | admin-plugin           | `specs/api/auth/admin/impersonate-user/`    |
| `/api/auth/admin/stop-impersonating`  | POST   | admin-plugin           | `specs/api/auth/admin/stop-impersonating/`  |

## Coverage Summary

| Feature Area           | Implemented | Partial | Not Started | Total  |
| ---------------------- | ----------- | ------- | ----------- | ------ |
| user-management        | 3           | 0       | 4           | 7      |
| authentication-methods | 9           | 0       | 1           | 10     |
| sessions-security      | 10          | 1       | 2           | 13     |
| authorization          | 7           | 0       | 1           | 8      |
| admin-plugin           | 2           | 0       | 4           | 6      |
| **Total**              | **31**      | **1**   | **12**      | **44** |

---

> **Navigation**: [← Back to Specification Root](../README.md)
