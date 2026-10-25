---
name: sovrium-security
description: Use when a Sovrium app is about to be exposed to real people, or its access needs a review — a launch checklist, a security review, "is it safe to go live", "who can see this", hardening, privacy or GDPR. It reviews the public origin and transport posture, sign-up, email verification, passwords, two-factor, passkeys, single sign-on and API keys, page, form and bucket access, anti-spam and opening hours, secrets and the env block, rate limits, the AI and MCP exposure, export, erasure, retention and logs, and dev mode before launch, against the author's own running app, triaging each finding before reporting it. Not this skill for writing the table, field and row permission grammar, which is `sovrium-data-model`; nor for reporting a vulnerability in Sovrium itself, which is `sovrium-report-issue`; nor for designing an agent, which is `sovrium-agents`.
license: BSL-1.1
metadata:
  author: sovrium
  version: '1.0.0'
---

# Sovrium security

A bare agent reviews a Sovrium app the way it reviews a web framework: it greps for SQL injection the engine already binds, calls the `404` on a refused read a bug and asks for a `403`, trusts a page filter or a page's `access` to protect the rows behind it, and assumes `NODE_ENV=production` turns on secure cookies. It misses what actually opens a Sovrium app: `allowSignUp` is `true` until you say otherwise, `requireEmailVerification` is `false` and needs SMTP once you turn it on, a loopback `BASE_URL` switches the CSRF check and the `Secure` cookie flag off, a bucket with no grants takes uploads from any signed-in user, `AI_CHAT_RATE_LIMIT` is unset, an admin-role agent lends its reach to whoever may trigger it, and `SOVRIUM_DEV_MODE` prints the admin credentials on the sign-in page. Most Sovrium findings are a default the author never set, not a line of code.

Run the core loop from `sovrium-app` underneath this skill. Manual: `sovrium docs operations/security-hardening`, `sovrium docs operations/gdpr-privacy`, `sovrium docs operations/logs-and-personal-data`, `sovrium docs auth/auth-overview`, `sovrium docs auth/auth-registration`, `sovrium docs tables/table-permissions`, `sovrium docs buckets/buckets-permissions`, `sovrium docs mcp/mcp-security`.

## Scope

**Config keys this skill reviews**: `auth` (its strategies, `allowSignUp`, `defaultRole`, `roles`, `twoFactor`, `passkeys`, `sso`, `scim`, `apiKeys`, `immediateAccountDeletion`), `pages[].access`, `forms[].access`, `forms[].antiSpam`, `forms[].availability`, `buckets[].permissions` and `public`, the top-level `env` block and every `$env.NAME`, `tables[].retention` and `activityLog`, `tables[].aiAccess`, and `agents[].permissions.trigger`. Every option: `references/auth-options.generated.md`, or `sovrium docs config <path>`.

**Owned elsewhere, linked, never repeated**: how `permissions` on a table, a field and a row are written, and why a refused caller gets `404`, are in `sovrium-data-model`, `references/permissions.md`. This skill checks that those blocks exist and hold against the running app; it does not teach their grammar.

**What the binary does on its own**: hardened headers on every response, a structural CSP, the CSRF origin check and `Secure` cookies on any non-loopback origin, per-endpoint rate limits, `404` rather than `403`, parameter binding for every value, server-side HTML sanitising, an SSRF guard on outbound requests, and boot warnings (`⚠` lines) for open sign-up, a loopback `BASE_URL` on a reachable bind and an accepted `SOVRIUM_ALLOW_INSECURE`. Do not re-audit those; check that the deployment does not switch them off.

**Environment the operator sets**: `BASE_URL`, `SOVRIUM_BIND_HOST`, `TRUSTED_PROXY_HOPS`, `SOVRIUM_ALLOW_INSECURE`, `SOVRIUM_ALLOW_PRIVATE_OUTBOUND`, `SOVRIUM_FRAME_ANCESTORS`, `SOVRIUM_ENCRYPTION_KEY`, `AUTH_SECRET`, `SOVRIUM_DEV_MODE`, `AI_CHAT_RATE_LIMIT`, `MCP_ENABLED`, `MCP_EXPOSE_INTERNALS`, `AI_MEMORY_MAX_AGE_DAYS`. Find one with `sovrium docs search <NAME>`.

## Evidence

Separate what proves a finding from what only suggests one.

