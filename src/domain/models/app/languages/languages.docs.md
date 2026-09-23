# Languages

> Serve one app in several languages: declare the supported set, route them under `/{lang}/`, remember a reader's choice, and translate strings with `$t:` keys.

## Defining languages

The block declares the default language, the supported set, and how a reader's
choice is treated. Each entry in `supported` describes one language — its
routing `code`, its formatting `locale`, the `label` a switcher shows, its
text `direction` and an optional `flag`.

<!-- sovrium:options LanguagesSchema depth=2 -->

```yaml
languages:
  default: en
  supported:
    - code: en
      locale: en-US
      label: English
      direction: ltr
    - code: fr
      locale: fr-FR
      label: 'Français'
      direction: ltr
    - code: ar
      locale: ar-SA
      label: 'العربية'
      direction: rtl
```

## Right-to-left languages

Set `direction: rtl` for right-to-left languages such as Arabic or Hebrew. The page layout is mirrored, text aligns right, and `dir="rtl"` is applied to the HTML root.

## Remembering a chosen language

When `persistSelection` is `true` — the default — a choice made in a `language-switcher` is remembered in a `sovrium_language` cookie, and the **server** composes every following page in that language. That is what makes the choice reach everything resolved before the page is sent: the `<html lang>` attribute, a `$t:` heading, a navigation label, a table column header.

The cookie is written on the visitor's own device with `Path=/`, `SameSite=Lax` and a one-year lifetime, and carries `Secure` only over HTTPS — a `Secure` cookie set on `http://localhost` is discarded outright, and the preference would silently never reach a development server.

**The value is never taken at face value.** It is matched against the `supported` list of the app being rendered, and answered with that entry's declared `locale` (or its `code`, if the entry declares none). A cookie naming a language your app does not declare changes nothing about the request. That clamp matters because cookies are scoped to a host rather than to a port or an app: one browser carries one preference across every app served from that host, including the embedded operator console, which declares its own language list.

### A signed-in person's own language

A choice can also be saved **on an account** rather than in one browser. It lives on the person's own user record, written through the self-service endpoint:

```bash
curl -X POST https://app.example.com/api/auth/update-user \
  -H "Cookie: $SESSION" \
  -H "Content-Type: application/json" \
  -d '{"language":"fr"}'
```

Either spelling is accepted — the short `code` (`fr`) or the full `locale` (`fr-FR`) — and nothing else is. A language the app does not declare answers `400` at the write door rather than being stored and quietly ignored on every later read: a value that can never be honoured would still be published by an account export and carried across a restore, so the door is the last place that can refuse it. Sending `language: null` clears the preference; omitting the field leaves it untouched.

**A saved language outranks the cookie**, and it travels with the person to every browser they sign in on. When the two disagree, the deliberate statement wins over whatever one machine happens to remember.

### Reaching the right address

A remembered choice does not only change what `/` renders — it changes where `/` sends you.

| Request | Remembered choice          | Answer                                                     |
| ------- | -------------------------- | ---------------------------------------------------------- |
| `/`     | French                     | `302` → `/fr/`                                             |
| `/`     | English, the app's default | `200` — the bare path already serves exactly that document |
| `/`     | none                       | `200`, or the browser-detection `302` described below      |

**The target is spelled with the short `code`, never the `locale`.** A preference is answered as the entry's `locale`, because that is what the document declares itself as — but `/{lang}/` routing validates its segment against `code`, so a target built from the locale would read `/fr-FR/`, match no route, and 404.

**The default language stays put.** Redirecting `/` to `/en/` for a reader who chose the default gains nothing and costs a second canonical URL for one page.

The redirect sits **above** browser detection, and does not fire at all under `persistSelection: false`. It fires only at `/`; every other unprefixed path composes in the remembered language in place, with no hop.

### Switching language

| Current URL                               | On choosing French                                                       |
| ----------------------------------------- | ------------------------------------------------------------------------ |
| `/en/about`                               | Navigates to `/fr/about`, preserving the query string and the fragment   |
| `/about`                                  | Saves the choice, then **reloads** so the server recomposes the page     |
| `/about`, under `persistSelection: false` | Repaints the visible text in place — nothing was saved to recompose from |

**Why an unprefixed selection reloads rather than repainting.** A repaint reaches only what the script can see: a `$t:` element's payload, the `<title>`, `<html lang>` and `dir`. Everything else the server resolved — an island's serialized labels, a navigation row, an `aria-label`, a form's built-in submit text, a meta description — would stay in the language the page was first composed in, on the one surface where the reader has just said which language they want.

The switcher's trigger shows the **active** language — the one the page was actually composed in, matched against `supported` by either `code` or `locale` — not a pinned default and not the last thing clicked.

### Precedence

Six sources can decide the language of a page. The first one that resolves wins.

| Rank | Source                                | Notes                                                                    |
| ---- | ------------------------------------- | ------------------------------------------------------------------------ |
| 1    | The `/{lang}/` URL prefix             | An address a visitor typed, shared or was linked to is never rewritten.  |
| 2    | The signed-in person's saved language | Follows them to any browser. Consulted only on paths with no prefix.     |
| 3    | The remembered choice                 | What this one browser remembers. Consulted only on paths with no prefix. |
| 4    | The page's own `meta.lang`            | A saved or remembered choice outranks a page's pinned language.          |
| 5    | `Accept-Language`, if `detectBrowser` | A guess about the visitor, not a statement by them.                      |
| 6    | `languages.default`                   | The final fallback.                                                      |

