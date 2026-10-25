# Posture: the origin, transport and what the binary already does

## Contents

- The public origin decides the posture
- The bind and the proxy
- What every response already carries
- Rate limits you can and cannot change
- Framing
- Outbound requests
- Dev mode
- Checks against your own running app

Manual: `sovrium docs operations/security-hardening`, `sovrium docs configuration/env-vars`, `sovrium docs configuration/env-vars-hosting`.

## The public origin decides the posture

Sovrium classifies the deployment from the host it resolves, public origin first: the host of `BASE_URL`, then `SOVRIUM_BIND_HOST`, then `localhost`.

- **Loopback** (`localhost`, `127.0.0.0/8`, `::1`) is the relaxed posture: the CSRF origin check is off and session cookies drop `Secure`. That is what makes local development across ports work.
- **Anything else** is enforced: a state-changing, cookie-bearing request with a forged or missing `Origin` is refused, and cookies carry `Secure`.
- `0.0.0.0` and `::` are a public bind, not loopback.
- **The trap**: a loopback `BASE_URL` such as `http://localhost:3000` relaxes the posture even when the port is published, because `BASE_URL` is read before the socket's real reach. On any host other people reach, `BASE_URL` is the `https://` address they type.
- `SOVRIUM_ALLOW_INSECURE` (`1` or `true`) relaxes the posture on purpose; any other non-empty value refuses to start. It belongs on a loopback-only machine, never on a deployment others reach. Accepted on a public origin, it prints a `⚠` line.
- `NODE_ENV=production` changes asset caching. It does not decide CSRF or cookie flags.

`BASE_URL` also fixes every absolute link the app writes. Without it, links fall back to the request's `Host` header (and, with `TRUSTED_PROXY_HOPS` above 0, to the forwarded host).

## The bind and the proxy

- Behind a reverse proxy, the server may bind `127.0.0.1` while `BASE_URL` names the public `https` address: the posture stays enforced.
- A reachable bind with `BASE_URL` unset or loopback prints one `⚠` line naming `BASE_URL` and the bind. Read the banner on the deploy target, not only locally.
- `TRUSTED_PROXY_HOPS` is the number of proxies actually in front of the server, `0` by default. It decides which forwarded client address the rate limits count, and whether `X-Forwarded-Host` and `X-Forwarded-Proto` are believed. A value above the real count lets a client forge its own address.
- Trusted origins are the `BASE_URL` origin plus each declared `auth.sso` provider's origin, never a wildcard. Declare only providers whose issuer you control the choice of.

## What every response already carries

Do not report these as missing, and do not ask the author to add them at a proxy:

- `Strict-Transport-Security` for a year, including subdomains (sent even over plain HTTP, where browsers ignore it).
- An **enforced, structural** `Content-Security-Policy`: `frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'`. It deliberately has no `script-src` or `style-src`, because server rendering emits inline elements. That is a known platform posture, not an app finding.
- `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, same-origin opener and resource policies, a `Permissions-Policy` denying camera, microphone, geolocation, payment and USB (a page with a recorder grants its own microphone), and no `X-Powered-By`.
- JSON routes refuse a body not labelled `application/json` with `415`, which closes the preflight-free CSRF shapes.
- Every value reaches the database bound, never spliced; record data reaching HTML is escaped or sanitised.

## Rate limits you can and cannot change

The caps are per caller and per endpoint, over one window (`RATE_LIMIT_WINDOW_SECONDS`). Three caps move: the per-address ceiling on every API request (`API_IP_RATE_LIMIT`), the record-write budget (`RATE_LIMIT_WRITES`) and a signed-in person's record reads (`RATE_LIMIT_READS`). Read the current numbers in the manual rather than here.

- Raise `API_IP_RATE_LIMIT` when many people reach the app through one office or proxy address; they share one per-address budget.
- Sign-in, sign-up, password reset and every route that mails an address the caller names are limited per address and answer `429` with `Retry-After`.
- The built-in limits are a floor against casual abuse. For stricter caps, put a limiter at the reverse proxy.
- There is no per-account lockout after failed passwords (see `auth-hardening.md`).

## Framing

The app refuses to be framed (`frame-ancestors 'none'`). `SOVRIUM_FRAME_ANCESTORS` lists origins allowed to frame it, for your own dashboard or editor; set, it replaces `'none'` with the list and drops `X-Frame-Options`. List exact origins; a malformed value refuses to start. An `iframe` of the app's own page by path relaxes only that address.

## Outbound requests

Requests the server makes for your config (HTTP and webhook actions, outgoing webhooks, connection token exchanges, a config fetched from a URL, external MCP servers) refuse `localhost`, `.localhost`, loopback, private, link-local and carrier-grade NAT addresses, at every redirect. `SOVRIUM_ALLOW_PRIVATE_OUTBOUND=1` lifts that for an integration on your own network. Hostnames are not resolved by that check, so a name pointing at a private address passes: on a server that shares a network with internal services, restrict outbound traffic at the firewall as well.

## Dev mode

`SOVRIUM_DEV_MODE` turns on the development panel: the sign-in page shows the dev admin's email and password, and a button fills the sign-in form with them. It is allowed on a public origin, where the boot banner prints a `⚠` line naming the exposed account. Unset it, and unset `SOVRIUM_DEV_EMAIL` and `SOVRIUM_DEV_PASSWORD`, before anyone else can reach the app; then change that account's password or remove the account.

## Checks against your own running app

```
- [ ] curl -sI https://<your origin>/            → the hardened headers above
- [ ] Sign in, then read the Set-Cookie line     → carries Secure
- [ ] A cookie-bearing POST with Origin: https://evil.example → refused 403
- [ ] The startup banner                         → no ⚠ line about BASE_URL, SOVRIUM_ALLOW_INSECURE or dev mode
- [ ] The sign-in page                           → no credentials printed on it
- [ ] Behind a proxy: the first sign-in attempt  → answers 401, not 429 (429 at once means TRUSTED_PROXY_HOPS is too low and every client shares one address)
```
