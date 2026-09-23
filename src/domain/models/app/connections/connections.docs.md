# Connections

> Credentials for an external service, stored once and referenced by name — OAuth2 with automatic refresh, API key, basic auth, bearer token.

A connection stores the credentials for one external service under the top-level `connections` array. HTTP and AI actions then reference it as `$connection.NAME`, and Sovrium attaches the right authentication to each request — refreshing OAuth2 tokens as they expire.

```yaml
connections:
  - name: crm-oauth
    label: Acme CRM
    type: oauth2
    props:
      provider: google
      clientId: $env.GOOGLE_CLIENT_ID
      clientSecret: $env.GOOGLE_CLIENT_SECRET
      scopes: [openid, email, profile]
```

Every connection carries a kebab-case `name` unique across the app — that is what `$connection.NAME` resolves — an optional `label` and `description`, a `type` that decides the shape of `props`, and the typed `props` itself. Secret values belong in `$env.VAR` rather than inline.

## OAuth2

The authorization-code flow, with PKCE, automatic token refresh, and a choice between one shared token and a token per user.

<!-- sovrium:options OAuth2ConnectionSchema -->

```yaml
- name: hubspot
  type: oauth2
  props:
    clientId: $env.HUBSPOT_CLIENT_ID
    clientSecret: $env.HUBSPOT_CLIENT_SECRET
    authorizationUrl: 'https://app.hubspot.com/oauth/authorize'
    tokenUrl: 'https://api.hubapi.com/oauth/v1/token'
    scopes: [crm.objects.contacts.read]
    redirectUri: 'https://myapp.example.com/oauth/callback'
    pkce: S256
    scope: user
    extraAuthParams: { access_type: offline, prompt: consent }
```

`provider` is a shorthand for a known service and may supply the authorization and token URLs; a custom provider supplies both itself. `redirectUri` is required at runtime — it is not generated for you. `pkce: S256` is the one to choose where the provider supports it.

### `clientCredentials` is declarable, not functional

The schema accepts `grantType: clientCredentials` and a configuration carrying it validates cleanly, but no code path ever emits a `grant_type=client_credentials` token request. The only grants Sovrium sends are `authorization_code`, on the callback, and `refresh_token`, on refresh. A machine-to-machine integration needs an `apiKey` or `bearer` connection today.

### App scope is an authorization gate, not a usage gate

`scope: app` stores **one** shared credential, and only an admin may authorize it: a non-admin reaching the connect endpoint gets a 404. Once stored, that credential is read by **every** automation referencing the connection — including cron-triggered and webhook-triggered runs, which have no user at all. Do not read `scope: app` as "only admins can use it".

`scope: user` issues and stores a token per end-user instead, so each person's HTTP and AI actions act as themselves. A manual trigger whose connection-bound actions are all user-scoped relaxes its implicit required role from admin to member; any app-scoped reference keeps it at admin.

Refresh happens automatically either way, and the refresh request honours `authenticationMethod`.

## API key

<!-- sovrium:options ApiKeyConnectionSchema -->

```yaml
- name: github-api
  type: apiKey
  props: { key: $env.GITHUB_TOKEN, header: Authorization, prefix: Bearer }
```

`header` defaults to `X-API-Key`. `prefix` is what sits before the value when the service expects one, which is how an API key is sent through an `Authorization` header.

## Basic auth

<!-- sovrium:options BasicConnectionSchema -->

```yaml
- name: legacy-api
  type: basic
  props: { username: $env.LEGACY_USER, password: $env.LEGACY_PASS }
```

## Bearer token

<!-- sovrium:options BearerConnectionSchema -->

```yaml
- name: internal-svc
  type: bearer
  props: { token: $env.INTERNAL_SERVICE_TOKEN }
```

A static token, sent in the `Authorization` header. Where the service issues short-lived tokens, an OAuth2 connection refreshes for you; a bearer connection does not.

## Using one

```yaml
- name: fetch
  type: http
  operator: get
  props: { url: 'https://api.example.com/me', connection: github-api }
```

## Not the same thing as an API key your instance issues

A connection of `type: apiKey` holds **somebody else's** credential so an automation can call **their** API. It is outbound. The keys your own instance issues so that somebody can call **yours** are a separate, opt-in feature. Enabling either says nothing about the other.
