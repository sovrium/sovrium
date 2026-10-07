# Security Hardening

> Platform-wide security guarantees — hardened HTTP response headers, CSRF and cross-origin enforcement, rate limiting, and 404-not-403 anti-enumeration, applied in code on every response.

Sovrium designs out the recurring failure modes of insecure apps — exposed surfaces, missing auth, broken object-level authorization, enumerable endpoints — at the platform layer, so every app inherits the defences with no per-app configuration. Every HTTP response carries a hardened header set, CSRF is enforced on any public deployment, sensitive endpoints are rate-limited, and unauthorized access returns `404` rather than `403`.

These guarantees are applied **in code**, not only at a reverse-proxy ingress, so they hold even for a self-hosted deploy with no proxy attached.

## HTTP security headers

Every response — page, API, static asset or `404` — carries a hardened header set, applied by an app-wide middleware registered ahead of every route, so it runs before route matching and covers error responses.

| Header                              | Value or behaviour                                                                                                          |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `Strict-Transport-Security`         | `max-age=31536000; includeSubDomains` — a one-year HSTS covering subdomains.                                                |
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
| `X-Powered-By`                      | **Removed** — the framework fingerprint is stripped.                                                                        |

**The CSP is enforced, and deliberately structural.** It carries only the four directives that never touch inline content and so have effectively no legitimate-traffic blast radius — `frame-ancestors 'none'` is the one that matters most, because a report-only policy ignores it entirely, so it protects against clickjacking only when enforced. The policy deliberately **omits** `default-src`, `script-src` and `style-src`, because the server-rendering layer still emits inline `script` and `style` elements; none of the four directives present inherits from `default-src`, so nothing silently falls back to a missing one. A spec asserts both halves, so a premature flip that adds `script-src` or `style-src` fails CI.

There is deliberately **no** `Content-Security-Policy-Report-Only` header. A report-only policy with no `report-to` or `report-uri` sink collects nothing and only writes browser console warnings, so it is not shipped. Tightening `script-src` and `style-src` is a scoped follow-up using per-request nonces, which first needs a nonce threaded through every inline server-render emit point.

A route may override the CSP and `X-Frame-Options` together — the two express one framing decision in two vocabularies. Both directions are in use: signed bucket downloads stream untrusted bytes under a stricter `default-src 'none'`, and the admin design-system component frames answer `frame-ancestors 'self'` so the console page can embed them. A route that says nothing keeps the platform default.

HSTS is emitted unconditionally even over plain HTTP — browsers ignore it on an `http://` connection, and a TLS-terminating proxy forwards exactly the value the server produces.

## CSRF and cross-origin enforcement

A state-changing, cookie-bearing request whose `Origin` is forged or stripped is rejected, so a cross-site forgery cannot ride a victim's session cookie.

**What decides whether the check is active is the deployment's transport posture, not `NODE_ENV`.** The posture is _relaxed_ when the master opt-out `SOVRIUM_ALLOW_INSECURE` is set to `1` or `true` (any other non-empty value refuses to start, `0` and `false` included), or when the resolved host is loopback — `localhost`, `127.0.0.0/8`, `::1`. In a relaxed posture the origin check is bypassed and cookies drop the `Secure` attribute, which is what makes local cross-port development work. In every other posture both are enforced.

The host resolves public-origin-first: the host of `BASE_URL`, then the address the server binds (`HOSTNAME`), then `localhost`. A public deployment that sets only `BASE_URL` is therefore correctly classified non-loopback and keeps the secure posture, and so is one behind a reverse proxy that binds `127.0.0.1` while `BASE_URL` names its `https` address. The startup warnings follow the same origin: `SOVRIUM_ALLOW_INSECURE` accepted on a non-loopback origin prints a `⚠` line naming it, and a reachable bind with `BASE_URL` unset or loopback prints a `⚠` line naming `BASE_URL` and the bind.

The reverse is the trap: a loopback `BASE_URL` such as `http://localhost:3000` relaxes the posture even when the port is published and reachable from the internet, because `BASE_URL` is read before the socket's real reach. On any host other people can reach, set `BASE_URL` to the public `https://` address they type.

Two consequences worth knowing:

