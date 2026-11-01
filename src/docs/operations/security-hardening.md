# Security Hardening

> Platform-wide security guarantees: hardened HTTP response headers, CSRF and cross-origin enforcement, rate limiting, and 404-not-403 anti-enumeration, applied in code on every response.

Sovrium designs out the recurring failure modes of insecure apps (exposed surfaces, missing auth, broken object-level authorization, enumerable endpoints) at the platform layer, so every app inherits the defences with no per-app configuration. Every HTTP response carries a hardened header set, CSRF is enforced on any public deployment, sensitive endpoints are rate-limited, and unauthorized access returns `404` rather than `403`.

These guarantees are applied **in code**, not only at a reverse-proxy ingress, so they hold even for a self-hosted deploy with no proxy attached.

## Defaults for a new app

A config that says nothing about access opens nothing it did not name. Each default below is one line of config to change, and each change is a decision you make on purpose:

- **Sign-up is closed.** Nobody creates an account unless the config says `allowSignUp: true`; people join by invitation or are created by an administrator. A magic-link strategy and an SSO provider can each open their own sign-ups with their own `allowSignUp`. See **Registration Control**.
- **A password account confirms its address when the app also offers a federated sign-in.** With an `oauth` strategy or an `auth.sso` provider declared, a new password account cannot sign in until it follows the link it was sent, so nobody can hold an address that a provider will later sign into. Write `requireEmailVerification: false` on the strategy to turn it off.
- **An app with no `auth` block serves only what a table opens to everyone.** Nobody can sign in to such an app, so a visitor holds exactly the operations a table declares with `all`, one operation at a time, on every door: the records API, pages, search, the AI chat, feeds, a static export and the MCP tools. `authenticated` and a list of roles admit nobody there, and a table that does not open an operation answers it as a table that does not exist (`404`). Field `read` rules do not narrow what such a visitor sees of a table she may read; a write-only field is still never returned. The operator console mounted into an app is not concerned: it shows the host app's tables under the host app's sign-in.
- **A public bucket takes uploads from administrators only** unless it declares `permissions.upload`. A file anyone can download should not be one anyone can place.

## Accounts and API keys

- **A password reset signs every session out.** A session opened with a leaked password does not outlive the reset meant to shut it out.
- **Password accounts are refused on a domain an identity provider owns.** An address on a domain listed in an `sso[].domains` entry cannot sign up with a password or be moved there by an email change, and a first SSO sign-in never joins an existing account whose own address was never verified.
- **Groups and the organisation are changed by administrators only.** Every route that changes them answers `404` to anyone else, whatever their organisation role, and an account that is not an administrator joins the organisation as a member, never as its owner.
- **An API key lives one year** unless it is minted with a shorter `expiresIn`, and is confined to reading its own session and revoking itself. Every account route under `/api/auth/` answers a key `404`, whoever owns it, with two exceptions: `GET /api/auth/get-session` and `POST /api/auth/api-key/delete` naming the key's own id. Minting keys, enrolling a passkey, two-step verification, the profile, sessions, account deletion, account management and the organisation all need the person signed in. See **API Keys**.
- **A password reset or turning on two-step verification revokes the account's API keys**, along with its sessions (all of them on a reset, every one but the one that turned it on for two-step verification), and adding a key or a passkey emails the owner.

## HTTP security headers

Every response (page, API, static asset or `404`) carries a hardened header set, applied by an app-wide middleware registered ahead of every route, so it runs before route matching and covers error responses.

