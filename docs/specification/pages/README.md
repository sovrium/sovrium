# Pages Domain

> **Domain**: pages
> **Schema Path**: `src/domain/models/app/pages/`
> **Spec Path**: `specs/api/pages/`

---

## Overview

Pages form the web interface layer of Sovrium applications. They define routes, layouts, and content blocks that users interact with. This domain covers page definition, layouts and templates, content blocks, and navigation.

## Feature Areas

| Feature Area                               | Description                                            | Role-Based Stories                 |
| ------------------------------------------ | ------------------------------------------------------ | ---------------------------------- |
| [page-definition/](./page-definition/)     | Routes, metadata, dynamic parameters, layouts          | as-developer, as-app-administrator |
| [layouts-templates/](./layouts-templates/) | Reusable layouts, nested structures, responsive design | as-developer, as-app-administrator |
| [content-blocks/](./content-blocks/)       | Text, images, tables, forms, charts, custom blocks     | as-developer, as-app-administrator |
| [navigation/](./navigation/)               | Menus, role-based visibility, nested navigation        | as-developer, as-app-administrator |

## Domain Schema Structure

```
src/domain/models/app/pages/
├── index.ts                     # Main pages schema export
├── page.ts                      # Page definition schema
├── route.ts                     # Route configuration schema
├── metadata.ts                  # Page metadata schema
├── layouts/
│   ├── index.ts                 # Layouts aggregation
│   ├── layout.ts                # Layout definition schema
│   └── region.ts                # Layout region schema
├── blocks/
│   ├── index.ts                 # Blocks aggregation
│   ├── text.ts                  # Text block schema
│   ├── image.ts                 # Image block schema
│   ├── table.ts                 # Table block schema
│   ├── form.ts                  # Form block schema
│   ├── chart.ts                 # Chart block schema
│   └── custom.ts                # Custom block schema
└── navigation/
    ├── index.ts                 # Navigation aggregation
    ├── menu.ts                  # Menu schema
    └── menu-item.ts             # Menu item schema
```

## API Endpoints

| Endpoint           | Method | Feature Area      | Spec Path                      |
| ------------------ | ------ | ----------------- | ------------------------------ |
| `/api/pages`       | GET    | page-definition   | `specs/api/pages/list/`        |
| `/api/pages/:slug` | GET    | page-definition   | `specs/api/pages/get/`         |
| `/api/pages/:slug` | POST   | page-definition   | `specs/api/pages/create/`      |
| `/api/pages/:slug` | PATCH  | page-definition   | `specs/api/pages/update/`      |
| `/api/pages/:slug` | DELETE | page-definition   | `specs/api/pages/delete/`      |
| `/api/layouts`     | GET    | layouts-templates | `specs/api/layouts/list/`      |
| `/api/layouts/:id` | GET    | layouts-templates | `specs/api/layouts/get/`       |
| `/api/blocks`      | GET    | content-blocks    | `specs/api/blocks/list/`       |
| `/api/navigation`  | GET    | navigation        | `specs/api/navigation/get/`    |
| `/api/navigation`  | PATCH  | navigation        | `specs/api/navigation/update/` |

## Coverage Summary

| Feature Area      | Implemented | Partial | Not Started | Total  |
| ----------------- | ----------- | ------- | ----------- | ------ |
| page-definition   | 4           | 0       | 3           | 7      |
| layouts-templates | 4           | 0       | 2           | 6      |
| content-blocks    | 5           | 0       | 3           | 8      |
| navigation        | 3           | 0       | 2           | 5      |
| **Total**         | **16**      | **0**   | **10**      | **26** |

---

> **Navigation**: [← Back to Specification Root](../README.md)
