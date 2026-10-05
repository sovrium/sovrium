# Connections

> Credentials for an external service, stored once and referenced by name — OAuth2 with automatic refresh, API key, basic auth, bearer token, or a credential exchanged for a short-lived token.

A connection stores the credentials for one external service under the top-level `connections` array. HTTP and AI actions then reference it as `$connection.NAME`, and Sovrium attaches the right authentication to each request — refreshing OAuth2 tokens as they expire.

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

Every connection carries a kebab-case `name` unique across the app — that is what `$connection.NAME` resolves — an optional `label` and `description`, a `type` that decides the shape of `props`, and the typed `props` itself. Secret values belong in `$env.VAR` rather than inline.

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
    pkce: S256
    scope: user
    extraAuthParams: { access_type: offline, prompt: consent }
```

`provider` names a known service and supplies the authorization and token URLs the connection leaves out: `airtable`, `github`, `google`, `hubspot`, `linkedin`, `microsoft`, `notion`, `salesforce` or `slack`. An explicit `authorizationUrl` or `tokenUrl` always wins over the preset. Any other provider name must come with both URLs, or the config is refused when it loads, naming the known ones.

`redirectUri` defaults to the callback of the place the flow starts from: `<base URL>/api/connections/<name>/callback` when the app starts it, and `<base URL>/api/admin/connections/<name>/callback` when an operator clicks Connect in the console, which brings them back to the console's connections page. The base URL is `BASE_URL` when it is set and otherwise the address the request arrived on. Register the callback of every place you connect from — most providers accept several redirect addresses for one client. The same derived value is sent when the user is redirected and when the code is redeemed, as the provider requires. Set `redirectUri` only to use a different address; it then replaces the derived one in both places. `pkce: S256` is the one to choose where the provider supports it.

### Client credentials: no one authorizes anything

`grantType: clientCredentials` is the machine-to-machine grant, for an API that authenticates the client itself rather than a user. The connection needs only `clientId`, `clientSecret` and `tokenUrl`; there is no consent step and no connect button to click.

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

The first call that needs a token sends `grant_type=client_credentials` to the token endpoint, with the scopes (space-separated), the audience and any `extraTokenParams`, the client authenticated by HTTP Basic or, with `authenticationMethod: body`, in the form body. The token is stored encrypted as the connection's shared token and reused until it expires; the next call after that simply asks again. Changing the client, its secret, the scopes, the audience or the authentication method makes the next call ask for a new token rather than reuse one issued for the old configuration. A refused token request fails the step, naming the connection, and the API is never called without a token.

### App scope is an authorization gate, not a usage gate

`scope: app` stores **one** shared credential, and only an admin may authorize it: a non-admin reaching the connect endpoint gets a 404. Once stored, that credential is read by **every** automation referencing the connection — including cron-triggered and webhook-triggered runs, which have no user at all. Do not read `scope: app` as "only admins can use it".

`scope: user` issues and stores a token per end-user instead, so each person's HTTP and AI actions act as themselves. A manual trigger whose connection-bound actions are all user-scoped relaxes its implicit required role from admin to member; any app-scoped reference keeps it at admin.

Refresh happens automatically either way, and the refresh request honours `authenticationMethod`.

### Meta: exchanging for a long-lived token

Meta — Facebook Pages, Instagram — answers the code exchange with a token that lapses within hours, and never issues a refresh token. Declare `longLivedToken: { style: meta }` and Sovrium exchanges it at the callback, with a `GET` to the `tokenUrl` carrying `grant_type=fb_exchange_token`, the app's id and secret and the short-lived token; what is stored is the long-lived token Meta returns, valid about 60 days. If Meta refuses that exchange, the callback fails and nothing is stored. Afterwards, the first call made when the stored token has `renewWithinDays` (30 by default) or fewer left exchanges it again before using it, and stores the fresh one; a refused renewal is logged and the call goes ahead with the stored token, which is still valid. A connection nobody uses for 60 days lapses, and reports `reconnect-needed` beforehand.

### When nothing can renew the token

Some providers — LinkedIn, Meta — issue no refresh token: the token simply lapses, and only a new authorization replaces it. Sovrium reports that ahead of time. From 7 days before such a token expires, `GET /api/connections/<name>/status` answers `reconnect-needed` for the caller, and the connection list in `/_admin/connections` shows the same status with a **Reconnect** action. Once it has lapsed, a step using it fails, naming the connection and saying it needs reconnecting, and the API is not called. A token that does carry a refresh token keeps its usual statuses: `expired` there only means the next call refreshes it.

## API key

<!-- sovrium:options ApiKeyConnectionSchema -->

```yaml
# Requires env: [{ key: GITHUB_TOKEN }] at the top of the app
- name: github-api
  type: apiKey
  props: { key: $env.GITHUB_TOKEN, header: Authorization, prefix: Bearer }
