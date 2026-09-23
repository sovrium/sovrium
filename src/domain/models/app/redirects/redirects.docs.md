# URL Redirects

> Retire a URL without breaking the links that point at it — declare redirect rules that answer old paths with a 301 before page resolution.

Restructuring a site retires URLs. Without a redirect the only possible answer at a retired path is a 404, and every indexed link, bookmark and backlink pointing there breaks.

The `redirects` array declares those retired paths and where each one now lives:

```yaml
redirects:
  - from: /products/platform
    to: /
  - from: /products/partner
    to: /partner
  - from: /login
    to: /_admin/login
    status: 302
```

## Rule Properties

<!-- sovrium:options RedirectSchema -->

Query strings are not part of the match key. An incoming query string is preserved and carried onto the target, so there is no point encoding one in `from`. If `to` already carries its own query string, the incoming one is appended to it with `&`.

### Choosing a status

| Status | Meaning                                              | Use it when                                                    |
| ------ | ---------------------------------------------------- | -------------------------------------------------------------- |
| `301`  | Moved Permanently — transfers link equity            | The URL is retired for good. This is the default and the norm. |
| `302`  | Found — temporary, may rewrite the request method    | The move is temporary and the method does not matter.          |
| `307`  | Temporary Redirect — temporary, preserves the method | A temporary move that must keep a `POST` a `POST`.             |
| `308`  | Permanent Redirect — permanent, preserves the method | A permanent move that must keep the request method.            |

## Language handling

A `from` is matched the way page paths are authored. A bare rule matches the plain path _and_ every language-prefixed variant, and a path `to` inherits the language of the request — so one rule serves every locale and a French visitor lands on the French replacement, never the English one:

```yaml
redirects:
  - from: /pricing
    to: /plans
```

That single rule answers `/pricing`, `/en/pricing` and `/fr/pricing`, sending each to `/plans`, `/en/plans` and `/fr/plans` respectively.

To target one locale only, write the language segment into `from`. A rule whose path already begins with a configured language code is matched literally:

```yaml
redirects:
  - from: /fr/tarifs
    to: /fr/plans
```

An absolute `to` is used verbatim, with no language handling, since it leaves the app entirely.

### Do not hand-write the unprefixed-path rule

A bare `/docs` that 404s while `/en/docs` serves is the one case that makes a redirect rule look obvious and destructive. **The engine already handles it**, and both hand-written forms are rejected at decode time, because `from` is matched locale-agnostically and therefore claims the live localized URLs too:

```text
{ from: '/docs', to: '/en/docs' }
  /docs      → 301 /en/docs        the case you wanted
  /en/docs   → 301 /en/en/docs     the live English docs, now a 404
  /fr/docs   → 301 /fr/en/docs     the live French docs, now a 404
```

Reaching for `localizeTarget: false` fixes the double prefix and creates something worse — the rule now sends the live URL back to itself:

```text
{ from: '/docs', to: '/en/docs', localizeTarget: false }
  /docs      → 301 /en/docs        the case you wanted
  /en/docs   → 301 /en/docs        infinite browser redirect loop
  /fr/docs   → 301 /en/docs        the French docs, unreachable
```

Both used to validate and brick the docs zone at runtime. They now fail validation.

## Precedence

Redirects are evaluated **after static assets** and **before pages**:

1. A real file in the public directory — a redirect rule can never hijack a served asset.
2. Redirect rules.
3. Page resolution.
4. The 404 catch-all.

A rule therefore always beats a page. That cuts both ways: a `from` matching a path you still serve makes that page unreachable.

Rules are also matched **before** URL canonicalization, so `from` is compared against the path exactly as the browser sent it — trailing slash included.

**Redirects resolve in exactly one hop.** A matched request emits one redirect and the target is never re-matched against the table, so `Location` is always literally what you authored. Chains do not collapse — if `/a` should end at `/c`, write `/a → /c`, not `/a → /b → /c`.

## Validation

Whole-table rules are enforced when the config is decoded, so a broken table fails validation instead of shipping. Every one of them exists because the server resolves a single hop and therefore cannot loop — but the _browser_ follows each new rule in turn, and never settles.

| Rejected shape               | Example                                                    | Why                                                                                                                |
| ---------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Duplicate `from`             | two rules for `/pricing`                                   | Each path may declare at most one rule.                                                                            |
| Self-redirect                | `{ from: '/a', to: '/a' }`                                 | A rule pointing at its own `from` loops forever.                                                                   |
| Cycle                        | `/a → /b` with `/b → /a`                                   | The browser follows each rule in turn and never arrives.                                                           |
| Double locale prefix         | `{ from: '/docs', to: '/en/docs' }`                        | `from` is locale-agnostic, so the live `/en/docs` matches it too and the target is prefixed again — a 404.         |
| Opt-out self-loop            | `{ from: '/docs', to: '/en/docs', localizeTarget: false }` | `from` still matches every locale variant, so `/en/docs` is sent verbatim back to `/en/docs` — an infinite loop.   |
| Trailing-slash self-redirect | `{ from: '/x', to: '/x/' }`                                | `/x/` is normalized back to `/x`, which re-enters this rule. Both the emitted and the canonical form are compared. |

`{ from: '/x/', to: '/x' }` stays **valid** — it emits `/x`, which matches nothing, so it terminates. `{ from: '/en', to: '/en/' }` is rejected: it only duplicates the engine's own `/en` → `/en/` redirect.

The opt-out check is deliberately narrow. `{ from: '/login', to: '/_admin/login', localizeTarget: false }` is the reason `localizeTarget` exists and keeps validating; `{ from: '/legacy', to: '/en/docs', localizeTarget: false }` is odd but does not loop, and is not rejected either.

Protocol-relative targets (`//example.com`) are also rejected. A browser resolves them as absolute cross-origin URLs, which would turn the redirect table into an open-redirect primitive; cross-origin hand-offs must spell out `https://` so the intent is visible in review.

**Collision with a dynamic route is not caught for you.** Validation compares `from` against static page paths only. If your app serves a dynamic route such as `/blog/:slug`, a rule for `/blog/my-post` will silently shadow that article — no boot error, no validation failure. Check retired slugs against the content that still exists.