- `0.0.0.0` and `::` are deliberately **not** loopback. They are the wildcard bind — every interface the machine has — so the ordinary container idiom `HOSTNAME=0.0.0.0` is a public bind and keeps the secure posture.
- Trusted origins are the app's own `BASE_URL` origin plus the origin of each identity provider declared under `auth.sso` (its OIDC `issuer` or SAML `entryPoint`), and nothing else — **never** a wildcard. A wildcard is an origin-validation bypass; scoping it is also what makes an external-origin `redirectTo` on password reset an untrusted origin rather than a followed one. A provider's origin is trusted because the server fetches from it and the browser posts back from it, so declare only providers you control the issuer of.

`NODE_ENV=production` still matters for asset caching, but it does not decide CSRF or cookie flags.

**JSON routes take only JSON.** A browser sends a cross-site request without a CORS preflight when its body is `text/plain`, a form encoding or untyped, so the records API (`/api/tables/<table>/…`) refuses any request body not labelled `application/json` with `415 Unsupported Media Type`, before anything reads it and whatever the posture. The few routes built for an HTML form post accept the form encodings and nothing else.

## Rate limiting

Custom middleware rate-limits the sensitive endpoints.

| Endpoint                                                                                                                                 | Limit per caller | Window |
| ---------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ------ |
| All `/api/*`, the MCP endpoint, and page / `.md` / `/_admin` requests carrying a credential (per address, ahead of every session lookup) | 1200 requests    | 60 s   |
| `POST /api/auth/sign-in/email`                                                                                                           | 20 attempts      | 60 s   |
| `POST /api/auth/sign-up/email`                                                                                                           | 20 attempts      | 60 s   |
| `POST /api/auth/request-password-reset`                                                                                                  | 10 attempts      | 60 s   |
| `POST /api/auth/oauth2/register`                                                                                                         | 20 requests      | 60 s   |
| `POST /api/auth/sign-in/magic-link`                                                                                                      | 5 requests       | 60 s   |
| `POST /api/auth/email-otp/send-verification-otp`                                                                                         | 3 requests       | 60 s   |
| `POST /api/auth/email-otp/request-password-reset`                                                                                        | 3 requests       | 60 s   |
| `POST /api/auth/forget-password/email-otp`                                                                                               | 3 requests       | 60 s   |
| `POST /api/auth/send-verification-email`                                                                                                 | 3 requests       | 60 s   |
| `POST /api/auth/change-email`                                                                                                            | 3 requests       | 60 s   |
| `POST /api/auth/admin/invite-user`                                                                                                       | 10 requests      | 60 s   |
| `GET /api/tables`, `GET /api/tables/*`                                                                                                   | 100 requests     | 60 s   |
| `POST /api/tables/*`                                                                                                                     | 50 requests      | 60 s   |
| `GET /api/activity`, `/api/activity/*`                                                                                                   | 60 requests      | 60 s   |
| `POST /api/auth/admin/*`                                                                                                                 | 10 requests      | 1 s    |

Every 60-second window above is one span, adjustable together with `RATE_LIMIT_WINDOW_SECONDS`, which must be a whole number of seconds above zero — any other value refuses to start the server, naming the variable and the value; the caps themselves are fixed, except the per-address ceiling on the first row, which `API_IP_RATE_LIMIT` sets. The admin window is a hardcoded one second — it is sized for dashboard polling, not for brute-force resistance, and the auth check below is what protects those routes. The two scales differ by a factor of sixty on purpose: consolidating them onto one window would silently weaken admin from ten requests per second to ten per minute.

**The per-address ceiling** is one budget shared by every API endpoint — the health check aside — and by the form routes of an app with sign-in, counted per client address even for a signed-in caller. It runs before any session lookup, so one address cannot hammer the database with session and API-key lookups through a route that has no limit of its own; an API request that carries no credential at all (no session cookie, no `Authorization`, no `x-api-key`) is counted but triggers no lookup. At twenty requests a second it sits well above every limit below, which keep refusing first. Because it cannot tell apart the people behind one address, `API_IP_RATE_LIMIT` raises or lowers it: raise it when many users reach the app through one office or proxy address. A value that is not a whole number above zero refuses to start the server, naming the variable. The address is resolved as for every other limit, so `TRUSTED_PROXY_HOPS` decides which forwarding header is believed — and it also decides whether `X-Forwarded-Host` and `X-Forwarded-Proto` are believed (see **Reverse proxies** below). The MCP endpoint counts against the same budget wherever `MCP_MOUNT_PATH` mounts it, before its credential is checked; its own per-credential limits still apply beneath. A page, a `.md` twin or a console request counts when it carries a credential (the session cookie, `Authorization`, or `x-api-key`), since each of those makes the page look the session up; one that carries none is neither counted nor refused, so a public audience behind one address never spends the budget. Every per-address limit on this page counts an IPv6 client by its /64 — the block one connection is given — and an IPv4-mapped IPv6 address as the IPv4 address it carries; logs and sessions still record the full address.