```

`header` defaults to `X-API-Key`. `prefix` is what sits before the value when the service expects one, which is how an API key is sent through an `Authorization` header.

## Basic auth

<!-- sovrium:options BasicConnectionSchema -->

```yaml
# Requires env: [{ key: LEGACY_USER }, { key: LEGACY_PASS }] at the top of the app
- name: legacy-api
  type: basic
  props: { username: $env.LEGACY_USER, password: $env.LEGACY_PASS }
```

An API that takes its key as the Basic password with no username (Lemlist) is declared with `username: ''`: the pair is sent as `:<password>`. A connection whose username and password are both empty fails the step without calling the API.

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

The first call that needs a token posts `body` to `tokenUrl` — as JSON, or as form fields with `bodyType: form` — and reads the token at `tokenPath` (default `access_token`) and its lifetime in seconds at `expiresInPath` (default `expires_in`) in the JSON answer; an answer without a lifetime is kept for an hour. The token is stored encrypted as the connection's shared token and sent on every call in `header` (default `Authorization`) after `prefix` (default `Bearer`; `''` sends it alone) until it expires, when the next call asks again. Concurrent first calls share one token request, and changing the endpoint, the credential or the paths makes the next call ask for a new token rather than reuse one issued for the old configuration. A refused token request fails the step, naming the connection, and the API is never called without a token. `tokenUrl` passes the same outbound-address guard as the http actions.

## Using one

```yaml
- name: fetch
  type: http
  operator: get
  props: { url: 'https://api.example.com/me', connection: github-api }
```

## Operations: an endpoint declared once, called by name

A connection can also declare the endpoints of its service as `operations`, against a `baseUrl`. Each operation names the method, the path and the parameters it takes, with where each one goes and its type; an automation step then calls it by name with `type: connection`, `operator: call`.

```yaml
env:
  - { key: QONTO_API_KEY, description: Qonto API key }
  - { key: BANK_IBAN, description: IBAN of the account to read, secret: false }

connections:
  - name: qonto
    type: apiKey
    props: { key: $env.QONTO_API_KEY, header: Authorization }
    baseUrl: https://thirdparty.qonto.com/v2
    operations:
      - name: list-transactions
        method: GET
        path: /transactions
        params:
          iban: { in: query, type: string, required: true }
          status: { in: query, type: array, items: { type: string, enum: [pending, completed] } }
        pagination:
          {
            style: page,
            pageParam: current_page,
            itemsPath: transactions,
            nextPath: meta.next_page,
          }

automations:
  - name: rent-payments
    trigger: { type: manual }
    actions:
      - name: fetch
        type: connection
        operator: call
        props:
          connection: qonto
          operation: list-transactions
          params: { iban: $env.BANK_IBAN, status: [completed] }
          paginate: all
```

Sovrium places and encodes every value: a path parameter fills exactly one `{name}` segment, even when the value holds a `/`; a query array is sent as repeated keys (`status=pending&status=completed`); body parameters become a JSON object by default, or a form or multipart body when the operation's `body` says so; header parameters travel as request headers. The connection's own authentication is attached to every request, OAuth2 tokens included, refreshed first when they have expired.

`baseUrl` is a literal URL, `$env.VAR`, or `$token.FIELD` for a service that hands each customer their own API root with the token. Salesforce returns it as `instance_url`: keep it with the OAuth2 prop `tokenFields: [instance_url]` and set `baseUrl: $token.instance_url`. The kept fields are captured from every token response — the first exchange and each refresh — and stored encrypted with the token; a config whose `baseUrl` reads a field the connection does not keep is refused when it loads.

A call is checked when the config loads: an unknown operation, a parameter the operation does not declare, a missing required parameter or a literal of the wrong type refuses the config, naming the step. A value produced by a template is checked when the step runs.

What the next step reads:

- `steps.<name>.data` is the decoded response body. With `paginate: all`, or `paginate: N` for at most N pages, it is instead the items of every page read, concatenated in order, following the operation's `pagination` (page number, offset, cursor, the `Link` header, or the id of the last item read — `style: lastItem`, which stops when `hasMorePath` reads false).
- `steps.<name>.response.status` and `steps.<name>.response.headers` describe the last answer.

A non-2xx answer fails the step, and its error names the operation and the status. A `429` or `503` answer carrying `Retry-After` is retried after the delay the service asked for, up to three times and never after a wait longer than a minute. Every request passes the same outbound-address guard and per-request timeout (`timeout`, 15 seconds by default) as the HTTP actions.

<!-- sovrium:options ConnectionOperationSchema -->

## Not the same thing as an API key your instance issues

A connection of `type: apiKey` holds **somebody else's** credential so an automation can call **their** API. It is outbound. The keys your own instance issues so that somebody can call **yours** are a separate, opt-in feature. Enabling either says nothing about the other.