| Header                              | Value or behaviour                                                                                                          |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `Strict-Transport-Security`         | `max-age=31536000; includeSubDomains`: a one-year HSTS covering subdomains.                                                 |
| `Content-Security-Policy`           | **Enforced**, structural directives only: `frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'`. |
| `X-Frame-Options`                   | `DENY`, the legacy twin of `frame-ancestors 'none'`.                                                                        |
| `X-Content-Type-Options`            | `nosniff`, disabling MIME sniffing.                                                                                         |
| `Referrer-Policy`                   | `strict-origin-when-cross-origin`.                                                                                          |
| `Cross-Origin-Opener-Policy`        | `same-origin`.                                                                                                              |
| `Cross-Origin-Resource-Policy`      | `same-origin`.                                                                                                              |
| `Permissions-Policy`                | Denies camera, microphone, geolocation, payment, USB, accelerometer, gyroscope and magnetometer.                            |
| `Origin-Agent-Cluster`              | `?1`, requesting origin-keyed agent clustering.                                                                             |
| `X-DNS-Prefetch-Control`            | `off`.                                                                                                                      |
| `X-Download-Options`                | `noopen`.                                                                                                                   |
| `X-Permitted-Cross-Domain-Policies` | `none`.                                                                                                                     |
| `X-XSS-Protection`                  | `0`, disabling the legacy auditor that CSP supersedes.                                                                      |
| `X-Powered-By`                      | **Removed**: the framework fingerprint is stripped.                                                                         |

**The CSP is enforced, and deliberately structural.** It carries only the four directives that never touch inline content and so have effectively no legitimate-traffic blast radius. `frame-ancestors 'none'` is the one that matters most, because a report-only policy ignores it entirely, so it protects against clickjacking only when enforced. The policy deliberately **omits** `default-src`, `script-src` and `style-src`, because the server-rendering layer still emits inline `script` and `style` elements; none of the four directives present inherits from `default-src`, so nothing silently falls back to a missing one. A spec asserts both halves, so a premature flip that adds `script-src` or `style-src` fails CI.

There is deliberately **no** `Content-Security-Policy-Report-Only` header. A report-only policy with no `report-to` or `report-uri` sink collects nothing and only writes browser console warnings, so it is not shipped. Tightening `script-src` and `style-src` is a scoped follow-up using per-request nonces, which first needs a nonce threaded through every inline server-render emit point.

A route may override the CSP and `X-Frame-Options` together: the two express one framing decision in two vocabularies. Both directions are in use: signed bucket downloads stream untrusted bytes under a stricter `default-src 'none'`, and the admin design-system component frames answer `frame-ancestors 'self'` so the console page can embed them. The same `'self'` pair is given to every address an `iframe` of the app's own pages names by a path (`src: /embeds/booking`): the author framed it on purpose, and only those addresses relax. A route that says nothing, and every address no page frames, keeps the platform default.

**Naming who may frame the app.** `SOVRIUM_FRAME_ANCESTORS` lists origins allowed to show the app in a frame, for your own dashboard or editor. Set, every response that carries the platform default answers `frame-ancestors <the list>` instead of `'none'`, with the three other directives unchanged, and **drops `X-Frame-Options`**, which can say `DENY` or `SAMEORIGIN` but cannot name a list. An address one of the app's pages frames answers `frame-ancestors 'self' <the list>`, and a route with a stricter policy, the signed bucket download, keeps it. A malformed value refuses to start. To keep a staging or preview instance private as well, see the preview token in **Environment Variables: Hosting Under a Supervisor**.

HSTS is emitted unconditionally even over plain HTTP: browsers ignore it on an `http://` connection, and a TLS-terminating proxy forwards exactly the value the server produces.

## CSRF and cross-origin enforcement

A request that carries the session cookie and changes something is refused with `403` when another site sent it, so a cross-site forgery cannot ride a visitor's session. The check runs on every route, ahead of any session lookup or handler, and covers `POST`, `PUT`, `PATCH` and `DELETE`, a WebSocket upgrade, and the event-stream subscriptions a `GET` opens. Such a request passes when its `Origin` is a trusted origin (below) or the very address the request was sent to; with no `Origin`, it is refused when the browser marks it `Sec-Fetch-Site: cross-site`. A request carrying neither header comes from a server or a script, not from a browser acting for a visitor, and is served. The sign-in routes under `/api/auth/*` run a stricter check of their own as well.

**What decides whether the check is active is the deployment's transport posture, not `NODE_ENV`.** The posture is _relaxed_ when the master opt-out `SOVRIUM_ALLOW_INSECURE` is set to `1` or `true` (any other non-empty value refuses to start, `0` and `false` included), or when the resolved host is loopback: `localhost`, `127.0.0.0/8`, `::1`. In a relaxed posture the origin check is bypassed and cookies drop the `Secure` attribute, which is what makes local cross-port development work. In every other posture both are enforced.

