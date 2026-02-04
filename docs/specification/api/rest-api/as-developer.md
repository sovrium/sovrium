# API > REST API > As Developer

> **Domain**: api
> **Feature Area**: rest-api
> **Role**: Developer
> **Schema Path**: `src/domain/models/api/rest/`
> **Spec Path**: `specs/api/rest/`

---

## User Stories

### US-API-REST-001: Auto-Generated REST Endpoints

**Story**: As a developer, I want REST endpoints automatically generated for each table so that I don't write boilerplate code.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                                      | Spec Test              | Schema     | Status |
| ------ | ---------------------------------------------- | ---------------------- | ---------- | ------ |
| AC-001 | REST endpoints created for each table          | `APP-API-REST-GEN-001` | `api.rest` | `[x]`  |
| AC-002 | Endpoints available within 1s of config change | `APP-API-REST-GEN-002` | `api.rest` | `[x]`  |
| AC-003 | Endpoint URLs follow consistent pattern        | `APP-API-REST-GEN-003` | `api.rest` | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/api/rest/index.ts` `[x] Exists`
- **E2E Spec**: Endpoint generation tested via table creation
- **Implementation**: Hono route registration with table schema

---

### US-API-REST-002: CRUD Operations for All Tables

**Story**: As a developer, I want CRUD operations (GET, POST, PUT, DELETE) for all tables so that I can manage data programmatically.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                          | Spec Test               | Schema     | Status |
| ------ | ---------------------------------- | ----------------------- | ---------- | ------ |
| AC-001 | GET returns records from table     | `APP-API-REST-CRUD-001` | `api.rest` | `[x]`  |
| AC-002 | POST creates new records           | `APP-API-REST-CRUD-002` | `api.rest` | `[x]`  |
| AC-003 | PUT/PATCH updates existing records | `APP-API-REST-CRUD-003` | `api.rest` | `[x]`  |
| AC-004 | DELETE removes records             | `APP-API-REST-CRUD-004` | `api.rest` | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/api/rest/index.ts` `[x] Exists`
- **E2E Spec**: CRUD operations tested for each HTTP method
- **Implementation**: Hono route handlers with Drizzle queries

---

### US-API-REST-003: Consistent URL Patterns

**Story**: As a developer, I want consistent URL patterns (e.g., `/api/tables/{table}/records`) so that the API is predictable.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                                        | Spec Test              | Schema     | Status |
| ------ | ------------------------------------------------ | ---------------------- | ---------- | ------ |
| AC-001 | URLs follow `/api/tables/{table}/records`        | `APP-API-REST-URL-001` | `api.rest` | `[x]`  |
| AC-002 | Single record: `/api/tables/{table}/records/:id` | `APP-API-REST-URL-002` | `api.rest` | `[x]`  |
| AC-003 | Patterns documented and consistent               | `APP-API-REST-URL-003` | `api.rest` | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/api/rest/index.ts` `[x] Exists`
- **E2E Spec**: URL patterns tested via route matching
- **Implementation**: RESTful route naming convention

---

### US-API-REST-004: Field Configuration Respect

**Story**: As a developer, I want the API to respect table field configurations (types, required, unique) so that validation is consistent.

**Status**: `[x]` Complete

#### Acceptance Criteria

| ID     | Criterion                                 | Spec Test                | Schema     | Status |
| ------ | ----------------------------------------- | ------------------------ | ---------- | ------ |
| AC-001 | Field types validated on create/update    | `APP-API-REST-VALID-001` | `api.rest` | `[x]`  |
| AC-002 | Required fields enforced                  | `APP-API-REST-VALID-002` | `api.rest` | `[x]`  |
| AC-003 | Unique constraints enforced               | `APP-API-REST-VALID-003` | `api.rest` | `[x]`  |
| AC-004 | Validation errors return 400 with details | `APP-API-REST-VALID-004` | `api.rest` | `[x]`  |

#### Implementation Notes

- **Schema**: `src/domain/models/api/rest/index.ts` `[x] Exists`
- **E2E Spec**: Field validation tested via invalid requests
- **Implementation**: Effect Schema validation in route handlers

---

## Coverage Summary

| Story ID        | Title                    | Status         | Criteria Met |
| --------------- | ------------------------ | -------------- | ------------ |
| US-API-REST-001 | Auto-Generated Endpoints | `[x]` Complete | 3/3          |
| US-API-REST-002 | CRUD Operations          | `[x]` Complete | 4/4          |
| US-API-REST-003 | Consistent URL Patterns  | `[x]` Complete | 3/3          |
| US-API-REST-004 | Field Configuration      | `[x]` Complete | 4/4          |

**Total**: 4 complete, 0 partial, 0 not started (100% complete)

---

> **Navigation**: [← Back to API Domain](../README.md) | [REST API as API Consumer →](./as-api-consumer.md)
