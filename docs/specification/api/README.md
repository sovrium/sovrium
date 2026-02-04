# API Domain

> **Domain**: api
> **Schema Path**: `src/domain/models/api/`
> **Spec Path**: `specs/api/`

---

## Overview

The API domain provides the programmatic interface to Sovrium applications. APIs enable external integrations, mobile apps, and third-party access to data and functionality through auto-generated REST endpoints, authentication flows, webhooks, and comprehensive documentation.

---

## Feature Areas

| Feature Area   | Description                                 | Developer | API Consumer | App Admin |
| -------------- | ------------------------------------------- | --------- | ------------ | --------- |
| rest-api       | Auto-generated CRUD endpoints for tables    | ✓         | ✓            |           |
| auth-endpoints | Authentication and session management       | ✓         | ✓            |           |
| webhooks       | Outgoing and incoming webhook configuration | ✓         |              | ✓         |
| security       | API keys, rate limiting, CORS configuration | ✓         |              | ✓         |
| documentation  | OpenAPI/Swagger auto-generated docs         | ✓         | ✓            |           |

---

## Quick Links

### REST API

- [As Developer](./rest-api/as-developer.md) - Auto-generated endpoints, field validation
- [As API Consumer](./rest-api/as-api-consumer.md) - CRUD operations, pagination, filtering

### Authentication Endpoints

- [As Developer](./auth-endpoints/as-developer.md) - Auth flows, OAuth, session management
- [As API Consumer](./auth-endpoints/as-api-consumer.md) - Token authentication, error handling

### Webhooks

- [As Developer](./webhooks/as-developer.md) - Outgoing/incoming webhooks, payloads
- [As App Administrator](./webhooks/as-app-administrator.md) - Webhook management, logs

### Security

- [As Developer](./security/as-developer.md) - Authentication, rate limiting, CORS
- [As App Administrator](./security/as-app-administrator.md) - API keys, usage statistics

### Documentation

- [As Developer](./documentation/as-developer.md) - OpenAPI generation, examples
- [As API Consumer](./documentation/as-api-consumer.md) - API explorer, error codes

---

## Coverage Summary

| Feature Area   | Total Stories | Complete | Partial | Not Started | Coverage |
| -------------- | ------------- | -------- | ------- | ----------- | -------- |
| rest-api       | 11            | 11       | 0       | 0           | 100%     |
| auth-endpoints | 7             | 6        | 0       | 1           | 86%      |
| webhooks       | 7             | 0        | 0       | 7           | 0%       |
| security       | 7             | 2        | 1       | 4           | 36%      |
| documentation  | 5             | 1        | 0       | 4           | 20%      |

**Domain Total**: 20 complete, 1 partial, 16 not started (37 total, 57% complete)

---

## Implementation Status

### Implemented Features

- **REST API**: Auto-generated CRUD endpoints for all tables
- **Authentication**: Login, logout, signup, OAuth, password reset
- **Session Management**: Cookie-based sessions with Better Auth
- **CORS Configuration**: Configurable cross-origin policies

### Pending Features

- **Webhooks**: Outgoing/incoming webhook system
- **API Keys**: Machine-to-machine authentication
- **Rate Limiting**: Per-key usage limits (partially implemented)
- **API Documentation**: Auto-generated OpenAPI/Swagger

---

## Related Documentation

- **Better Auth**: `@docs/infrastructure/framework/better-auth.md`
- **Hono Framework**: `@docs/infrastructure/framework/hono.md`
- **OpenAPI Integration**: `@docs/infrastructure/api/zod-hono-openapi.md`

---

> **Navigation**: [← Back to Specification](../README.md)