The host resolves public-origin-first: the host of `BASE_URL`, then the address the server binds (`SOVRIUM_BIND_HOST`), then `localhost`. A public deployment that sets only `BASE_URL` is therefore correctly classified non-loopback and keeps the secure posture, and so is one behind a reverse proxy that binds `127.0.0.1` while `BASE_URL` names its `https` address. The startup warnings follow the same origin, each a `⚠` line in the banner:

- `SOVRIUM_ALLOW_INSECURE` accepted on a non-loopback origin;
- a reachable bind with `BASE_URL` unset or loopback;
- a reverse proxy declared with `TRUSTED_PROXY_HOPS` in front of a loopback socket while `BASE_URL` is unset or loopback: the server is published but still behaves as if local;
- an `https` `BASE_URL` with `TRUSTED_PROXY_HOPS` unset, which makes every visitor share the proxy's rate-limit address;
- dev mode left on behind a public origin.

The reverse is the trap: a loopback `BASE_URL` such as `http://localhost:3000` relaxes the posture even when the port is published and reachable from the internet, because `BASE_URL` is read before the socket's real reach. On any host other people can reach, set `BASE_URL` to the public `https://` address they type.

Turn dev mode off before launch: unset `SOVRIUM_DEV_MODE`, which `sovrium dev` sets, so the sign-in page stops showing an account to every visitor. A server that is not strictly local also refuses to store a connection token shaped like the placeholder the test suite uses.

Two consequences worth knowing:

- **A strictly local server answers only its own names.** Bound to loopback with neither `BASE_URL` nor `TRUSTED_PROXY_HOPS` set, the server answers `404` to a request addressed to any name other than `localhost`, `127.0.0.1`, `[::1]`, the address it binds, a loopback `BASE_URL` or a `*.localhost` name, so a web page that points a name of its own at your machine cannot read the app through it. A request forwarded over `https`, or addressed to another name, prints one warning naming the two variables to set: it means a reverse proxy stands in front of the server undeclared.
- `0.0.0.0` and `::` are deliberately **not** loopback. They are the wildcard bind (every interface the machine has), so the ordinary container idiom `SOVRIUM_BIND_HOST=0.0.0.0` is a public bind and keeps the secure posture.
- Trusted origins are the app's own `BASE_URL` origin, the origin of each identity provider declared under `auth.sso` (its OIDC `issuer` or SAML `entryPoint`), and the origins you list in `SOVRIUM_CORS_ORIGINS`, and nothing else, **never** a wildcard. A wildcard is an origin-validation bypass; scoping it is also what makes an external-origin `redirectTo` on password reset an untrusted origin rather than a followed one. A provider's origin is trusted because the server fetches from it and the browser posts back from it, so declare only providers you control the issuer of.

The container image sets `NODE_ENV=production`, for asset caching and logging. It decides neither CSRF nor cookie flags, nor any other security behaviour on this page.

**JSON routes take only JSON.** A browser sends a cross-site request without a CORS preflight when its body is `text/plain`, a form encoding or untyped, so the records API (`/api/tables/<table>/…`) refuses any request body not labelled `application/json` with `415 Unsupported Media Type`, before anything reads it and whatever the posture. The few routes built for an HTML form post accept the form encodings and nothing else.

**A front-end on another origin.** Out of the box the data API sends no CORS header, so a browser refuses to hand its answers to any other site, and `/api/auth/*` answers only the `BASE_URL` origin (plus loopback origins in a relaxed posture). A front-end you host elsewhere (a static site, a framework app on its own domain) is named in `SOVRIUM_CORS_ORIGINS`. Each listed origin is answered on `/api/tables/*`, `/api/buckets/*` and `/api/auth/*` with its own origin in `Access-Control-Allow-Origin`, `Access-Control-Allow-Credentials: true` and `Vary: Origin`, never `*`; its preflights are granted for `GET`, `POST`, `PUT`, `PATCH` and `DELETE` with the `Content-Type` and `X-Api-Key` headers, cached for ten minutes; and it joins the trusted origins above. The operator API (`/api/admin/*`) never answers another origin. An origin you did not list is answered exactly as before: no CORS header, and no refusal of its own.