| Evidence                                            | Proves                                                  | How                                                                         |
| --------------------------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------- |
| The running app, as two real accounts and as nobody | Who can reach what, today                               | `curl` with each session or API key; the browser MCP signed in as each role |
| Response headers and cookies                        | The posture the deployment actually runs                | `curl -sI <url>`; the `Set-Cookie` of a sign-in carries `Secure`            |
| The startup banner                                  | Defaults Sovrium itself flags                           | Read every `⚠` line `sovrium start` printed                                 |
| `sovrium validate`                                  | That the config decodes; nothing about who can see what | `sovrium validate --json`                                                   |
| The config files                                    | Intent, and what is missing                             | Read them; an absent block is the commonest finding                         |
| The manual                                          | What the binary promises                                | `sovrium docs config <path>` before claiming a default                      |

Only the running app confirms a finding. A config line that looks open is **Likely** until a request shows it; a request that shows it is **Confirmed**. Test against an app you run yourself, never against someone else's host.

## Survey → Implement → Evaluate

Copy this checklist and tick it as you go:

```
Security review progress:
- [ ] 1 Map the entry points: pages and their access, forms, buckets, the records API, agents and ai-chat, the app's MCP server, inbound webhooks
- [ ] 2 Map the callers: anonymous, each role, an API key, an agent, the operator
- [ ] 3 Read the environment the deployment will run with (BASE_URL, the dev and AI variables) and the boot banner's ⚠ lines
- [ ] 4 Load the reference each surface needs (list below)
- [ ] 5 Sweep the checklist below, CRITICAL first; note each candidate with its rule id
- [ ] 6 Triage every candidate (Before reporting)
- [ ] 7 Fix: config edits and environment only; sovrium validate after each batch
- [ ] 8 Re-run the request that found each issue, as the same account; repeat 7–8 until clean
- [ ] 9 Report (template below); an empty report if nothing survived triage
```

**Survey** with two accounts of different roles and one anonymous client. Create them the way `sovrium-app`, `references/api-checks.md`, says.

**Implement**: the fix is almost always a key the config never set or a variable the deployment left at its default. Write the smallest one that closes the path, validate, and keep the running instance on the new config.

**Evaluate**: repeat the exact request that showed the finding, as the same account. It must now answer what the rule says (`404`, `401`, `429`, or the value withheld). For a launch, fill in `references/launch-review.md`.

## The checklist

Tags in brackets point to `references/sources.md`.

**CRITICAL** — reachable by anyone on the internet, or by any account

1. `origin-public-https` — `BASE_URL` is the public `https://` origin people type. A loopback `BASE_URL` turns the CSRF origin check off and drops `Secure` from session cookies even when the port is reachable; `NODE_ENV` changes neither. `SOVRIUM_ALLOW_INSECURE` stays unset on anything other people reach. Details: `references/posture.md`. [S12][S13][S18]
2. `dev-mode-off` — `SOVRIUM_DEV_MODE` is unset before launch. Dev mode prints the admin email and password on the sign-in page for every visitor; on a public origin the boot banner warns with a `⚠` line naming the account, and the app still starts. [S2]
3. `signup-matches-audience` — `auth.allowSignUp` defaults to `true`. An invited-only app, an internal tool or a customer portal sets it to `false`; otherwise anyone who finds the URL gets `defaultRole` and every table and bucket that role reaches. The boot banner's `⚠ Open sign-up` line names them. Details: `references/auth-hardening.md`. [S1][S16]
4. `secrets-in-env` — no key, token or password inline in the config, a record, a template or a commit. Every `$env.NAME` is declared in the `env` block, its value lives in `.env`, and `.env` is not committed. Details: `references/secrets-and-env.md`. [S1][S10]
5. `every-table-has-a-block` — every table carries a `permissions` block written for this app; a table with none stays open to every non-viewer role. Write and test the grammar with `sovrium-data-model`, `references/permissions.md`. [S1]
6. `bucket-grants-declared` — every bucket whose files not every user should read or add declares `download` and `upload`, and `delete` when someone other than the uploader may remove files. Undeclared, any signed-in user uploads to it and, unless it is `public`, reads every file in it. [S1]
7. `agent-reach-is-delegated` — an agent's `role` is the ceiling of what it does, and whoever passes `permissions.trigger` sets that reach in motion. Wherever no person narrows it (outside a chat), it acts with its own role, so an admin-role agent with a wide trigger lends admin reach to callers who lack it. Details: `references/ai-and-mcp-access.md`. [S4][S5]

