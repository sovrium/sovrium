# Roles & RBAC

> One role per user, arranged in a numeric hierarchy — the three built-ins, custom roles layered on top, and how the first admin comes to exist.

Every authenticated user has exactly one role. Roles are ordered by a numeric level, and a table's permissions reference them to gate each operation.

```yaml
auth:
  strategies:
    - type: emailAndPassword
  defaultRole: member
  roles:
    - name: editor
      description: Can edit content
      level: 30
```

## The three built-ins

They ship with every auth-enabled app, are always available, and **cannot be redefined**.

| Role     | Level | Access                                                    |
| -------- | ----- | --------------------------------------------------------- |
| `admin`  | 80    | Full — users, roles, settings, and every table permission |
| `member` | 40    | Standard access to application resources                  |
| `viewer` | 10    | Read-only                                                 |

Higher levels are more privileged. The level establishes the ordering permission resolution reads, and the one features comparing seniority use — an admin-equivalent role is one at the highest configured level.

## Custom roles

<!-- sovrium:options RoleDefinitionSchema -->

`name` is required, lowercase, alphanumeric with hyphens, and must start with a letter. It must be unique, and must collide with neither a built-in role name nor a **group** name: roles and groups share one namespace.

```yaml
auth:
  roles:
    - name: editor
      level: 30
    - name: moderator
      level: 50
    - name: contributor
```

A custom role slots anywhere along the built-in scale through its own level — 30 sits between viewer and member, 50 between member and admin.

Validation refuses a duplicate name, a collision with a built-in role, and a collision with a group.

## The default role

`defaultRole` is what a newly registered user receives. It defaults to `member`, and must name a built-in role or one defined in `roles` — naming an undefined role fails validation at startup rather than assigning something arbitrary.

Setting it to `viewer` is a common pattern for an app where new users should be read-only until an admin promotes them.

## Where the first admin comes from

Once authentication is configured the admin surface is always mounted; there is no toggle. Registering does **not** make anyone an admin — every sign-up receives the default role. The first admin is created deliberately, by one of three routes: environment variables applied at boot, the admin-create CLI command, or the one-time bootstrap token printed at first start.

After that, an existing admin promotes others. An admin can create users even where self-registration is off, invite users with single-use tokens, assign and change roles, impersonate for support, and ban or unban.

Two refusals are built into that surface: a role change that would remove the last admin able to sign in is refused, and another admin cannot be impersonated.

The highest-level role is treated as admin-equivalent for these checks, so a custom role at level 80 or above participates in admin gating alongside the built-in one.

## Most permissive wins

When a user's permissions come from several sources — their role and their groups — the **union** of granted operations applies. A role granting read and a group granting update together grant both.

## A role does not grant access by itself

Roles are referenced by each table's permissions block. A role with no matching entry has no access to that table at all, which is the direction that fails safe.
