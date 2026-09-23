# Auth Actions

> Managing user accounts from inside a workflow — provisioning, role changes, and moderation.

The `auth` family operates on the same user store and the same roles as end-user authentication, and goes through the same access control. It requires authentication to be configured. Four operators.

| Operator     | Props                                 | Does                                                         |
| ------------ | ------------------------------------- | ------------------------------------------------------------ |
| `createUser` | `email`, `name`, `password?`, `role?` | Creates an account; the password is generated when omitted   |
| `assignRole` | `userId`, `role`                      | Assigns a role — built-in or custom — to an existing account |
| `banUser`    | `userId`, `reason?`                   | Bans an account, storing the reason for the audit trail      |
| `unbanUser`  | `userId`                              | Lifts a ban                                                  |

<!-- sovrium:options AuthActionSchema -->

An omitted `role` on `createUser` falls back to the app's configured default role, which is `member` unless the auth block says otherwise.

```yaml
- name: provision
  type: auth
  operator: createUser
  props:
    email: '{{trigger.data.email}}'
    name: '{{trigger.data.name}}'
    role: member
```

```yaml
- name: promote
  type: auth
  operator: assignRole
  props: { userId: '{{trigger.data.user_id}}', role: admin }
```

## An automation is not exempt from the role rules

`assignRole` writes through the same guard the admin endpoints use, so a role name the app has not declared is refused rather than stored, and the last remaining admin cannot be demoted by an automation any more than by a person. A workflow that provisions accounts is therefore safe to run against a trigger you do not fully control; it is still worth gating with a filter, because a refused write fails the step and fails the run.

## Generated passwords are not delivered

Omitting `password` on `createUser` generates one, and nothing emails it. Pair the action with an invitation flow, or send a password-reset link — an account created without a way to reach it is an account nobody can sign in to.
