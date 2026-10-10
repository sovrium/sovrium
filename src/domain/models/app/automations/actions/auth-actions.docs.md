# Auth Actions

> Managing user accounts from inside a workflow — provisioning, role changes, and moderation.

The `auth` family operates on the same user store and the same roles as end-user authentication, and goes through the same access control. It requires authentication to be configured. Nine operators.

| Operator                  | Props                                 | Does                                                                           |
| ------------------------- | ------------------------------------- | ------------------------------------------------------------------------------ |
| `createUser`              | `email`, `name`, `password?`, `role?` | Creates an account; the password is generated when omitted                     |
| `assignRole`              | `userId`, `role`                      | Assigns a role — built-in or custom — to an existing account                   |
| `banUser`                 | `userId`, `reason?`                   | Bans an account, storing the reason on the account                             |
| `unbanUser`               | `userId`                              | Lifts a ban                                                                    |
| `addToGroup`              | `userId`, `group`                     | Adds an existing account to a group declared in `auth.groups`                  |
| `removeFromGroup`         | `userId`, `group`                     | Removes an account from a group                                                |
| `registerOAuthClient`     | `name`, `redirectUri`                 | Registers a sign-in client for another app; outputs `clientId`, `clientSecret` |
| `rotateOAuthClientSecret` | `clientId`                            | Replaces a sign-in client's secret; outputs `clientId`, `clientSecret`         |
| `deleteOAuthClient`       | `clientId`                            | Deletes a sign-in client; outputs `clientId`, `deleted`                        |

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

`assignRole` writes through the same guard the admin endpoints use, so a role name the app has not declared is refused rather than stored, and the last remaining admin cannot be demoted by an automation any more than by a person, nor banned: `banUser` refuses to ban the last admin able to sign in and fails the step. A role an automation changes is recorded in the audit log as `user.role.changed`, a ban as `user.banned` (with `expiresAt: null`, since `banUser` sets no end, and never with its reason) and a lifted ban as `user.unbanned`, each attributed to the automation by name — the entry's actor is the automation, and its name is in the entry's `metadata.automation`. Lifting a ban from an account that was not banned records nothing. A workflow that provisions accounts is therefore safe to run against a trigger you do not fully control; it is still worth gating with a filter, because a refused write fails the step and fails the run.

## Group membership

`addToGroup` and `removeFromGroup` manage who belongs to the groups the app declares in `auth.groups`, so membership — which the configuration never states — can follow your data. `group` is the group's name. A name the configuration does not declare is refused by `sovrium validate` when it is written literally, and fails the step when it arrives through a template.

```yaml
- name: join-facilitation
  type: auth
  operator: addToGroup
  props: { userId: '{{trigger.data.user_id}}', group: facilitation }
```

Both operators are idempotent: adding an account that is already a member, or removing one that is not, succeeds and changes nothing, so a workflow that mirrors a field into memberships can run on every change without checking first. Each step's output is `{ userId, group, changed }`, where `changed` says whether the membership moved. A group's `maxMembers` holds against an automation as it does against an admin: an add past the cap fails the step. A membership an automation changes is recorded in the audit log as `user.groups.changed`, with the groups `added` or `removed` and the automation's name; a step that changed nothing records nothing. The change counts on the account's next request.

## Sign-in clients

An app with authentication is an OpenID Connect provider, and these three operators let a workflow manage the clients other apps sign in through — the way a platform gives every app it creates a client of its own, with no secret pasted between two consoles.

```yaml
automations:
  - name: register-sign-in-client
    trigger:
      type: record
      table: apps
      events: [create]
    actions:
      - name: register
        type: auth
        operator: registerOAuthClient
        props:
          name: '{{trigger.data.record.slug}}'
          redirectUri: 'https://{{trigger.data.record.slug}}.cloud.example.com/api/auth/callback/sovrium-cloud'
      - name: keep
        type: record
        operator: update
        props:
          table: apps
          filter:
            conditions: [{ field: id, operator: equals, value: '{{trigger.data.record.id}}' }]
          data:
            sso_client_id: '{{steps.register.clientId}}'
            sso_client_secret: '{{steps.register.clientSecret}}'
```

Only the name and the return address are chosen; the rest of the client is fixed. It holds a secret, skips the consent screen, requires PKCE, uses the authorization code and nothing else, may ask for `openid email profile` only, and returns to exactly `redirectUri` — not another address, not a longer one. The rendered `redirectUri` must be an absolute `https` address without a fragment (`http` is accepted on a loopback host only); anything else fails the step and registers nothing.

Such a client is never a client of the app's MCP server: a token it obtains is refused at `/mcp`, whatever it asks for.

`rotateOAuthClientSecret` answers a new secret and the old one stops working at once. `deleteOAuthClient` removes the client, after which signing in through it fails; `deleted` is `false` when there was no such client, so deleting twice does not fail the run. The secret is passed to the next step and recorded as `***` in the run history.

## Generated passwords are not delivered

Omitting `password` on `createUser` generates one, and nothing emails it. Pair the action with an invitation flow, or send a password-reset link — an account created without a way to reach it is an account nobody can sign in to.
