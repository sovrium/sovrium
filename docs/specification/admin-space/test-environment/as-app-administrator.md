# Admin Space > Test Environment > As App Administrator

> **Domain**: admin-space
> **Feature Area**: test-environment
> **Role**: App Administrator
> **Schema Path**: `src/domain/models/admin-space/staging/`
> **Spec Path**: `specs/app/admin-space/staging/`

---

## User Stories

### US-ADMIN-STAGING-ADMIN-001: Approval Gates

**Story**: As an app administrator, I want approval gates before publishing to production so that changes are reviewed.

**Status**: `[ ]` Not Started

#### Acceptance Criteria

| ID     | Criterion                                      | Spec Test                        | Schema          | Status |
| ------ | ---------------------------------------------- | -------------------------------- | --------------- | ------ |
| AC-001 | Approval required before production deployment | `APP-ADMIN-STAGING-APPROVAL-001` | `admin.staging` | `[ ]`  |
| AC-002 | Multiple approvers can be configured           | `APP-ADMIN-STAGING-APPROVAL-002` | `admin.staging` | `[ ]`  |
| AC-003 | Approval history tracked                       | `APP-ADMIN-STAGING-APPROVAL-003` | `admin.staging` | `[ ]`  |
| AC-004 | Returns 401 without authentication             | `APP-ADMIN-STAGING-APPROVAL-004` | `admin.staging` | `[ ]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/admin-space/staging/approval.ts` `[ ] Needs Creation`
- **E2E Spec**: `specs/app/admin-space/staging/approval.spec.ts` `[ ] Needs Creation`
- **UI Route**: `/admin/staging/approvals` `[ ] Not Implemented`

---

### US-ADMIN-STAGING-ADMIN-002: Environment Status

**Story**: As an app administrator, I want to see which version is deployed in each environment so that I know the current state.

**Status**: `[ ]` Not Started

#### Acceptance Criteria

| ID     | Criterion                                   | Spec Test                      | Schema          | Status |
| ------ | ------------------------------------------- | ------------------------------ | --------------- | ------ |
| AC-001 | Environment overview shows all environments | `APP-ADMIN-STAGING-STATUS-001` | `admin.staging` | `[ ]`  |
| AC-002 | Each environment shows deployed version     | `APP-ADMIN-STAGING-STATUS-002` | `admin.staging` | `[ ]`  |
| AC-003 | Version mismatch highlighted                | `APP-ADMIN-STAGING-STATUS-003` | `admin.staging` | `[ ]`  |
| AC-004 | Returns 401 without authentication          | `APP-ADMIN-STAGING-STATUS-004` | `admin.staging` | `[ ]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/admin-space/staging/status.ts` `[ ] Needs Creation`
- **E2E Spec**: `specs/app/admin-space/staging/status.spec.ts` `[ ] Needs Creation`

---

## Coverage Summary

| Story ID                   | Title              | Status            | Criteria Met |
| -------------------------- | ------------------ | ----------------- | ------------ |
| US-ADMIN-STAGING-ADMIN-001 | Approval Gates     | `[ ]` Not Started | 0/4          |
| US-ADMIN-STAGING-ADMIN-002 | Environment Status | `[ ]` Not Started | 0/4          |

**Total**: 0 complete, 0 partial, 2 not started (0% complete)

---

> **Navigation**: [← Back to Admin Space Domain](../README.md) | [← Test Environment as Developer](./as-developer.md)
