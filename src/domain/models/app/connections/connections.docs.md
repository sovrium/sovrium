# Connections

> Credentials for an external service, stored once and referenced by name: OAuth2 with automatic refresh, API key, basic auth, bearer token, or a credential exchanged for a short-lived token.

A connection stores the credentials for one external service under the top-level `connections` array. HTTP and AI actions then reference it as `$connection.NAME`, and Sovrium attaches the right authentication to each request, refreshing OAuth2 tokens as they expire.

```yaml
env:
  - { key: GOOGLE_CLIENT_ID, description: Google OAuth client id }
  - { key: GOOGLE_CLIENT_SECRET, description: Google OAuth client secret }

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

Every connection carries a kebab-case `name` unique across the app (that is what `$connection.NAME` resolves), an optional `label` and `description`, a `type` that decides the shape of `props`, and the typed `props` itself. Secret values belong in `$env.VAR` rather than inline.

## OAuth2

The authorization-code flow, with PKCE, automatic token refresh, and a choice between one shared token and a token per user.

<!-- sovrium:options OAuth2ConnectionSchema -->

```yaml
# Requires env: [{ key: HUBSPOT_CLIENT_ID }, { key: HUBSPOT_CLIENT_SECRET }] at the top of the app
- name: hubspot
  type: oauth2
  props:
    clientId: $env.HUBSPOT_CLIENT_ID
    clientSecret: $env.HUBSPOT_CLIENT_SECRET
    authorizationUrl: 'https://app.hubspot.com/oauth/authorize'
    tokenUrl: 'https://api.hubapi.com/oauth/v1/token'
    scopes: [crm.objects.contacts.read]
    redirectUri: 'https://myapp.example.com/oauth/callback'
    scope: user
    extraAuthParams: { access_type: offline, prompt: consent }
```

`provider` names a known service and supplies the authorization and token URLs the connection leaves out: `airtable`, `github`, `google`, `hubspot`, `linkedin`, `microsoft`, `notion`, `salesforce` or `slack`. An explicit `authorizationUrl` or `tokenUrl` always wins over the preset. Any other provider name must come with both URLs, or the config is refused when it loads, naming the known ones.

`redirectUri` defaults to the callback of the place the flow starts from: `<base URL>/api/connections/<name>/callback` when the app starts it, and `<base URL>/api/admin/connections/<name>/callback` when an operator clicks Connect in the console, which brings them back to the page they clicked it on. The base URL is `BASE_URL` when it is set and otherwise the address the request arrived on. Register the callback of every place you connect from. Most providers accept several redirect addresses for one client. The same derived value is sent when the user is redirected and when the code is redeemed, as the provider requires. Set `redirectUri` only to use a different address; it then replaces the derived one in both places. Every authorization uses PKCE with the S256 method unless the connection says otherwise; set `pkce: none` only for a provider that refuses a code challenge, and `pkce: plain` only for one that cannot compute S256.

The console's Connect and Reconnect send the page they were pressed on as `returnTo` to `POST /api/admin/connections/<id>/authorize`. It travels in the OAuth state, and once the token is stored the callback redirects there. A `returnTo` that is not a path on this instance (another site, or a protocol-relative `//host`) is ignored, and the callback lands on `/_admin/connections`.

### Client credentials: no one authorizes anything

`grantType: clientCredentials` is the machine-to-machine grant, for an API that authenticates the client itself rather than a user. The connection needs only `clientId`, `clientSecret` and `tokenUrl`; there is no consent step and no connect button to click. All three accept `$env.VAR`, resolved before every token request, so the client's secret and a sandbox or production token address can stay in the environment.

```yaml
# Requires env: [{ key: ANALYTICS_CLIENT_ID }, { key: ANALYTICS_CLIENT_SECRET }] at the top of the app
- name: analytics-export
  type: oauth2
  props:
    grantType: clientCredentials
    clientId: $env.ANALYTICS_CLIENT_ID
    clientSecret: $env.ANALYTICS_CLIENT_SECRET
    tokenUrl: 'https://api.example.com/oauth/token'
    scopes: [data-export]
    audience: 'https://api.example.com'
```

The first call that needs a token sends `grant_type=client_credentials` to the token endpoint, with the scopes (space-separated), the audience and any `extraTokenParams`, the client authenticated by HTTP Basic or, with `authenticationMethod: body`, in the form body. The token is stored encrypted as the connection's shared token and reused until it expires; the next call after that asks again. Changing the client, its secret, the scopes, the audience or the authentication method makes the next call ask for a new token rather than reuse one issued for the old configuration. A refused token request fails the step, naming the connection, and the API is never called without a token.