Every other limiter is a sliding window, counted separately for each endpoint, so one endpoint's budget cannot be spent by traffic to another. Who counts as one caller depends on the endpoint:

- **`/api/tables` and `/api/tables/*`** count a signed-in caller by their user and a caller who is not signed in by IP address. Several people behind one proxy address therefore each keep their own budget, and anonymous traffic that spends an address's budget does not refuse a signed-in user at that address. Visitors who are not signed in share one budget per address, since nothing else tells them apart.
- **Every other endpoint**, the sign-in, sign-up, password-reset, one-time-code, magic-link, verification-mail, email-change and invitation limits included, counts by IP address.

A table that lets visitors create records (`create: all`) additionally limits those anonymous creates per table, as a public form is limited: 10 per visitor address and 1000 per table every 60 seconds. That limit applies on top of the records limit above.

`POST /api/auth/oauth2/register` is capped at the sign-up rate because it is the same kind of surface once dynamic client registration is opened to unauthenticated callers: each request writes a row carrying a caller-chosen client name that a consent screen will later show a user. With registration closed the endpoint answers `401` before the limiter ever binds — the cap is simply already in place on the day an operator opens it.

**Every route that sends mail to an address the caller names is limited.** A magic link, a one-time code, a password-reset code, a verification resend and an email change each mail an address the request supplies, and an invitation mails any address its sender types, so without a cap one client could flood a stranger's inbox and damage your mail server's sending reputation. Each route counts on its own, every request counts (a refused one included), and the request past the budget answers `429` with a `Retry-After` header **and sends no mail**: it is refused before anything is generated or sent. An invitation additionally counts against the per-second admin limit in the table above.

Exceeding a limit returns `429 Too Many Requests`. Admin routes additionally run an auth-check middleware that returns `401` **before** parameter validation, so an unauthenticated caller never learns the shape of a protected endpoint.

If your deployment needs stricter caps, put a rate limiter in front of Sovrium at the reverse proxy — the built-in limits are a floor against casual abuse, not a substitute for edge protection.

## Anti-enumeration: 404, not 403

Unauthorized access to a protected resource returns **`404 Not Found`**, never `403 Forbidden`. A `403` confirms the resource exists; a `404` does not tell the caller whether it exists. This applies uniformly across record reads, record writes and deletes, and the admin dashboard. The delete pipeline is a worked example of where the rule stops: an authorization denial and a genuinely absent record both answer `404`, but a driver-originated failure is sanitized into its real status rather than disguised, so an infrastructure fault reaches the operator instead of being reported to the caller as "not found".

Object-level authorization is enforced before any sensitive logic runs: a request is authenticated, then checked for access to the specific object, and on failure returns `404`.

**Record ids are sequential, not secret.** A record's `id` is an integer that counts up, so anyone can guess which ids are likely to exist. The `404` hides whether a given record exists and what it holds; it does not hide the id space. Never treat a record id as a secret: whoever holds a link such as `/rate?ticket=42` can change the number to reach every other ticket, so anything that must only be reachable by one person needs a permission check, not an id in the URL.

## Reverse proxies

`TRUSTED_PROXY_HOPS` tells Sovrium how many proxies stand between the internet and the server. It decides which forwarded client address is believed for rate limits, and it also decides whether `X-Forwarded-Host` and `X-Forwarded-Proto` are believed when Sovrium builds an absolute link and `BASE_URL` is not set. With the default `0`, those headers are whatever the client typed and are ignored. Set it to the number of proxies you actually run and no higher: a count above that lets a client forge its own address, and the host printed in links. Setting `BASE_URL` removes the second risk entirely, because a declared `BASE_URL` always wins over any header.

## Outbound requests