**HIGH** — reachable by any signed-in user, or costly at scale

8. `verify-email-on-open-signup` — with open sign-up, `requireEmailVerification: true` on the `emailAndPassword` strategy. It defaults to `false`, and it needs SMTP: without email configured nobody who signs up can ever sign in. [S16]
9. `chat-rate-capped` — `AI_CHAT_RATE_LIMIT` is set wherever signed-in people reach a chat. Unset, a signed-in user's chat has no cap on a metered provider. [S4]
10. `gate-at-the-data` — the protection of a row lives in the table's permissions, never in a page's `access`, a `dataSource` filter or a hidden component: the records API still answers. Test the API, not the page. [S1]
11. `public-writes-bounded` — every surface an anonymous visitor writes to is intended: a form with no `access` (public by default), a table with `create: all`, a bucket with `upload: all`, a signing grant of `all`. Forms keep their default honeypot and rate limit; never `honeypot: false` on a public form. Details: `references/public-surfaces.md`. [S1]
12. `admin-sign-in-strong` — admins use two-factor or a passkey; with passkeys enabled, `auth.passkeys.requireForAdmin: true`. [S2][S16]
13. `mcp-server-deliberate` — `MCP_ENABLED` only where an outside AI client should reach live data; each table that declares `aiAccess` is one you mean to offer; `MCP_EXPOSE_INTERNALS=false` when admins do not need the internal tables there. `aiAccess` widens what is offered, never what is permitted. [S4][S19]
14. `proxy-hops-exact` — behind a reverse proxy, `TRUSTED_PROXY_HOPS` equals the number of proxies actually in front, never more; a higher count lets a client choose the address its rate limits are counted against. [S1]

**MEDIUM** — needs a precondition, or limits the damage

15. `password-floor` — `minPasswordLength` raised from its default of 8 (12 or more for most apps). There is no composition rule to set and no per-account lockout after failed sign-ins: the defence is the per-address limit on sign-in. [S16][S17]
16. `sso-domains-deliberate` — each `auth.sso` provider lists only email domains it is authoritative for, sets `allowSignUp` deliberately, and maps roles only from a claim the provider verifies; an existing account is linked only through a domain the provider is listed for. [S16]
17. `retention-declared` — personal data that only accumulates has a window: `tables[].retention` on log-like tables, `AI_MEMORY_MAX_AGE_DAYS` for chats, a retention period wherever stdout, telemetry and error reports land. Details: `references/gdpr-and-retention.md`. [S9][S11]
18. `erasure-known` — the operator knows what erasure leaves behind (the audit trail by design; files with no uploader; webhook delivery payloads; embeddings) and how to cover it. [S7]
19. `outbound-stays-guarded` — `SOVRIUM_ALLOW_PRIVATE_OUTBOUND` unset unless an integration on the private network needs it, and then the server's outbound traffic is restricted at the firewall too. [S1]
20. `secrets-recoverable` — the encryption key (`SOVRIUM_ENCRYPTION_KEY`, or the key file in the data directory) is backed up apart from the data, and `sovrium backup` archives are encrypted before they leave the machine, because one holds the key. [S10]
21. `framing-listed` — `SOVRIUM_FRAME_ANCESTORS` names only the origins that must frame the app; leave it unset otherwise. [S14]

**LOW** — hardening with no demonstrated path

22. `immediate-deletion-chosen` — `auth.immediateAccountDeletion` stays on (the right to erasure asks for it) unless a legal hold needs the seven-day window alone. [S7]
23. `sensitive-forms-out-of-analytics` — a form carrying health, payment or legally held data sets `analytics: { enabled: false }`. [S9]
24. `api-keys-only-if-used` — `auth.apiKeys` on only when people script against the app; a key carries its owner's role and is revocable. [S1]
25. `stay-current` — the deployment runs the latest release, the only one that receives security fixes (`sovrium update`). [S2]

## Before reporting

A pattern match is not a finding. Confirm all four, or drop the candidate (or keep it as Low, or Needs verification):