In a secure posture a non-empty list also makes the session cookie `SameSite=None; Secure`, so a front-end on another site receives it with `credentials: 'include'`. That cookie then travels on cross-site requests, and the check above is what refuses one from an origin you did not list. Unset, the cookie keeps `SameSite=Lax`. The variable's grammar is in **Environment Variables: Hosting Under a Supervisor**.

## Rate limiting

Custom middleware rate-limits the sensitive endpoints.

| Endpoint                                                                                                                                 | Limit per caller | Window |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ------ |
| All `/api/*`, the MCP endpoint, and page / `.md` / `/_admin` requests carrying a credential (per address, ahead of every session lookup) | 1200 requests    | 60 s   |
| `POST /api/auth/sign-in/email`                                                                                                           | 20 attempts      | 60 s   |
| `POST /api/auth/sign-up/email`                                                                                                           | 20 attempts      | 60 s   |
| `POST /api/auth/request-password-reset`                                                                                                  | 10 attempts      | 60 s   |
| `POST /api/auth/two-factor/verify-totp`                                                                                                  | 30 attempts      | 60 s   |
| `POST /api/auth/two-factor/verify-otp`                                                                                                   | 30 attempts      | 60 s   |
| `POST /api/auth/two-factor/verify-backup-code`                                                                                           | 30 attempts      | 60 s   |
| `POST /api/auth/oauth2/register`                                                                                                         | 20 requests      | 60 s   |
| `POST /api/auth/sign-in/magic-link`                                                                                                      | 5 requests       | 60 s   |
| `POST /api/auth/email-otp/send-verification-otp`                                                                                         | 3 requests       | 60 s   |
| `POST /api/auth/email-otp/request-password-reset`                                                                                        | 3 requests       | 60 s   |
| `POST /api/auth/forget-password/email-otp`                                                                                               | 3 requests       | 60 s   |
| `POST /api/auth/send-verification-email`                                                                                                 | 3 requests       | 60 s   |
| `POST /api/auth/change-email`                                                                                                            | 3 requests       | 60 s   |
| `POST /api/auth/admin/invite-user`                                                                                                       | 10 requests      | 60 s   |
| `POST /api/auth/device/code`                                                                                                             | 20 requests      | 60 s   |
| `GET /api/auth/passkey/generate-authenticate-options`                                                                                    | 30 requests      | 60 s   |
| `GET /api/tables`, `GET /api/tables/*`, a visitor who is not signed in (per address)                                                     | 100 requests     | 60 s   |
| `GET /api/tables`, `GET /api/tables/*`, a signed-in person                                                                               | 600 requests     | 60 s   |
| Every request to `/api/tables*` made with an API key (per key)                                                                           | 300 requests     | 60 s   |
| `POST`, `PATCH`, `PUT` and `DELETE` on `/api/tables/*` (one budget for every record write)                                               | 120 requests     | 60 s   |
| `GET /api/activity`, `/api/activity/*`                                                                                                   | 60 requests      | 60 s   |
| `POST /api/auth/admin/*`                                                                                                                 | 10 requests      | 1 s    |

Every 60-second window above is one span, adjustable together with `RATE_LIMIT_WINDOW_SECONDS`, which must be a whole number of seconds above zero. Any other value refuses to start the server, naming the variable and the value. The caps themselves are fixed, except three: the per-address ceiling on the first row, which `API_IP_RATE_LIMIT` sets, the record-write budget, which `RATE_LIMIT_WRITES` sets, and a signed-in person's record reads, which `RATE_LIMIT_READS` sets. Each must be a whole number above zero, or the server refuses to start, naming the variable. The admin window is a hardcoded one second. It is sized for dashboard polling, not for brute-force resistance, and the auth check below is what protects those routes. The two scales differ by a factor of sixty on purpose: consolidating them onto one window would silently weaken admin from ten requests per second to ten per minute.