Requests the server makes on your configuration's behalf — automation HTTP and webhook actions, outgoing webhooks, connection token exchanges, a configuration fetched from a URL — are checked before they are sent, and again at every redirect they follow: a target on `localhost` or any name under `.localhost` (`ollama.localhost`, in any case and with or without a trailing dot — the whole zone is reserved for loopback), a loopback, private or link-local address (cloud metadata endpoints included) is refused. Addresses are compared by value, so an IPv6 spelling of a refused IPv4 address (`[::ffff:127.0.0.1]`) is refused too. `SOVRIUM_ALLOW_PRIVATE_OUTBOUND=1` (or `true`) lifts that refusal so an integration on your own network can be reached; leave it unset unless you need exactly that. Other hostnames are not resolved: a name that points at a private address passes the check, so on a server that shares a network with internal services, restrict its outbound traffic at the firewall as well.

## Uploads

Files go to buckets, and a bucket's `permissions` block decides who may upload, download and delete. Leaving an operation out does not close it: an undeclared `upload` or `delete` admits any signed-in user, whatever their role, and an undeclared `download` does the same unless the bucket is public. `public: true` opens downloads to everyone and nothing else. In an app with no `auth` block at all, a public bucket also accepts anonymous uploads. Declare `upload` and `delete` on every bucket whose files not every user should change — see **Bucket Permissions**.

One upload is capped at 100 MB unless a bucket's `maxFileSize` or the `STORAGE_MAX_FILE_SIZE` variable says otherwise, and a bucket's `allowedMimeTypes` restricts what it accepts.

## Secrets and rotation

The encryption key — `SOVRIUM_ENCRYPTION_KEY`, or the `encryption-key` file Sovrium writes into the data directory when the variable is unset — protects stored connection credentials. The session-signing secret is derived from it unless you set `AUTH_SECRET`, in which case `AUTH_SECRET` wins.

Rotating either one has a cost, so plan it:

- **A new encryption key** leaves stored connection tokens unreadable — those users reconnect their integrations — and, when `AUTH_SECRET` is not set, also signs every user out.
- **A new `AUTH_SECRET`** signs every user out and invalidates every signed link and token issued under the old one. Stored credentials are not affected.

Setting `AUTH_SECRET` therefore decouples the two: a key change no longer signs anyone out, and a session reset no longer touches stored credentials. The price is a second secret to keep safe and back up.

## Backups

A `sovrium backup` archive is a master credential. It holds every row of your data and, when the key lives in the data directory, the `encryption-key` file — with which whoever holds the archive can decrypt every stored credential and, unless `AUTH_SECRET` is set separately, sign a session as any user, admins included. Encrypt archives before they leave the machine, restrict who can read them, never put one on a shared drive, and test a restore. See **Back Up and Restore**.

## Updates

Only the latest release receives security fixes, so stay on it: `sovrium update` replaces the binary with the latest release, and the project's releases page lists what changed. `sovrium update` refuses on a mismatch, and refuses when the checksum file cannot be fetched or read; `--insecure-skip-checksum` installs without the check and prints `Checksum not verified`.

## Reporting a vulnerability

Report a security issue by email to **security@sovrium.com**, never in a public issue. The project's `SECURITY.md` gives the response times.

## Defence in depth, summarised

- **Transport security** — HSTS with a one-year max-age, covering subdomains.
- **MIME and clickjacking** — `nosniff`, `X-Frame-Options: DENY` and the enforced `frame-ancestors 'none'`.
- **Cross-origin isolation** — same-origin opener and resource policies, plus the enforced structural CSP.
- **CSRF** — the origin check on any non-loopback posture, with trusted origins scoped to `BASE_URL` and each declared identity provider's origin.
- **Brute force** — per-endpoint rate limiting, answering `429`.
- **Enumeration** — `404` rather than `403`, and the auth check before validation. Record ids are sequential, so they are never a secret.
- **Authorization** — roles, field-level permissions and object-level checks.

## Related reading

- **Auth Overview** — auth strategies and the `auth` block.
- **Sessions** — session lifetime, revocation and secure cookies.
- **Auth, Roles & RBAC** — the role model and field-level permissions.
- **Table Permissions** — per-table and per-field access control.
- **Bucket Permissions** — who may upload, download and delete files.
- **Back Up and Restore** — what a backup archive holds.
- **GDPR & Privacy** — data export and erasure guarantees.
- **Environment Variables** — `BASE_URL`, `NODE_ENV` and related settings.
