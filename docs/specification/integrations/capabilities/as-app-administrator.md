# Integrations > Capabilities > As App Administrator

> **Domain**: integrations
> **Feature Area**: capabilities
> **Role**: App Administrator
> **Schema Path**: `src/domain/models/integrations/capabilities/`
> **Spec Path**: `specs/app/integrations/capabilities/`

---

## User Stories

### US-INTEG-CAP-ADMIN-001: Configure Available Integrations

**Story**: As an app administrator, I want to configure which integrations are available to users so that I can control what's enabled.

**Status**: `[ ]` Not Started

#### Acceptance Criteria

| ID     | Criterion                           | Spec Test                  | Schema                      | Status |
| ------ | ----------------------------------- | -------------------------- | --------------------------- | ------ |
| AC-001 | Enable/disable integrations per app | `APP-INTEG-CAP-CONFIG-001` | `integrations.capabilities` | `[ ]`  |
| AC-002 | Integration visibility controlled   | `APP-INTEG-CAP-CONFIG-002` | `integrations.capabilities` | `[ ]`  |
| AC-003 | Settings persist across sessions    | `APP-INTEG-CAP-CONFIG-003` | `integrations.capabilities` | `[ ]`  |
| AC-004 | Returns 401 without authentication  | `APP-INTEG-CAP-CONFIG-004` | `integrations.capabilities` | `[ ]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/integrations/capabilities/config.ts` `[ ] Needs Creation`
- **E2E Spec**: `specs/app/integrations/capabilities/config.spec.ts` `[ ] Needs Creation`
- **UI Route**: `/admin/integrations/settings` `[ ] Not Implemented`

---

### US-INTEG-CAP-ADMIN-002: View User Integration Usage

**Story**: As an app administrator, I want to see which users have connected which integrations so that I can understand usage.

**Status**: `[ ]` Not Started

#### Acceptance Criteria

| ID     | Criterion                           | Spec Test                 | Schema                      | Status |
| ------ | ----------------------------------- | ------------------------- | --------------------------- | ------ |
| AC-001 | User-to-integration mapping visible | `APP-INTEG-CAP-USAGE-001` | `integrations.capabilities` | `[ ]`  |
| AC-002 | Connection dates and counts shown   | `APP-INTEG-CAP-USAGE-002` | `integrations.capabilities` | `[ ]`  |
| AC-003 | Filterable by integration or user   | `APP-INTEG-CAP-USAGE-003` | `integrations.capabilities` | `[ ]`  |
| AC-004 | Returns 401 without authentication  | `APP-INTEG-CAP-USAGE-004` | `integrations.capabilities` | `[ ]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/integrations/capabilities/usage.ts` `[ ] Needs Creation`
- **E2E Spec**: `specs/app/integrations/capabilities/usage.spec.ts` `[ ] Needs Creation`

---

### US-INTEG-CAP-ADMIN-003: Integration Failure Alerts

**Story**: As an app administrator, I want alerts when integrations fail or require re-authorization so that I can take action.

**Status**: `[ ]` Not Started

#### Acceptance Criteria

| ID     | Criterion                                | Spec Test                 | Schema                      | Status |
| ------ | ---------------------------------------- | ------------------------- | --------------------------- | ------ |
| AC-001 | Alerts triggered on integration failure  | `APP-INTEG-CAP-ALERT-001` | `integrations.capabilities` | `[ ]`  |
| AC-002 | Alerts for re-authorization required     | `APP-INTEG-CAP-ALERT-002` | `integrations.capabilities` | `[ ]`  |
| AC-003 | Alert notification channels configurable | `APP-INTEG-CAP-ALERT-003` | `integrations.capabilities` | `[ ]`  |
| AC-004 | Returns 401 without authentication       | `APP-INTEG-CAP-ALERT-004` | `integrations.capabilities` | `[ ]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/integrations/capabilities/alerts.ts` `[ ] Needs Creation`
- **E2E Spec**: `specs/app/integrations/capabilities/alerts.spec.ts` `[ ] Needs Creation`

---

## Coverage Summary

| Story ID               | Title                  | Status            | Criteria Met |
| ---------------------- | ---------------------- | ----------------- | ------------ |
| US-INTEG-CAP-ADMIN-001 | Configure Integrations | `[ ]` Not Started | 0/4          |
| US-INTEG-CAP-ADMIN-002 | View User Usage        | `[ ]` Not Started | 0/4          |
| US-INTEG-CAP-ADMIN-003 | Failure Alerts         | `[ ]` Not Started | 0/4          |

**Total**: 0 complete, 0 partial, 3 not started (0% complete)

---

> **Navigation**: [← Back to Integrations Domain](../README.md) | [← Capabilities as Developer](./as-developer.md)
