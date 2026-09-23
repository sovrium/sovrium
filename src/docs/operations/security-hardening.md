# Security Hardening

> Platform-wide security guarantees — hardened HTTP response headers, CSRF and cross-origin enforcement, rate limiting, and 404-not-403 anti-enumeration, applied in code on every response.

Sovrium designs out the recurring failure modes of insecure apps — exposed surfaces, missing auth, broken object-level authorization, enumerable endpoints — at the platform layer, so every app inherits the defences with no per-app configuration. Every HTTP response carries a hardened header set, CSRF is enforced on any public deployment, sensitive endpoints are rate-limited, and unauthorized access returns `404` rather than `403`.

These guarantees are applied **in code**, not only at a reverse-proxy ingress, so they hold even for a self-hosted deploy with no proxy attached.

## HTTP security headers

Every response — page, API, static asset or `404` — carries a hardened header set, applied by the first middleware registered, so it runs before route matching and covers error responses.

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

**What decides whether the check is active is the deployment's transport posture, not `NODE_ENV`.** The posture is _relaxed_ when the master opt-out `SOVRIUM_ALLOW_INSECURE=1` is set, or when the resolved bind host is loopback — `localhost`, `127.0.0.0/8`, `::1`. In a relaxed posture the origin check is bypassed and cookies drop the `Secure` attribute, which is what makes local cross-port development work. In every other posture both are enforced.

The bind host resolves most-specific-first: an explicit server hostname, then the host of `BASE_URL`, then `HOSTNAME`, then `localhost`. A public deployment that sets only `BASE_URL` is therefore correctly classified non-loopback and keeps the secure posture.

Two consequences worth knowing:

- `0.0.0.0` and `::` are deliberately **not** loopback. They are the wildcard bind — every interface the machine has — so the ordinary container idiom `HOSTNAME=0.0.0.0` is a public bind and keeps the secure posture.
- Trusted origins are scoped to the app's own `BASE_URL` origin, **never** a wildcard. A wildcard is an origin-validation bypass; scoping it is also what makes an external-origin `redirectTo` on password reset an untrusted origin rather than a followed one.

`NODE_ENV=production` still matters for asset caching, but it does not decide CSRF or cookie flags.

## Rate limiting

Custom middleware rate-limits the sensitive endpoints.

| Endpoint                                | Limit        | Window                   |
| --------------------------------------- | ------------ | ------------------------ |
| `POST /api/auth/sign-in/email`          | 20 attempts  | 60 s                     |
| `POST /api/auth/sign-up/email`          | 20 attempts  | 60 s                     |
| `POST /api/auth/request-password-reset` | 10 attempts  | 60 s                     |
| `POST /api/auth/oauth2/register`        | 20 requests  | 60 s                     |
| `GET /api/tables`, `GET /api/tables/*`  | 100 requests | 60 s                     |
| `POST /api/tables/*`                    | 50 requests  | 60 s                     |
| `GET /api/activity`, `/api/activity/*`  | 60 requests  | 60 s                     |
| `POST /api/auth/admin/*`                | 10 requests  | 1 s, sliding, per caller |

Every 60-second window above is one span, adjustable together with `RATE_LIMIT_WINDOW_SECONDS`; the caps themselves are fixed. The admin window is a hardcoded one second — it is sized for dashboard polling, not for brute-force resistance, and the auth check below is what protects those routes. The two scales differ by a factor of sixty on purpose: consolidating them onto one window would silently weaken admin from ten requests per second to ten per minute.

Every limiter is a sliding window keyed by caller IP and by the endpoint, so one endpoint's budget cannot be spent by traffic to another.

`POST /api/auth/oauth2/register` is capped at the sign-up rate because it is the same kind of surface once dynamic client registration is opened to unauthenticated callers: each request writes a row carrying a caller-chosen client name that a consent screen will later show a user. With registration closed the endpoint answers `401` before the limiter ever binds — the cap is simply already in place on the day an operator opens it.

Exceeding a limit returns `429 Too Many Requests`. Admin routes additionally run an auth-check middleware that returns `401` **before** parameter validation, so an unauthenticated caller never learns the shape of a protected endpoint.

If your deployment needs stricter caps, put a rate limiter in front of Sovrium at the reverse proxy — the built-in limits are a floor against casual abuse, not a substitute for edge protection.

## Anti-enumeration: 404, not 403

Unauthorized access to a protected resource returns **`404 Not Found`**, never `403 Forbidden`. A `403` confirms the resource exists; a `404` makes the resource's existence — and the id space — unobservable. This applies uniformly across record reads, record writes and deletes, and the admin dashboard. The delete pipeline is a worked example of where the rule stops: an authorization denial and a genuinely absent record both answer `404`, but a driver-originated failure is sanitized into its real status rather than disguised, so an infrastructure fault reaches the operator instead of being reported to the caller as "not found".

Object-level authorization is enforced before any sensitive logic runs: a request is authenticated, then checked for access to the specific object, and on failure returns `404`. Combined with unguessable ids, this defeats enumeration even though the `404` itself is observable.

## Defence in depth, summarised

- **Transport security** — HSTS with a one-year max-age, covering subdomains.
- **MIME and clickjacking** — `nosniff`, `X-Frame-Options: DENY` and the enforced `frame-ancestors 'none'`.
- **Cross-origin isolation** — same-origin opener and resource policies, plus the enforced structural CSP.
- **CSRF** — the origin check on any non-loopback posture, with trusted origins scoped to `BASE_URL`.
- **Brute force** — per-endpoint rate limiting, answering `429`.
- **Enumeration** — `404` rather than `403`, unguessable ids, and the auth check before validation.
- **Authorization** — roles, field-level permissions and object-level checks.

## Related reading

- **Auth Overview** — auth strategies and the `auth` block.
- **Sessions** — session lifetime, revocation and secure cookies.
- **Auth, Roles & RBAC** — the role model and field-level permissions.
- **Table Permissions** — per-table and per-field access control.
- **GDPR & Privacy** — data export and erasure guarantees.
- **Environment Variables** — `BASE_URL`, `NODE_ENV` and related settings.
