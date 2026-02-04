# Tables Domain

> **Domain**: tables
> **Schema Path**: `src/domain/models/app/tables/`
> **Spec Path**: `specs/api/tables/`

---

## Overview

Tables form the database layer of Sovrium applications. They store structured data with fields, relationships, and validation rules. This domain covers table definition, data management, bulk operations, and field types.

## Feature Areas

| Feature Area                             | Description                                             | Role-Based Stories                 |
| ---------------------------------------- | ------------------------------------------------------- | ---------------------------------- |
| [table-definition/](./table-definition/) | Define tables, fields, relationships, validation rules  | as-developer, as-app-administrator |
| [data-manager/](./data-manager/)         | CRUD operations, filtering, sorting, pagination         | as-app-administrator               |
| [bulk-operations/](./bulk-operations/)   | Import/export CSV/JSON/Excel, bulk edit/delete          | as-app-administrator               |
| [field-types/](./field-types/)           | Text, number, date, select, file, formula, linked types | as-developer                       |

## Domain Schema Structure

```
src/domain/models/app/tables/
├── index.ts                     # Main tables schema export
├── table.ts                     # Table definition schema
├── validation.ts                # Table validation rules
├── fields/
│   ├── index.ts                 # Fields aggregation
│   ├── text.ts                  # Text field schema
│   ├── number.ts                # Number field schema
│   ├── date.ts                  # Date/datetime field schema
│   ├── boolean.ts               # Boolean field schema
│   ├── select.ts                # Single/multi-select schema
│   ├── file.ts                  # File/attachment schema
│   ├── formula.ts               # Formula field schema
│   └── linked-record.ts         # Linked record schema
└── relationships/
    ├── index.ts                 # Relationships aggregation
    ├── one-to-many.ts           # One-to-many relationship
    └── many-to-many.ts          # Many-to-many relationship
```

## API Endpoints

| Endpoint                        | Method | Feature Area     | Spec Path                          |
| ------------------------------- | ------ | ---------------- | ---------------------------------- |
| `/api/tables`                   | GET    | table-definition | `specs/api/tables/list/`           |
| `/api/tables/:slug`             | GET    | data-manager     | `specs/api/tables/get/`            |
| `/api/tables/:slug/records`     | GET    | data-manager     | `specs/api/tables/records/list/`   |
| `/api/tables/:slug/records`     | POST   | data-manager     | `specs/api/tables/records/create/` |
| `/api/tables/:slug/records/:id` | GET    | data-manager     | `specs/api/tables/records/get/`    |
| `/api/tables/:slug/records/:id` | PATCH  | data-manager     | `specs/api/tables/records/update/` |
| `/api/tables/:slug/records/:id` | DELETE | data-manager     | `specs/api/tables/records/delete/` |
| `/api/tables/:slug/import`      | POST   | bulk-operations  | `specs/api/tables/import/`         |
| `/api/tables/:slug/export`      | GET    | bulk-operations  | `specs/api/tables/export/`         |
| `/api/tables/:slug/bulk-edit`   | POST   | bulk-operations  | `specs/api/tables/bulk-edit/`      |
| `/api/tables/:slug/bulk-delete` | POST   | bulk-operations  | `specs/api/tables/bulk-delete/`    |

## Coverage Summary

| Feature Area     | Implemented | Partial | Not Started | Total  |
| ---------------- | ----------- | ------- | ----------- | ------ |
| table-definition | 4           | 0       | 3           | 7      |
| data-manager     | 7           | 0       | 1           | 8      |
| bulk-operations  | 2           | 0       | 5           | 7      |
| field-types      | 11          | 0       | 0           | 11     |
| **Total**        | **24**      | **0**   | **9**       | **33** |

---

> **Navigation**: [← Back to Specification Root](../README.md)