**The per-address ceiling** is one budget shared by every API endpoint (the health check aside) and by the form routes of an app with sign-in, counted per client address even for a signed-in caller. It runs before any session lookup, so one address cannot hammer the database with session and API-key lookups through a route that has no limit of its own; an API request that carries no credential at all (no session cookie, no `Authorization`, no `x-api-key`) is counted but triggers no lookup. At twenty requests a second it sits well above every limit below, which keep refusing first. Because it cannot tell apart the people behind one address, `API_IP_RATE_LIMIT` raises or lowers it: raise it when many users reach the app through one office or proxy address. The default spreads thin there: twenty people behind one office address share 1200 requests, about 60 a minute each, while a grid page alone can read and write a few dozen. Size it at roughly 150 per person who works from that address at the same time; a hosted instance serving many offices wants several thousand. A value that is not a whole number above zero refuses to start the server, naming the variable. The address is resolved as for every other limit, so `TRUSTED_PROXY_HOPS` decides which forwarding header is believed, and it also decides whether `X-Forwarded-Host` and `X-Forwarded-Proto` are believed (see **Reverse proxies** below). The MCP endpoint counts against the same budget wherever `MCP_MOUNT_PATH` mounts it, before its credential is checked; its own per-credential limits still apply beneath. A page, a `.md` twin or a console request counts when it carries a credential (the session cookie, `Authorization`, or `x-api-key`), since each of those makes the page look the session up; one that carries none is neither counted nor refused, so a public audience behind one address never spends the budget. Every per-address limit on this page counts an IPv6 client by its /64 (the block one connection is given) and an IPv4-mapped IPv6 address as the IPv4 address it carries; logs and sessions still record the full address.

Every other limiter is a sliding window, counted separately for each endpoint, so one endpoint's budget cannot be spent by traffic to another. Who counts as one caller depends on the endpoint:

- **`/api/tables` and `/api/tables/*`** count a request made with an API key by that key, a signed-in caller by their user, and a caller who is not signed in by IP address. Several people behind one proxy address therefore each keep their own budget, and anonymous traffic that spends an address's budget does not refuse a signed-in user at that address. Visitors who are not signed in share one budget per address, since nothing else tells them apart. A signed-in person's reads are capped at a ceiling no one reaches by using pages (600 a window): it is there to slow, and make visible, a session used to copy a whole base. Each API key has its own budget of about five requests a second, reads and writes together, so a script spending its key's budget never refuses its owner's browser. The MCP endpoint keeps its own per-credential limits.
- **Every other endpoint**, the sign-in, sign-up, password-reset, one-time-code, magic-link, verification-mail, email-change and invitation limits included, counts by IP address.
- **The address a sign-in mail goes to** has a budget of its own, on top of the per-client rows: see **One budget per address** below.

**Every record write shares one budget.** A create, an update and a delete under `/api/tables/*` all count against the same 120 a window (`RATE_LIMIT_WRITES`), so a client that edits records one request at a time meets the limit whichever method it uses. A batch request counts as one write however many records it carries: send many changes through the batch endpoints, as a grid's bulk actions do. A grid deleting its rows one at a time takes each row out at once and re-reads the page once the deletes pause, not after every delete. A page that hits the limit tells its reader in a toast how many seconds to wait, and a form posted without scripts is sent back to a page that says so rather than to the raw `429` answer.

A table that lets visitors create records (`create: all`) additionally limits those anonymous creates per table, as a public form is limited: 10 per visitor address and 1000 per table every 60 seconds. That limit applies on top of the records limit above.

`POST /api/auth/oauth2/register` registers an OAuth client, and only an administrator may do it: a caller who is not signed in is answered `401` before the limiter ever binds, and a signed-in person who is not an administrator is refused. AI clients such as Claude Desktop and Cursor register themselves before anyone has signed in; to let them, set `SOVRIUM_OAUTH_ANONYMOUS_CLIENT_REGISTRATION=true`, which opens registration to any caller. Each request then writes a row carrying a caller-chosen client name that a consent screen will later show a user, so it is capped at the sign-up rate.