In the console a client-credentials connection always reads `active`, before its first call too, renews automatically, and offers no Connect, Reconnect or Disconnect: the app requests its token itself. `POST /api/admin/connections/<id>/authorize` answers 400 for it, naming the grant. Its `GET /api/connections/<name>/status` answers `connected`, with the stored token's expiry, or none before the first call. A refused token request shows as the connection's last error.

### App scope is an authorization gate, not a usage gate

`scope: app` stores **one** shared credential, and only an admin may authorize it: a non-admin reaching the connect endpoint gets a 404. Once stored, that credential is read by **every** automation referencing the connection, including cron-triggered and webhook-triggered runs, which have no user at all. Do not read `scope: app` as "only admins can use it".

`scope: user` issues and stores a token per end-user instead, so each person's HTTP and AI actions act as themselves. A manual trigger whose connection-bound actions are all user-scoped relaxes its implicit required role from admin to member; any app-scoped reference keeps it at admin.

Refresh happens automatically either way, and the refresh request honours `authenticationMethod`.

### Meta: exchanging for a long-lived token

Meta (Facebook Pages, Instagram) answers the code exchange with a token that lapses within hours, and never issues a refresh token. Declare `longLivedToken: { style: meta }` and Sovrium exchanges it at the callback, with a `GET` to the `tokenUrl` carrying `grant_type=fb_exchange_token`, the app's id and secret and the short-lived token; what is stored is the long-lived token Meta returns, valid about 60 days. If Meta refuses that exchange, the callback fails and nothing is stored. Afterwards, the first call made when the stored token has `renewWithinDays` (30 by default) or fewer left exchanges it again before using it, and stores the fresh one; a refused renewal is logged and the call goes ahead with the stored token, which is still valid. A connection nobody uses for 60 days lapses, and reports `reconnect-needed` beforehand.

### When nothing can renew the token

Some providers, such as LinkedIn and Meta, issue no refresh token: the token lapses, and only a new authorization replaces it. Sovrium reports that ahead of time. From 7 days before such a token expires, `GET /api/connections/<name>/status` answers `reconnect-needed` for the caller, and the connection list in `/_admin/connections` shows the same status with a **Reconnect** action. Once it has lapsed, a step using it fails, naming the connection and saying it needs reconnecting, and the API is not called. A token that carries a refresh token renews itself: the console lists its connection as `active` whatever its access token's expiry, says it renews automatically, offers **Disconnect** rather than **Reconnect**, and never counts it among the connections to reconnect. The connection's own `GET /api/connections/<name>/status` still answers `expired` once the access token has lapsed, which only means the next call refreshes it.

An authorization-code connection nobody has authorized yet holds no token, and the console lists it as `not-connected` with a **Connect** action, never as `active`, since nothing can call the provider until someone connects it. The console's Overview does not count it as a healthy connection, and its attention list counts it with the expired and `reconnect-needed` ones as a connection waiting on an operator. An API-key, basic or bearer connection holds no token by design and reads `active`, unless its credential comes from a `$env.` variable that is not set on the instance, in which case it reads `not-configured` until the variable is set (see below).

## API key

<!-- sovrium:options ApiKeyConnectionSchema -->

```yaml
# Requires env: [{ key: GITHUB_TOKEN }] at the top of the app
- name: github-api
  type: apiKey
  props: { key: $env.GITHUB_TOKEN, header: Authorization, prefix: Bearer }
```

`header` defaults to `X-API-Key`. `prefix` is what sits before the value when the service expects one, which is how an API key is sent through an `Authorization` header. A service that reads its key from the address instead of a header takes `query`, the name of the query-string parameter the key is sent in (`query: api_key` for GIPHY); `header` and `prefix` are then not used. Such a connection is sent by `connection/call` and the `http` actions; a `webhook/send` naming it fails rather than deliver without the key.

## Basic auth

<!-- sovrium:options BasicConnectionSchema -->

```yaml
# Requires env: [{ key: LEGACY_USER }, { key: LEGACY_PASS }] at the top of the app
- name: legacy-api
  type: basic
  props: { username: $env.LEGACY_USER, password: $env.LEGACY_PASS }
```

An API that takes its key as the Basic password with no username (Lemlist) is declared with `username: ''`: the pair is sent as `:<password>`. A connection whose username and password are both empty fails the step without calling the API.

