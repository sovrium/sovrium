# Forms Domain

> **Domain**: forms
> **Schema Path**: `src/domain/models/forms/`
> **Spec Path**: `specs/api/forms/`

---

## Overview

The Forms domain handles data collection interfaces in Sovrium applications. Forms allow end users to submit data that gets stored in tables or triggers automations, with built-in validation, spam protection, and response management.

---

## Feature Areas

| Feature Area         | Description                           | Developer | App Administrator |
| -------------------- | ------------------------------------- | --------- | ----------------- |
| form-definition      | Form creation and configuration       | ✓         | ✓                 |
| form-fields          | Field types and field configuration   | ✓         | ✓                 |
| responses-management | Submission viewing, filtering, export |           | ✓                 |
| spam-protection      | CAPTCHA, honeypots, rate limiting     | ✓         | ✓                 |

---

## Quick Links

### Form Definition

- [As Developer](./form-definition/as-developer.md) - Form-to-table mapping, validation, post-submit actions
- [As App Administrator](./form-definition/as-app-administrator.md) - Visual form builder, preview, enable/disable

### Form Fields

- [As Developer](./form-fields/as-developer.md) - Text, email, number, date, select, file upload fields
- [As App Administrator](./form-fields/as-app-administrator.md) - Required fields, placeholders, conditional logic

### Responses Management

- [As App Administrator](./responses-management/as-app-administrator.md) - View, filter, export submissions

### Spam Protection

- [As Developer](./spam-protection/as-developer.md) - CAPTCHA, honeypots, rate limiting
- [As App Administrator](./spam-protection/as-app-administrator.md) - Spam filtering, moderation, blocking

---

## Coverage Summary

| Feature Area         | Total Stories | Complete | Partial | Not Started | Coverage |
| -------------------- | ------------- | -------- | ------- | ----------- | -------- |
| form-definition      | 7             | 0        | 0       | 7           | 0%       |
| form-fields          | 13            | 0        | 0       | 13          | 0%       |
| responses-management | 5             | 0        | 0       | 5           | 0%       |
| spam-protection      | 7             | 0        | 0       | 7           | 0%       |

**Domain Total**: 0 complete, 0 partial, 32 not started (32 total, 0% complete)

---

## Implementation Status

### Pending Features

- **Form Definition**: Form creation, validation configuration, submission handling
- **Form Fields**: All field types (text, email, select, file, etc.)
- **Responses Management**: Admin interface for viewing/exporting submissions
- **Spam Protection**: CAPTCHA, honeypots, rate limiting, moderation workflows

---

## Related Documentation

- **React Hook Form**: `@docs/infrastructure/ui/react-hook-form.md`
- **Zod Validation**: `@docs/infrastructure/api/zod-hono-openapi.md`
- **Effect Schema**: `@docs/infrastructure/framework/effect.md`

---

> **Navigation**: [← Back to Specification](../README.md)
