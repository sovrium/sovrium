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

The identity provider sends `Authorization: Bearer <token>` on every request. The token is read from the environment; a literal in config is refused when the config is validated. A request with a missing or wrong token answers **404**, as if the endpoints did not exist, so a scanner learns nothing about whether SCIM is enabled. Requests are rate-limited per address, wrong tokens included.

The token must be at least 32 characters: a shorter one stops the app from starting, with a message naming the variable.

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

Setting `active` to `false`, or deleting the user (which identity providers do when someone leaves), ends every session of that user at once and blocks their sign-in, whatever the strategy. Their records stay: deleting what a person authored is the account-deletion flow's job, with its own grace period and its own guarantees. Setting `active` back to `true` lets them sign in again, when the identity provider is the one that deactivated them. An account an administrator banned stays banned whatever the provider sends: a routine `PUT` or `PATCH` carrying `active: true` lifts no ban it did not place, and the account keeps reading `active: false` until an administrator lifts the ban. Deactivating the last account able to administer the app is refused with `409`, so a provisioning mistake cannot lock everyone out.

## Accounts opened here

An account someone opened here themselves (with a password, a social provider or a sign-in link) is managed by the directory only once its address is verified. Until then, changing it or adding it to a group answers `409` with `scimType: uniqueness` and a detail saying the address is not verified, and nothing changes: the directory knows the person by an address nobody has proven to be theirs. Creating a user whose address an account already uses answers `409` as well, whether or not it was verified. Accounts the directory created itself are always its own to manage.

## What SCIM cannot change

SCIM sets a user's name and whether they are active, and a declared group's members. It never sets a role: a `roles` or `entitlements` attribute is ignored, so a new account gets `auth.defaultRole` and only an admin, or an SSO `roleMapping`, changes it. It never rewrites an account's email.

## Groups

SCIM groups map to the groups declared in `auth.groups`, by name. The identity provider can change a declared group's members; it cannot create a group the config does not declare, which is refused with `invalidValue`. Config stays the one place that says which groups exist, and therefore what each group may do.

## Linking to single sign-on

When provisioned users sign in through an `auth.sso` provider, list it in `providers`. The provisioned account and the SSO identity with the same email are one account: the first SSO sign-in links them instead of creating a second, provided the address is on one of that provider's `domains` (and, over OpenID Connect, the provider asserts it is verified).

## Audit

Every SCIM write (a user created, updated or deactivated, a group's members changed) is recorded in the audit log, with the identity provider as the actor.