Three consequences are worth stating outright. A saved or remembered choice sits **above** `meta.lang`, so it is honoured even on a surface whose pages each pin one language — otherwise it would be inert on exactly the pages that need it. It sits **above** browser detection, so once a visitor has picked a language the root `/` no longer redirects them to whatever their browser advertises. And it stays **below** the URL prefix: an account preference that overrode `/en/` would render every shared link in the reader's own language instead of the one the link names.

A cacheable response that consulted the cookie declares `Vary: Cookie`, so a shared cache cannot store one visitor's language under a bare URL and hand it to the next.

### What `<html lang>` says

Whatever decided the language, the document declares it **as the app itself declared it**: the `locale` of the matching `supported` entry, or its `code` where the entry names no locale. This holds on every path, a `/fr/` URL included — so `/fr/about` answers `lang="fr-FR"`, not `lang="fr"`.

The inputs speak different dialects of one fact: a `/{lang}/` prefix carries the short code it was addressed by, an authored `meta.lang` is written `en-US`, a resolved preference already answers the locale. Echoing whichever one won put a different attribute on the wire depending on how the reader arrived — a `/fr/` page saying `lang="fr"` while the sitemap advertised the same document as `hreflang="fr-FR"`, and a crawler reading both had no way to know the two named one language.

A value the app does **not** declare passes through as authored. A monolingual app has no `languages` block at all, and its pages' `meta.lang` is the only spelling anyone wrote down.

### Turning it off

Set `persistSelection: false` and nothing is remembered: the switcher writes no cookie, the server ignores one it is sent, and a language saved on an account is not consulted either.

Both halves are needed, and the read side is the less obvious one. Because the cookie belongs to the host, an app that asked not to remember anything can still be handed a neighbouring app's preference; ignoring it on the way in is what makes "do not remember" mean it. A `/{lang}/` address keeps working throughout — the key disables remembering, not the language feature.

## Unprefixed URLs

Some pages must be authored per locale — a docs zone binding `content/docs/en` and `content/docs/fr` cannot be one page — so their `path` carries an explicit segment. Nothing then answers the bare `/docs`.

An unprefixed path that resolves under no page, but **would** resolve once prefixed, is answered with a `302` to `/{lang}{path}`:

| Request      | Answer                                                        |
| ------------ | ------------------------------------------------------------- |
| `/docs`      | `302` → `/en/docs` (or `/fr/docs`, negotiated)                |
| `/docs/`     | `301` → `/docs`, then `302` → `/en/docs`                      |
| `/manifesto` | `200` — a locale-agnostic page resolves in place, no redirect |
| `/en/docs`   | `200` — an explicit prefix is never prefixed a second time    |
| `/nope`      | `404` — nothing to redirect to                                |

This is always on. There is no option for it: the fallback fires only where a 404 would otherwise occur **and** the prefixed page exists, a combination that is never intentional.

**The language is negotiated, not fixed** — the browser-detected language when `detectBrowser` is `true` and `Accept-Language` matches a configured code, and `languages.default` otherwise.

**`302`, not `301`.** The target depends on a request header, so the mapping is not permanent. A `301` is cached by browsers and intermediaries, which would pin the first-seen locale for that visitor forever. The line is drawn consistently: `/en` → `/en/` is a `301` (deterministic), `/` → `/fr/` is a `302` (negotiated). Every negotiated response declares `Vary: Accept-Language`.

**The target must resolve, and must be readable.** `/nope` stays a clean 404 rather than being sent to `/en/nope`. And the redirect fires only toward a page an anonymous visitor may open: if `/en/private` is role-gated, `/private` answers 404 — indistinguishable from a path that was never declared, because redirecting would disclose that the page exists while `/en/private` is busy hiding it.

The incoming query string is preserved, and `/api/`, `/assets/`, `/_admin/` and `/.well-known/` are never touched.

**Server mode only.** `sovrium start` performs this redirect; `sovrium build` emits no redirects at all. A statically hosted build answers `/docs` with whatever its host does, so declare the rule there. A `<meta http-equiv="refresh">` stub is the wrong fix: it returns `200`, turning the unprefixed URL into an indexable near-empty duplicate of the page it points at.

## Translation keys

Translations are key-value pairs per language, keyed with dot notation, and referenced anywhere a string is authored with a `$t:` prefix.

```yaml
languages:
  default: en
  translations:
    en:
      nav.pricing: Pricing
      form.submit: Send
    fr:
      nav.pricing: Tarifs
      form.submit: Envoyer
```

```yaml
- type: button
  label: '$t:form.submit'
```

The keys are your own vocabulary rather than the schema's, so the block is an open map: nothing validates a key name, and a typo surfaces as an untranslated string rather than as a decode error.

A key missing in the active language falls back to `fallback`, then to `default`. A key missing everywhere renders as the key itself, which is deliberately ugly: a silent empty string would ship a blank label.