**Every route that sends mail to an address the caller names is limited.** A magic link, a one-time code, a password-reset code, a verification resend and an email change each mail an address the request supplies, and an invitation mails any address its sender types, so without a cap one client could flood a stranger's inbox and damage your mail server's sending reputation. Each route counts on its own, every request counts (a refused one included), and the request past the budget answers `429` with a `Retry-After` header **and sends no mail**: it is refused before anything is generated or sent. An invitation additionally counts against the per-second admin limit in the table above.

**One budget per address.** The routes that mail a sign-in or recovery code or link (a magic link, a one-time code, a password-reset link or code, a verification resend) also share one budget per address the mail goes to: five mails per address per window, whichever routes asked and from whichever client addresses. The address is compared in lower case, as accounts are. The request past it answers `429` with a `Retry-After` header and sends nothing, while other addresses are unaffected. A client spreading its requests over several routes, or over several addresses of its own, still cannot send one inbox more than five.

**Ten wrong codes lock an address for a while.** The routes that check a mailed one-time code (signing in with it, checking it, verifying an address and resetting a password with it) count, per address, every attempt that does not succeed. After ten in fifteen minutes, the next attempt for that address is refused before the code is looked at, even when the code is right: `429` with `code: "TOO_MANY_CODE_ATTEMPTS"` and a `Retry-After` header, until the oldest of those attempts is fifteen minutes old. A right code clears the count. An attempt counts when it starts, so guesses sent all at once cannot slip past it, and the checks for one address run one at a time, so each code's own limit of three wrong attempts holds on PostgreSQL too. The lock is per address, not per client: someone who knows an address can keep its codes locked out, so keep another way in (a password or a passkey) for the accounts that matter. Like every limit on this page, the counts live in the server's memory and start again when it restarts.

**Anonymous requests that store a row are limited too.** Asking for a device code and asking for passkey sign-in options each write a row without a session (a pending device sign-in, a sign-in challenge), so each is capped per client address in the table above. Rows that expire without being used are deleted every day at 03:30 in the operator timezone (`SOVRIUM_TIMEZONE`), so the tables do not grow with abandoned attempts.

Exceeding a limit returns `429 Too Many Requests`. Admin routes additionally run an auth-check middleware that returns `401` **before** parameter validation, so an unauthenticated caller never learns the shape of a protected endpoint.

If your deployment needs stricter caps, put a rate limiter in front of Sovrium at the reverse proxy. The built-in limits are a floor against casual abuse, not a substitute for edge protection.

## Request size

Every API route, sign-in included, refuses a body larger than `API_BODY_LIMIT_BYTES`, 1 MB by default, with `413 Payload Too Large` before reading it, so a public endpoint cannot be made to hold large bodies in memory. A route that takes a file (a bucket upload, a form with an attachment, an import, an avatar) accepts a body as large as the largest upload the deployment allows instead; see **File Lifecycle & Quotas**.

## Anti-enumeration: 404, not 403

Unauthorized access to a protected resource returns **`404 Not Found`**, never `403 Forbidden`. A `403` confirms the resource exists; a `404` does not tell the caller whether it exists. This applies uniformly across record reads, record writes and deletes, and the admin dashboard. The delete pipeline is a worked example of where the rule stops: an authorization denial and a genuinely absent record both answer `404`, but a driver-originated failure is sanitized into its real status rather than disguised, so an infrastructure fault reaches the operator instead of being reported to the caller as "not found".

Object-level authorization is enforced before any sensitive logic runs: a request is authenticated, then checked for access to the specific object, and on failure returns `404`.

**Record ids are sequential, not secret.** A record's `id` is an integer that counts up, so anyone can guess which ids are likely to exist. The `404` hides whether a given record exists and what it holds; it does not hide the id space. Never treat a record id as a secret: whoever holds a link such as `/rate?ticket=42` can change the number to reach every other ticket, so anything that must only be reachable by one person needs a permission check, not an id in the URL.

## Reverse proxies