1. **Is the path reachable?** Trace it from a real entry point: a page, a form, a bucket route, a records endpoint, an agent road, an MCP tool. A key that looks open but that no route serves is not a finding.
2. **Who can trigger it?** Anonymous, any signed-in account, one role, an API key holder, the operator. Name the lowest one that can.
3. **What is the blast radius?** One user's own data, another user's data, every record of a table, an admin's reach, money spent on a provider.
4. **Can that caller do every step?** Each step must be possible from that position: an account they can create, a value they can send. A missing step makes it **Needs verification**, never High.

Then: a `404` where the rule says `404` is the design, not a finding; a platform posture the manual documents (the structural CSP, sequential record ids, the `404`) is a finding only where this app relies on the opposite. Rate severity by exploitability, not by keyword.

## Report

One block per finding, highest severity first:

```
[SEVERITY] <rule id> — <one-line title>
Location:    <file>:<line>, or the environment variable
Who:         <the lowest caller who can trigger it>
Path:        <entry point> -> <what it reaches>
Evidence:    <the request and its answer, or the config line and the banner line>
Fix:         <the smallest config or environment change>
Confidence:  Confirmed | Likely | Needs verification (say what you could not see)
```

End the report with:

```
Decisions to record: <title — touches>   (one line per nominated decision, or: Decisions to record: none)
```

Nominate only a choice a future operator would ask about (the data-model shape, the permissions or auth model, SQLite or PostgreSQL, a design character, a disabled automation, a security trade-off left in place such as dev mode on a public origin or an open table), never labels, copy or colours. Skills only nominate; only the `sovrium-config-editor` agent writes the `decisions:` register.

| Severity | Meaning in a Sovrium app                                                                         |
| -------- | ------------------------------------------------------------------------------------------------ |
| Critical | Anyone on the internet reads or writes data that is not theirs, or holds an admin session        |
| High     | Any signed-in account crosses to another person's data or to a wider role; an uncapped paid path |
| Medium   | Needs a precondition (a role, an SSO domain, a proxy), or only weakens a defence                 |
| Low      | Hardening with no path shown; say plainly that it is not a vulnerability                         |

If nothing survives triage, say so in one line. Do not pad the report with Low items to look thorough. List what you dropped, and why, in one line each.

A vulnerability in Sovrium itself, an access check the manual says holds and does not, is not a finding against this app: hand it to `sovrium-report-issue`, which sends it to the private advisory form, never a public issue.

## Must not claim

1. A `404` on a refused read is a bug, or should be a `403`.
2. `allowSignUp` is off by default.
3. `requireEmailVerification` is on by default, or works without SMTP.
4. A page's `access`, a page filter or a hidden component protects the rows behind it.
5. `aiAccess` grants a permission the role does not have.
6. Sovrium locks an account after failed sign-ins.
7. `NODE_ENV=production` turns on `Secure` cookies or the CSRF check.
8. A signed-in user's chat is rate-limited by default.
9. Erasure removes every trace of a person.
10. Record ids are secret or unguessable.
11. The CSP blocks inline scripts.
12. Dev mode is safe on a public origin because the app still starts.

## References

- [references/posture.md](references/posture.md) — read first for any deployment: `BASE_URL`, the bind, proxies, headers, CSRF, rate limits, framing, outbound requests, dev mode.
- [references/auth-hardening.md](references/auth-hardening.md) — read when the app has `auth`: sign-up, verification, passwords, two-factor, passkeys, SSO, SCIM, API keys, sessions.
- [references/public-surfaces.md](references/public-surfaces.md) — read for anything an anonymous visitor reaches: pages, forms, buckets, signed links, public tables, webhooks.
- [references/secrets-and-env.md](references/secrets-and-env.md) — read before touching `env`, `$env`, connections, the encryption key or backups.
- [references/gdpr-and-retention.md](references/gdpr-and-retention.md) — read for personal data: export, erasure and what it leaves, retention, logs.
- [references/ai-and-mcp-access.md](references/ai-and-mcp-access.md) — read when the app has agents, a chat or an MCP server: the launch items only; design is `sovrium-agents`.
- [references/launch-review.md](references/launch-review.md) — read before writing a launch review: the A–F template.
- [references/auth-options.generated.md](references/auth-options.generated.md) — read for every access and authentication option of the binary you run; generated from it.
- [references/sources.md](references/sources.md) — the sources behind every tag above.
