# Pages > Content Blocks > As App Administrator

> **Domain**: pages
> **Feature Area**: content-blocks
> **Role**: App Administrator
> **Schema Path**: `src/domain/models/app/pages/blocks/`
> **Spec Path**: `specs/api/blocks/admin/`

---

## User Stories

### US-PAGE-BLOCK-ADMIN-001: Drag and Drop Blocks

**Story**: As an app administrator, I want to drag and drop blocks in the page builder so that I can arrange content visually.

**Status**: `[ ]` Not Started

#### Acceptance Criteria

| ID     | Criterion                            | Spec Test                 | Schema         | Status |
| ------ | ------------------------------------ | ------------------------- | -------------- | ------ |
| AC-001 | Block palette shows available blocks | `API-BLOCK-ADMIN-DND-001` | `blocks.admin` | `[ ]`  |
| AC-002 | Blocks can be dragged to page canvas | `API-BLOCK-ADMIN-DND-002` | `blocks.admin` | `[ ]`  |
| AC-003 | Block order can be changed via drag  | `API-BLOCK-ADMIN-DND-003` | `blocks.admin` | `[ ]`  |
| AC-004 | Blocks can be removed from page      | `API-BLOCK-ADMIN-DND-004` | `blocks.admin` | `[ ]`  |
| AC-005 | Returns 401 without authentication   | `API-BLOCK-ADMIN-DND-005` | `blocks.admin` | `[ ]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/pages/blocks/` `[x] Exists`
- **E2E Spec**: `specs/api/blocks/admin/dnd.spec.ts` `[ ] Needs Creation`
- **API Route**: `/api/pages/:slug/admin/blocks` `[ ] Not Implemented`

---

### US-PAGE-BLOCK-ADMIN-002: Configure Block Settings

**Story**: As an app administrator, I want to configure block settings (data source, display options) so that blocks show the right content.

**Status**: `[ ]` Not Started

#### Acceptance Criteria

| ID     | Criterion                                     | Spec Test                    | Schema         | Status |
| ------ | --------------------------------------------- | ---------------------------- | -------------- | ------ |
| AC-001 | Block settings panel opens on block selection | `API-BLOCK-ADMIN-CONFIG-001` | `blocks.admin` | `[ ]`  |
| AC-002 | Data source can be configured                 | `API-BLOCK-ADMIN-CONFIG-002` | `blocks.admin` | `[ ]`  |
| AC-003 | Display options can be configured             | `API-BLOCK-ADMIN-CONFIG-003` | `blocks.admin` | `[ ]`  |
| AC-004 | Configuration changes reflect in preview      | `API-BLOCK-ADMIN-CONFIG-004` | `blocks.admin` | `[ ]`  |
| AC-005 | Returns 401 without authentication            | `API-BLOCK-ADMIN-CONFIG-005` | `blocks.admin` | `[ ]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/app/pages/blocks/` `[x] Exists`
- **E2E Spec**: `specs/api/blocks/admin/config.spec.ts` `[ ] Needs Creation`
- **API Route**: `/api/blocks/:id/admin/config` `[ ] Not Implemented`

---

## Coverage Summary

| Story ID                | Title                    | Status            | Criteria Met |
| ----------------------- | ------------------------ | ----------------- | ------------ |
| US-PAGE-BLOCK-ADMIN-001 | Drag and Drop Blocks     | `[ ]` Not Started | 0/5          |
| US-PAGE-BLOCK-ADMIN-002 | Configure Block Settings | `[ ]` Not Started | 0/5          |

**Total**: 0 complete, 0 partial, 2 not started (0% complete)

---

> **Navigation**: [← Back to Pages Domain](../README.md) | [← Content Blocks as Developer](./as-developer.md)
