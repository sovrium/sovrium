# Visitor consent

> Declare the purposes a visitor is asked about, the page that explains them, and how long a choice is kept.

Declare `consent` and Sovrium draws a banner on every page you declare and holds back what it gates until the visitor accepts the matching purpose. Refusing takes the same effort as accepting: `Refuse all` and `Accept all` are buttons of the same kind, side by side, and no purpose is ticked in advance. A visitor who leaves without choosing has nothing stored, nothing gated runs, and the banner asks again on the next page.

Three pages the engine answers itself draw no banner. Its own not-found page, shown when you declare no `/404` page, carries the tracker held the same way, so it sends a page view only for a visitor who has already accepted. Its own error page and a standalone form page (`forms[].path`) carry no tracker at all. A `/404` or `/500` page you declare is a page like any other and draws the banner.

## What it holds back

A page script whose `consent` key names a declared purpose, in `externalScripts` or `inlineScripts`: its address is not fetched and its code does not run until that purpose is accepted, then it runs on the same page. When you declare a purpose with the id `analytics`, it also holds back the tracker the built-in analytics puts on the page, which sends page views and outgoing-link clicks, and every page `meta.analytics` provider, including its `dnsPrefetch` lookup. An app declaring `consent` and providers without that purpose is refused at validation.

## What stays outside it

The banner gates what is listed above and nothing else. Declaring a purpose does not reach the following, so review them yourself:

- Iframes and embeds, images and fonts from another site, the markup of a `customHTML` block, and any request a script makes once it has been accepted.
- What the browser acts on as the page loads: `meta.dnsPrefetch`, `meta.preload` and the tags in `meta.customElements`.
- Analytics events the server records itself, because it cannot read the visitor's choice: a short-link click, a QR scan, a form submission and an automation's `analytics` action. They are recorded before any acceptance and after a refusal. Under the `full` profile, the first three carry a per-visitor identifier. A form leaves the stream with its own `analytics.enabled: false`.

## How it composes with analytics

| Setup                                    | Tracker on the page                                                                | Banner                                                                              |
| ---------------------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `audience-only`, no `analytics` purpose  | Runs unless Global Privacy Control, Do Not Track or the visitor's opt-out stops it | None for analytics; a `consent-choice` control is still the visitor's way to object |
| `full`, no `analytics` purpose           | The same, storing every field                                                      | None; consent may be required, and that assessment is yours                         |
| Any profile, with an `analytics` purpose | Held until the visitor accepts                                                     | Yes                                                                                 |

To choose between these setups, and for what remains yours to decide, see **Set up analytics and visitor consent**.

## Privacy signals

Global Privacy Control and Do Not Track, when the site honours them, stop the tracker even after a visitor accepted the `analytics` purpose on the banner, so a visitor may accept and still not be measured. They also stop short-link clicks and QR scans being recorded. They do not stop form submission events or an automation's `analytics` action, and they do not gate page scripts or `meta.analytics` providers, which follow the banner alone.

## The stored choice

The choice stays in the visitor's browser, under the `sovrium.consent` key, and the server keeps no record of it, so the same HTML is served to every visitor and the page cache keeps working. A `consent-choice` control naming a declared purpose lets a visitor change their mind at any time: the purpose is off until they grant it, and pressing the control withdraws it.

The banner asks again when the declared purposes change, because the stored choice records them as `purposes:` followed by the sorted ids (`purposes:analytics,support-chat`), and once `expiresAfterDays` days have passed since the choice was made. `expiresAfterDays` defaults to 180 days, a product default chosen by Sovrium: set the value that fits your own obligations. A choice made through the opt-out control, before any `analytics` purpose was declared, never counts as an acceptance.

## Translating

Purpose labels and descriptions accept `$t:` keys. Rename the banner's own text per language under `sovrium.consent.banner.*`: `title`, `description`, `policyLink`, `refuseAll`, `acceptAll`, `saveChoices`, `saved`.

## Declaring it

The `consent` key takes three entries. `purposes` lists the purposes, at least one, each with an `id`, a `label` and a `description`; the label and the description accept `$t:` translation keys, and each id is declared once. `policyHref` is the address of the page that explains them, a path on the site or an `http(s)` address. `expiresAfterDays` is a whole number of days, from 1 to 730.

A page script refers to a purpose by its id, through the `consent` key of an external or an inline script, and a `consent-choice` control names one through its `purpose`.

```yaml
consent:
  purposes:
    - id: analytics
      label: $t:consent.analytics.label
      description: $t:consent.analytics.description
  policyHref: /privacy-policy
  expiresAfterDays: 180
```

## Configuration

<!-- sovrium:options ConsentSchema -->