`TRUSTED_PROXY_HOPS` tells Sovrium how many proxies stand between the internet and the server. It decides which forwarded client address is believed for rate limits, and it also decides whether `X-Forwarded-Host` and `X-Forwarded-Proto` are believed when Sovrium builds an absolute link and `BASE_URL` is not set. With the default `0`, those headers are whatever the client typed and are ignored. Set it to the number of proxies you actually run and no higher: a count above that lets a client forge its own address, and the host printed in links. Setting `BASE_URL` removes the second risk entirely, because a declared `BASE_URL` always wins over any header.

## Outbound requests

Requests the server makes on your configuration's behalf (automation HTTP and webhook actions, outgoing webhooks, connection token exchanges, a configuration fetched from a URL) are checked before they are sent, and again at every redirect they follow: a target on `localhost` or any name under `.localhost` (`ollama.localhost`, in any case and with or without a trailing dot, since the whole zone is reserved for loopback), a loopback, private or link-local address (cloud metadata endpoints included) is refused. Addresses are compared by value, so an IPv6 spelling of a refused IPv4 address (`[::ffff:127.0.0.1]`) is refused too.

A host name is judged by the address it resolves to, not by how it is spelled: it is resolved before each request and each redirect, refused when it points at an address refused above, and the request is sent to the address that was checked, so the name cannot answer differently between the check and the connection. Three requests are still judged by the name as written: the redirects a configuration, a template or a bundle fetched from an address follows, a file an import downloads from the address its source gives, and the WebSocket connections a page opens during a browser automation step. On a server that shares a network with internal services, restrict its outbound traffic at the firewall as well.

`SOVRIUM_ALLOW_PRIVATE_OUTBOUND=1` (or `true`) lifts the private-address refusal so an integration on your own network can be reached; leave it unset unless you need exactly that.

Two more limits hold for what leaves the server. An OAuth connection sends a PKCE challenge (`S256`) unless the connection declares `pkce: none` for a provider that refuses one. An automation `code` step sees only the environment variables the config declares, never the server's whole environment.

## Uploads

Files go to buckets, and a bucket's `permissions` block decides who may upload, download and delete. Leaving an operation out does not always close it:

- **Upload.** An undeclared `upload` admits any signed-in user on a private bucket, and administrators only on a `public: true` bucket, on every app.
- **Delete and replace.** An undeclared `delete`, and replacing a file that is already there under an undeclared `upload`, belong to the person who uploaded the file and to administrators.
- **Download.** An undeclared `download` admits any signed-in user; `public: true` opens downloads to everyone, and nothing else.

On an app with no `auth` block nobody can sign in: a public bucket takes no upload until it declares one, and nobody owns its files, so a visitor deletes or replaces a file only where the bucket declares `delete: all` (or `upload: all` for replacing one). See **Bucket Permissions**. A delete refused there answers `404`. The built-in `system` bucket of such an app keeps taking a visitor's new file, because that is where a page's file-upload form puts its attachment, but never lets a visitor delete or replace one: an attachment goes with its record.

A form stores a file only under a field it declares that takes a file; a file posted under any other name refuses the whole submission, and nothing is stored.

One upload is capped at 100 MB unless a bucket's `maxFileSize` or the `STORAGE_MAX_FILE_SIZE` variable says otherwise, and a bucket's `allowedMimeTypes` restricts what it accepts. `STORAGE_MAX_TOTAL_SIZE`, when set, caps the storage all files take together, a form's files included.

## Content from records and requests

A value someone typed is shown as what it is, never run as part of the page:

- **Rich text is cleaned on every road that writes a record** (the records API and its batch, upsert and import routes, forms, automations, the AI chat and the MCP tools), and the formats of `email` and `url` fields are checked on each of them.
- **A `url` field holds an absolute `http` or `https` address.** A record value placed in an address attribute (`href`, `src`, `action`) of a page is checked again, and dropped when it is not a web address or a path on the app.
- **Values from the address bar and from other records are text.** A route or query value, an invitation's details and a neighbouring record's values are shown as characters inside content written as HTML, never as elements.
- **Page values never go into scripts or styles.** A script or style a page declares keeps the text the config gives it, and the body of a tab panel is text.

## Mail