A basic connection can also carry text messages the engine sends itself, such as the one-time codes of a signing flow (`verify.sms.connection`). `provider: twilio` names the messaging API it speaks: the username is the account id, the password the auth token, and `baseUrl` defaults to `https://api.twilio.com`. Those messages never pass through an automation, so a code never appears in a run.

## Bearer token

<!-- sovrium:options BearerConnectionSchema -->

```yaml
# Requires env: [{ key: INTERNAL_SERVICE_TOKEN }] at the top of the app
- name: internal-svc
  type: bearer
  props: { token: $env.INTERNAL_SERVICE_TOKEN }
```

A static token, sent in the `Authorization` header. Where the service issues short-lived tokens, an OAuth2 connection refreshes for you; a bearer connection does not.

## Token exchange

Some APIs issue short-lived tokens from a key without being OAuth2 servers: Spendesk answers a client id and secret with a token valid twenty minutes. A `tokenExchange` connection stores the credential and trades it for the token when a call needs one.

<!-- sovrium:options TokenExchangeConnectionSchema -->

```yaml
# Requires env: [{ key: SPENDESK_CLIENT_ID }, { key: SPENDESK_CLIENT_SECRET }] at the top of the app
- name: spendesk
  type: tokenExchange
  props:
    tokenUrl: https://public-api.spendesk.com/v1/auth/token
    body: { client_id: $env.SPENDESK_CLIENT_ID, client_secret: $env.SPENDESK_CLIENT_SECRET }
```

The first call that needs a token posts `body` to `tokenUrl` (as JSON, or as form fields with `bodyType: form`) and reads the token at `tokenPath` (default `access_token`) and its lifetime in seconds at `expiresInPath` (default `expires_in`) in the JSON answer; an answer without a lifetime is kept for an hour. The token is stored encrypted as the connection's shared token and sent on every call in `header` (default `Authorization`) after `prefix` (default `Bearer`; `''` sends it alone) until it expires, when the next call asks again. Concurrent first calls share one token request, and changing the endpoint, the credential or the paths makes the next call ask for a new token rather than reuse one issued for the old configuration. A refused token request fails the step, naming the connection, and the API is never called without a token. `tokenUrl` passes the same outbound-address guard as the http actions, and so does every redirect it answers with; the same holds for the OAuth2 token, refresh and client-credentials requests. None of them is re-sent to another origin by a 307 or 308 redirect, since its body carries a secret.

## Using one

```yaml
- name: fetch
  type: http
  operator: get
  props: { url: 'https://api.example.com/me', connection: github-api }
```

A connection's credential stays on its service. An `http` or `webhook` step that names a connection must call a host written in the config (literally, or read whole from `$env.VAR`), with templates only in the path or query, and the connection must declare `baseUrl`; `sovrium validate` and `sovrium start` refuse the config otherwise, naming the step. At run time the credential is attached only when the request goes to the origin (scheme, host and port) of `baseUrl` or to one listed in `allowedOrigins`; otherwise the step fails and nothing is sent. A redirect to another origin is followed without the credential, and a token request, whose body carries the client secret or the stored credential, is not re-sent to another origin at all: the step fails, saying the request was redirected. List the other hosts of an API spread over several, such as `https://sheets.googleapis.com` beside `https://www.googleapis.com`, under `allowedOrigins`.

### A connection whose credential is not set

An API key, basic or bearer connection, an OAuth2 connection using the client-credentials grant (its `clientId` and `clientSecret`) or a token exchange (any value of its `body`) whose credential comes from `$env.VAR` can be declared before it is switched on. While that variable is not set on the instance, neither in the environment nor as a `default`, the connection does not fail the automations that use it: each run that needs it is recorded **skipped**, with a reason naming the connection (by its `label`, else by its `name`, as the Connections page shows it) and the variable to set (`Connection "Team chat" is not configured: CHAT_TOKEN is not set`). No request is sent, not even a token request. The run is not retried, no operator alert is emailed and no `automation-failure` handler runs; a webhook trigger answers as it does for any other skipped run.

Only a missing variable qualifies. A credential written in the config, or a variable that is set but refused by the service, is still a failure: it is retried under the automation's retry policy and alerted like any other.

## Operations

A connection can also declare the endpoints of its service as `operations` and call them by name from any automation step. They have their own article: **Connection Operations**.

## Not the same thing as an API key your instance issues

A connection of `type: apiKey` holds **somebody else's** credential so an automation can call **their** API. It is outbound. The keys your own instance issues so that somebody can call **yours** are a separate, opt-in feature. Enabling either says nothing about the other.
