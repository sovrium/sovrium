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

Higher levels are more privileged. The level establishes the ordering permission resolution reads, and the one features comparing seniority use.

## Admin-equivalent roles

**An admin-equivalent role is the app's highest role, and the built-in admin.** The app's highest role is the highest-level custom role when its level is 80 or above, and `admin` itself otherwise. The built-in `admin` is always admin-equivalent, even in an app whose custom role outranks it — a `director` at level 90 adds a second admin-equivalent role, it does not demote `admin`. Every admin-only door reads this one definition, so the app's highest role opens each door the built-in `admin` opens: outranking a table's grants (and a bucket's, a view's, an agent's `trigger`), permanent delete and purge, webhook management, the bypass of row-level rules and field read grants, reading and moderating pending comments, the `user_access` routes, a connection's user roster, the knowledge rebuild, the analytics reads, revealing a form submission's body, the MCP internals, audit and config tools, a bucket's admin-only signing default, and running a manual automation that names no role or a cron automation on demand. The operator console at `/_admin` keeps its own access tier: a role it admits reads every console page, but each door above still asks for an admin-equivalent role. Every other role is exactly as restricted as its grants say.

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

`defaultRole` is what a newly registered user receives. It defaults to `member`, and must name a built-in role or one defined in `roles` — naming an undefined role fails validation at startup rather than assigning something arbitrary. That holds whether or not `roles` is present: with no roles declared, only `admin`, `member` and `viewer` are accepted. `operator`, `admin-editor` and `admin-viewer` are never accepted as a default.

Setting it to `viewer` is a common pattern for an app where new users should be read-only until an admin promotes them.

## Where the first admin comes from

Once authentication is configured the admin surface is always mounted; there is no toggle. Registering does **not** make anyone an admin — every sign-up receives the default role. The first admin is created deliberately, by one of three routes: environment variables applied at boot, the admin-create CLI command, or the one-time bootstrap token printed at first start.

After that, an existing admin promotes others. An admin can create users even where self-registration is off, invite users with single-use tokens, assign and change roles, impersonate for support, and ban or unban.

Two refusals are built into that surface: a role change that would remove the last admin able to sign in is refused, and another admin cannot be impersonated.

Both admin-equivalent roles count as admins for these checks, so a top custom role at level 80 or above participates in admin gating alongside the built-in one.

## Most permissive wins

When a user's permissions come from several sources — their role and their groups — the **union** of granted operations applies. A role granting read and a group granting update together grant both.

## A role does not grant access by itself

Roles are referenced by each table's permissions block. A role with no matching entry has no access to that table at all, which is the direction that fails safe.