Mail to a server that is not on the same machine requires TLS: a connection encrypted from its first byte (port 465, or `SMTP_SECURE=true`) is one, and any other must upgrade with STARTTLS before the account or the message is sent, or nothing is sent. `SMTP_ALLOW_PLAINTEXT=1` (or `true`) lifts that for a relay on a network you control.

With no mail server configured, a message Sovrium cannot send is printed whole, links included, only when the server is strictly local: a loopback origin with no reverse proxy declared, and `NODE_ENV` not `production`. Anywhere else the log gets one line naming the recipient and the subject, with every link removed, because a sign-in or reset link is a credential and a log is read by other people.

## Secrets and rotation

The encryption key (`SOVRIUM_ENCRYPTION_KEY`, or the `encryption-key` file Sovrium writes into the data directory when the variable is unset) protects stored connection credentials. The session-signing secret is derived from it unless you set `AUTH_SECRET`, in which case `AUTH_SECRET` wins.

Rotating either one has a cost, so plan it:

- **A new encryption key** leaves stored connection tokens unreadable (those users reconnect their integrations) and, when `AUTH_SECRET` is not set, also signs every user out.
- **A new `AUTH_SECRET`** signs every user out and invalidates every signed link and token issued under the old one. Stored credentials are not affected.

Setting `AUTH_SECRET` therefore decouples the two: a key change no longer signs anyone out, and a session reset no longer touches stored credentials. The price is a second secret to keep safe and back up.

## Backups

The SQLite database and its `-wal` and `-shm` companions are readable and writable by the service account only (`0600`), and the data directory, like each directory the local storage provider creates, is created `0700`. A directory that already existed, such as the working directory, keeps its mode.

A `sovrium backup` archive is a master credential. It holds every row of your data and, when the key lives in the data directory, the `encryption-key` file, with which whoever holds the archive can decrypt every stored credential and, unless `AUTH_SECRET` is set separately, sign a session as any user, admins included. Encrypt archives before they leave the machine, restrict who can read them, never put one on a shared drive, and test a restore. See **Back Up and Restore**.

## Updates

Only the latest release receives security fixes, so stay on it: `sovrium update` replaces the binary with the latest release, and the project's releases page lists what changed. `sovrium update` refuses on a mismatch, and refuses when the checksum file cannot be fetched or read; `--insecure-skip-checksum` installs without the check and prints `Checksum not verified`.

## Reporting a vulnerability

Report a security issue by email to **security@sovrium.com**, never in a public issue. The project's `SECURITY.md` gives the response times.

## Defence in depth, summarised

- **Transport security**: HSTS with a one-year max-age, covering subdomains.
- **MIME and clickjacking**: `nosniff`, `X-Frame-Options: DENY` and the enforced `frame-ancestors 'none'`.
- **Cross-origin isolation**: same-origin opener and resource policies, plus the enforced structural CSP.
- **CSRF**: the origin check on every route of any non-loopback posture, with trusted origins scoped to `BASE_URL`, each declared identity provider's origin and `SOVRIUM_CORS_ORIGINS`.
- **Request size**: a 1 MB body limit on every route that takes no file.
- **Closed defaults**: sign-up closed, a no-auth app open only where a table says `all`, public buckets written by administrators.
- **Injection**: rich text cleaned on every write, `url` fields limited to web addresses, request and record values shown as text.
- **Outbound requests**: private addresses refused, by the address a name resolves to.
- **Brute force**: per-endpoint rate limiting, answering `429`.
- **Enumeration**: `404` rather than `403`, and the auth check before validation. Record ids are sequential, so they are never a secret.
- **Authorization**: roles, field-level permissions and object-level checks.

## Related reading

- **Auth Overview**: auth strategies and the `auth` block.
- **Sessions**: session lifetime, revocation and secure cookies.
- **Auth, Roles & RBAC**: the role model and field-level permissions.
- **Table Permissions**: per-table and per-field access control.
- **Bucket Permissions**: who may upload, download and delete files.
- **Back Up and Restore**: what a backup archive holds.
- **GDPR & Privacy**: data export and erasure guarantees.
- **Environment Variables**: `BASE_URL`, `NODE_ENV` and related settings.
