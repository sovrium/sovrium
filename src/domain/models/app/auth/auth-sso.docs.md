# Single Sign-On (OIDC & SAML)

> Let people sign in with the identity provider their organisation already runs — Okta, Entra ID, Google Workspace, Keycloak, JumpCloud — over OpenID Connect or SAML 2.0, declared in config.

Each identity provider is one entry under `auth.sso`. Users see one button per provider on the sign-in page, and an email address on a domain a provider owns is routed to that provider.

An app can sign in through its identity providers alone: leave `auth.strategies` empty, or omit it, and declare at least one provider under `auth.sso`. An auth block with neither a strategy nor a provider is refused.

```yaml
env:
  - key: OKTA_CLIENT_ID
  - key: OKTA_CLIENT_SECRET

auth:
  strategies:
    - type: emailAndPassword
  sso:
    - id: okta
      type: oidc
      label: Sign in with Okta
      domains: [acme.com]
      oidc:
        issuer: https://acme.okta.com
        clientId: $env.OKTA_CLIENT_ID
        clientSecret: $env.OKTA_CLIENT_SECRET
```

## Providers live in config, and only there

A provider is added, changed or removed by editing the config file. There is no endpoint that registers one at runtime, so nobody — not even an admin — can point your sign-in at a different identity provider over HTTP. What the file says is what signs people in.

Every secret is written as an `$env.` reference. A literal `clientSecret` is refused when the config is validated, because a literal in config is committed, reviewed and mirrored to every remote. The variable must also be declared in `app.env`; `sovrium validate` names the one that is missing.

<!-- sovrium:options SsoProviderSchema -->

`id` appears in the callback URL you register at the provider, so pick it once and keep it:

| Protocol | Register this URL at the provider                     |
| -------- | ----------------------------------------------------- |
| OIDC     | `<BASE_URL>/api/auth/sso/callback/<id>`               |
| SAML     | `<BASE_URL>/api/auth/sso/saml2/sp/acs/<id>` (ACS URL) |

## Trusted origins

Declaring a provider adds exactly one origin to those the app trusts: the provider's OIDC `issuer`, or its SAML `entryPoint`. The server fetches discovery, keys and tokens from that origin and the browser posts the SAML response back from it, so both have to pass the origin check. The app then trusts its own `BASE_URL` plus each declared provider's origin, and nothing else: a request claiming any other origin is refused with `403`. A sign-in still returns only to a path of this app, never to the provider.

## OpenID Connect

<!-- sovrium:options SsoOidcConfigSchema -->

The endpoints and signing keys are discovered from `<issuer>/.well-known/openid-configuration`, and the ID token is verified against them: a token from another issuer, or signed by another key, signs nobody in. PKCE is on unless you turn it off, which you should only do for a provider that rejects it.

## SAML 2.0

<!-- sovrium:options SsoSamlConfigSchema -->

Describe the identity provider either with its metadata XML, or with the three values it publishes: `entityId`, `entryPoint` (its sign-on URL) and `cert` (its signing certificate). A response whose signature does not verify against that certificate, whose audience is not your service-provider entity id, or which has expired, signs nobody in. The service-provider metadata to hand the identity provider is served at `<BASE_URL>/api/auth/sso/saml2/sp/metadata?providerId=<id>`.

## Domains

`domains` lists the email domains a provider is authoritative for. Two things follow:

- **Routing.** On a sign-in form with an email field, an address on one of those domains is sent to that provider. A domain belongs to one provider; listing it twice is refused.
- **Linking.** An account that already exists with an address on one of those domains is linked to the SSO identity on its first SSO sign-in, instead of a second account being created. An address on any other domain is never linked by email alone — that would let whoever controls an identity provider take over accounts it does not own. Over OpenID Connect the provider must also assert the address is verified (`email_verified: true`); an unverified claim links nothing. Once linked, the account stays bound to the provider's subject for that person: a later sign-in carrying the same email under another subject is refused.

A provider without `domains` routes nothing and links nothing, but while sign-up is open any account that provider vouches for can create one here. For a provider anyone can hold an account at, set `allowSignUp: false`.

## Roles

An SSO user receives `auth.defaultRole` when their account is created. To derive the role from the identity provider instead, map one claim or attribute:

```yaml
roleMapping:
  claim: groups
  map:
    it-admins: admin
    staff: member
  default: viewer
```

The mapping is applied at **every** sign-in, so the identity provider stays the source of truth: remove someone from `it-admins` there and their next sign-in here demotes them. Entries are tried in the order written, and the first value the user carries decides.

An admin role is only ever granted by an entry you wrote. `default` can never be `admin` or another admin-tier role — validation refuses it — and a value the map does not list falls back to `default`, never upward.

## Who may sign up

`allowSignUp` decides whether a first SSO sign-in creates an account. It inherits `auth.allowSignUp`. Set it to `false` and only accounts that already exist — invited, created by an admin, or provisioned through SCIM — can sign in with that provider.

## The sign-in button

A sign-in form whose action uses the `sso` strategy draws one button per provider, labelled with `label`, and — when any provider lists `domains` — an email field that routes by domain. Name a provider with `provider` to draw only its button. After sign-in the user returns to the action's `onSuccess` destination; a sign-in asking to return anywhere but a path of this app is refused.

```yaml
- type: form
  action:
    type: auth
    method: login
    strategy: sso
```
