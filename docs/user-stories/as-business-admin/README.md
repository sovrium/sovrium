# Business Admin User Stories

> User stories for business administrators managing Sovrium applications at runtime.

## Persona

**Role**: Business Admin
**Description**: Administrators who manage users, monitor system activity, and oversee application operations through the admin interface
**Goals**:

- Manage user accounts (create, view, update roles, reset passwords)
- Monitor system activity and audit user actions
- Maintain application security through session management and impersonation
- Provision the initial admin account on first deployment

## Feature Areas

| Area                                              | Description                                                               | Stories |
| ------------------------------------------------- | ------------------------------------------------------------------------- | ------- |
| [**User Management**](./user-management/)         | Create users, assign roles, reset passwords, manage sessions, impersonate | 2 files |
| [**Activity Monitoring**](./activity-monitoring/) | Activity logs, audit trail, rate limiting                                 | 1 file  |

## Quick Links

### User Management

- [Admin Bootstrap](./user-management/admin-bootstrap.md) - Automatic admin account creation on first startup
- [Admin User Management](./user-management/admin-user-management.md) - CRUD users, ban, set roles, impersonate, manage sessions

### Activity Monitoring

- [Activity Logging](./activity-monitoring/activity-logging.md) - List activity, details, rate limiting

## Relationship to Developer Stories

The **Developer** role (`as-developer/`) configures and enables admin features declaratively in the app schema (e.g., enabling the admin plugin, configuring roles and permissions). The **Business Admin** role (`as-business-admin/`) describes the runtime actions that administrators perform using those configured features.

| Concern            | Developer (as-developer/)                               | Business Admin (as-business-admin/)   |
| ------------------ | ------------------------------------------------------- | ------------------------------------- |
| Auth configuration | Enables email/password, 2FA, magic links                | --                                    |
| Admin plugin       | Configures `admin.enabled`, `adminRoles`, `defaultRole` | Uses admin endpoints to manage users  |
| Permissions        | Defines RBAC roles, field/record-level access           | Has admin role granting full access   |
| Activity           | Configures activity logging retention/rate limits       | Views and filters activity logs       |
| Sessions           | Configures session expiry, refresh settings             | Manages user sessions, revokes access |
