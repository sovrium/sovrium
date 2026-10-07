# SCIM Provisioning

> Let the identity provider create, update and deactivate your users and their group memberships, so joiners and leavers are handled where your organisation already manages them.

SCIM 2.0 is the standard identity providers use to push user changes to applications. Declare a token and the endpoints are mounted under `/api/scim/v2/`.

```yaml
env:
  - key: SCIM_TOKEN

auth:
  strategies:
    - type: emailAndPassword
  groups:
    - name: finance
    - name: support
  scim:
    token: $env.SCIM_TOKEN
```

In the identity provider, set the SCIM base URL to `<BASE_URL>/api/scim/v2` and the authentication to a bearer token holding the value of `SCIM_TOKEN`.

<!-- sovrium:options ScimConfigSchema -->

## The token

The identity provider sends `Authorization: Bearer <token>` on every request. The token is read from the environment — a literal in config is refused when the config is validated. A request with a missing or wrong token answers **404**, as if the endpoints did not exist, so a scanner learns nothing about whether SCIM is enabled. Requests are rate-limited per address, wrong tokens included.

## Endpoints

| Method                | Path                                                               | Does                                           |
| --------------------- | ------------------------------------------------------------------ | ---------------------------------------------- |
| `GET`                 | `/api/scim/v2/Users`                                               | Lists users; supports `filter=userName eq "…"` |
| `POST`                | `/api/scim/v2/Users`                                               | Creates a user                                 |
| `GET`, `PUT`, `PATCH` | `/api/scim/v2/Users/<id>`                                          | Reads, replaces or updates a user              |
| `DELETE`              | `/api/scim/v2/Users/<id>`                                          | Deactivates a user (see below)                 |
| `GET`, `POST`         | `/api/scim/v2/Groups`                                              | Lists groups, or adopts a declared group       |
| `GET`, `PUT`, `PATCH` | `/api/scim/v2/Groups/<id>`                                         | Reads a group or changes its members           |
| `GET`                 | `/api/scim/v2/ServiceProviderConfig`, `/Schemas`, `/ResourceTypes` | Discovery                                      |

Bodies are `application/scim+json`. Errors carry the SCIM error shape, with a `scimType` such as `uniqueness` when a `userName` is already taken.

## Deactivation is not erasure

Setting `active` to `false` — or deleting the user, which identity providers do when someone leaves — ends every session of that user at once and blocks their sign-in, whatever the strategy. Their records stay: deleting what a person authored is the account-deletion flow's job, with its own grace period and its own guarantees. Setting `active` back to `true` lets them sign in again. Deactivating the last account able to administer the app is refused with `409`, so a provisioning mistake cannot lock everyone out.

## What SCIM cannot change

SCIM sets a user's name and whether they are active, and a declared group's members. It never sets a role — a `roles` or `entitlements` attribute is ignored, so a new account gets `auth.defaultRole` and only an admin, or an SSO `roleMapping`, changes it — and it never rewrites an account's email.

## Groups

SCIM groups map to the groups declared in `auth.groups`, by name. The identity provider can change a declared group's members; it cannot create a group the config does not declare, which is refused with `invalidValue`. Config stays the one place that says which groups exist, and therefore what each group may do.

## Linking to single sign-on

When provisioned users sign in through an `auth.sso` provider, list it in `providers`. The provisioned account and the SSO identity with the same email are one account: the first SSO sign-in links them instead of creating a second, provided the address is on one of that provider's `domains` (and, over OpenID Connect, the provider asserts it is verified).

## Audit

Every SCIM write — a user created, updated or deactivated, a group's members changed — is recorded in the audit log, with the identity provider as the actor.
