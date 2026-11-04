# Set up analytics and visitor consent

> Choose what the built-in analytics stores, whether it waits for a visitor's acceptance, and how visitors object, and see what each choice leaves for you to decide.

This guide is for the person deciding how a Sovrium site measures its audience. It walks through the settings in the order you decide them, says what each one does and does not reach, and ends with the part no setting can do for you. It is not legal advice: whether a setup is lawful for your site depends on your purposes, your visitors and your regulator.

The reference is in **Analytics** and **Visitor Consent**. This guide links to their tables rather than repeating them.

## Choose a profile

`analytics.profile` decides what each event keeps. The server applies it, whatever the tracker sends.

| Profile                   | A page view keeps                                                                        | Short-link clicks, QR scans, form submissions | Reports                                            |
| ------------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------- | -------------------------------------------------- |
| `audience-only` (default) | The path without its query string, the referring host, device, browser, system, language | One identifier shared by every event          | Rounded counts, by the day; individual rows hidden |
| `full`                    | All of that, plus the page title, the full referrer, UTM values, the screen size         | A per-visitor identifier                      | Stored counts, by the hour; events listed          |

Every event type is listed under **What a row holds** in **Analytics**.

```yaml
analytics:
  profile: audience-only
```

**Under `audience-only`, reports are rounded.** A count from 1 to 9 reads 10, any other count the nearest 10, and 0 stays 0. Shares are computed from the rounded counts, and an hourly series is refused. `GET /api/analytics/events` lists custom events only, without identifiers. The console follows: a short link's page explains that individual clicks are not listed instead of drawing a click log.

**Switching to `audience-only` also changes what is already stored.** At the next start, before the app answers, a sweep strips the excluded fields from existing events. Every row is kept and rewritten, none is deleted, and the original values cannot be recovered. Take a backup first if you may need them. Later starts on `audience-only` leave the events alone. Switching to `full` touches nothing: older rows stay minimised, and only new events carry the extra fields. The profile the last start ran under is kept in the database, so restoring a backup taken under `full` sweeps again at the next start.

## Decide how to treat browser signals

Two settings decide whether the browser's own privacy signals stop measuring. Both default to `true`.

| Setting                       | Signal                                |
| ----------------------------- | ------------------------------------- |
| `respectDoNotTrack`           | Do Not Track (`DNT: 1`)               |
| `respectGlobalPrivacyControl` | Global Privacy Control (`Sec-GPC: 1`) |

While a setting is on, a browser sending that signal has no page views, outbound clicks, short-link clicks, QR scans or form-submission events recorded. Its form submissions are still saved. Set one to `false` and those visitors are recorded like any others.

The Global Privacy Control specification names United States privacy law as its main motivation. What the signal means for a site elsewhere is not settled by this setting, so say in your notice how you treat it.

## Choose how visitors decide

There are two controls, and they answer different questions.

- **An opt-out, the `consent-choice` component.** The tracker runs, and a visitor can turn it off. Place the control where people expect it, usually your privacy page. See **Interactive Components**.
- **A banner, the `consent` key.** With a purpose whose id is `analytics`, the tracker is held until the visitor accepts. See **Visitor Consent**.

```yaml
consent:
  purposes:
    - id: analytics
      label: Audience measurement
      description: Counts visits to our pages so we can see what people read.
  policyHref: /privacy
```

The two compose like this, and the profile does not change which row applies.

| Setup                                    | Tracker                                      | Banner                                            |
| ---------------------------------------- | -------------------------------------------- | ------------------------------------------------- |
| `audience-only`, no `analytics` purpose  | Runs unless GPC, DNT or the opt-out stops it | None for analytics; `consent-choice` still needed |
| `full`, no `analytics` purpose           | The same, storing every field                | None; consent may be required                     |
| Any profile, with an `analytics` purpose | Held until accepted                          | Yes                                               |

Three behaviours are worth checking against what you intend:

- **A signal beats an acceptance.** A visitor who accepts on the banner and whose browser sends a signal you honour is still not measured by the built-in analytics. Your reports will count fewer people than accepted.
- **Signals do not reach what the banner gates.** Page scripts and `meta.analytics` providers follow the banner alone, whatever the browser sends.
- **A banner needs its control too.** Add a `consent-choice` naming the purpose so a visitor can change their mind later: with the purpose declared, it starts off and turns measuring on only once granted. An app declaring `consent` and `meta.analytics` providers must declare the `analytics` purpose, or it is refused at validation.

## What stays outside the gate

Declaring a purpose holds back page scripts naming it, the built-in tracker and `meta.analytics` providers. It does not hold back the following, and your notice has to account for them.

**Events the server records itself.** The server cannot read a choice kept in the visitor's browser, so these are recorded before any acceptance and after a refusal.

| Event                              | Stopped by GPC or DNT | Identifier under `full`        | How to stop it                         |
| ---------------------------------- | --------------------- | ------------------------------ | -------------------------------------- |
| Short-link click                   | Yes                   | Per visitor                    | Turn analytics off                     |
| QR scan                            | Yes                   | Per visitor                    | Turn analytics off                     |
| Form submission                    | Yes                   | Per submitter                  | `analytics.enabled: false` on the form |
| An automation's `analytics` action | No                    | None; the event has no visitor | Remove the action, or what it sends    |

Under `audience-only`, short-link clicks, QR scans and form submissions carry only the identifier they all share. An automation's event holds whatever properties you send it, so a person's data placed there is stored as written, on either profile.

**Erasure.** Erasing a signed-in person deletes their form submissions and, under `full`, the analytics events that pointed at them; events never tied to an account (page views, clicks) carry no name to erase and age out with `retentionDays`.

**What the page itself loads.** Iframes and embeds, images and fonts from another site, the markup of a `customHTML` block, and any request a script makes once it has been accepted. What the browser acts on as the page loads also stays outside: `meta.dnsPrefetch`, `meta.preload` and the tags in `meta.customElements`. Review each one on its own terms; an embed from another site sends that site the visitor's request whatever your banner says.

**Pages the engine answers itself.** Its own not-found page, used when you declare no `/404`, draws no banner, and its tracker stays held for anyone who has not already accepted. Its own error page and a standalone form page (`forms[].path`) draw no banner and carry no tracker. A form submitted from one still records its event.

## What is kept in the browser

The tracker sets no cookie. The only thing kept in the browser is the visitor's own choice, written when they press a control or answer the banner, under the `localStorage` key `sovrium.consent`:

| Field           | Holds                                                                              |
| --------------- | ---------------------------------------------------------------------------------- |
| `v`             | The format version.                                                                |
| `configVersion` | The purposes the choice was made against. When they change, the banner asks again. |
| `at`            | The day the choice was made, not a time.                                           |
| `purposes`      | Each purpose, `granted` or `denied`.                                               |

It holds no identifier, and the server keeps no record of it, so you cannot show from your own data that one visitor accepted. A choice counts for `expiresAfterDays` days, 180 unless you set another value. That default is a product choice, not a legal figure.

## What remains yours

No setting does the following:

- **Deciding the legal basis.** Whether you rely on consent or on another basis is your decision, on either profile. Choosing `audience-only` reduces what is stored; it does not decide the question.
- **Writing the notice.** Name what you collect, why, for how long, and how you treat the signals. Include the events under **What stays outside the gate**. **A notice to start from**, below, is a draft for this; the final text is yours.
- **Placing the control.** A `consent-choice` nobody declares, or one buried where nobody looks, is not a way to object.
- **Not cross-referencing.** The engine keeps analytics apart from your records, but nothing stops an automation or an export from joining them. Keep that from happening in how you run the app.
- **Excluding paths that identify people.** `audience-only` drops the query string and keeps the path, so a path like `/members/alice` is stored as written. List such paths under `analytics.excludedPaths`, or move the name out of the URL.
- **Setting the retention.** `analytics.retentionDays` defaults to 365. Set the period you can justify and state it in the notice.
- **Doing the assessment.** The sections above tell you what it has to cover. Keep your conclusion, and revisit it when the setup changes.

### A notice to start from

This is a starting point to adapt, not legal advice. Keep the paragraph for your profile, fill in the brackets, and remove what your setup does not do. It covers the built-in analytics only, so add your embeds, scripts and `meta.analytics` providers.

> **Audience measurement.** We measure visits to this site with analytics built into the software that runs it, on our own servers, to see [which pages are read and where visitors come from]. It sets no cookie and sends nothing to another company. We keep this data for [365] days.
>
> Each event is stored with its date and time, a visitor identifier that changes every day and a session identifier.
>
> _(`audience-only`)_ For a page view we keep the page address without its query string, the referring site, and your device type, browser, operating system and language. For a link you follow out of this site, we keep where it went and the page it was on, without query strings. For a short link or QR code, we keep the link, where it led, and your device type, browser and operating system. For a form, we keep which form was submitted. Those last three carry one identifier shared by every visitor. Our reports show rounded counts by the day.
>
> _(`full`)_ For a page view we keep the page address, its title, the full address you came from, campaign values, your screen size, and your device type, browser, operating system and language. For a link you follow out of this site, we keep the full addresses. For a short link, a QR code or a form submission, we also keep a per-visitor identifier, and for a form, the id of your submission. Our reports show counts by the hour, and our administrators can list individual events.
>
> **How to object.** Use the control at [link to your `consent-choice`]. Your choice stays in your browser and holds no identifier. If your browser sends Global Privacy Control or Do Not Track, we record no page views, outbound clicks, short-link clicks, QR scans or form submission events. The control does not reach short-link clicks, QR scans or form submission events, because our server answers them without reading your choice; [how to reach us about them].

If you declare an `analytics` purpose, add that page views wait until the visitor accepts, and that short-link clicks, QR scans and form submission events do not. If you set `respectDoNotTrack` or `respectGlobalPrivacyControl` to `false`, change that sentence.

### One regulator's framework: the CNIL

France's data protection authority, the CNIL, describes [conditions under which audience measurement may run without prior consent](https://www.cnil.fr/fr/cookies-et-autres-traceurs/regles/cookies-solutions-pour-les-outils-de-mesure-daudience) and publishes a [self-assessment tool, dated July 2025](https://cnil.fr/sites/default/files/2025-07/outil_d_auto-evaluation_mesure_d_audience.pdf). Here is how the engine's measures sit next to its objectives, under `audience-only`.

| The CNIL's objective                               | What the engine provides                                                                                    | What is left to you                                                                  |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| The only purpose is measuring the site's audience  | Fields limited to counting an audience                                                                      | Using the figures for that purpose alone; keeping custom automation events out of it |
| The tool does not follow a person outside the site | No cookie; nothing sent to another service by the built-in analytics; UTM values and full referrers dropped | Third-party scripts, embeds and `meta.analytics` providers, which are separate       |
| The data only produces statistics                  | Rounded, daily reports; no listing of page views or clicks                                                  | Judging whether your traffic and your paths can still single someone out             |
| A person's right to object is respected            | `consent-choice`, kept in the visitor's browser                                                             | Placing it, usually on the privacy page                                              |
| The provider acts as a processor                   | You run the engine; analytics data stays on your server and Sovrium does not receive it                     | Your own hosting and subcontractor contracts                                         |

Read this with its limits. It is one regulator's framework, and other countries' authorities may see it differently. It is a self-assessment: the tool only addresses whether measurement can run without prior consent, not whether a solution as a whole meets the law, and the conclusion is yours to reach and to defend. The tool also lists things this table leaves open, such as a limit on the kinds of event collected, so read it yourself. Short-link clicks, QR scans, form submissions and custom events all need a look there. `profile: full` keeps what the objectives above ask to drop, UTM values and full referrers among them.

## Related reading

- **Analytics**: every option, what a row holds, the read endpoints.
- **Visitor Consent**: the `consent` key, the banner, how a stored choice expires.
- **Interactive Components**: the `consent-choice` control.
- **Short Links**: the clicks and scans the server records.
- **GDPR & Privacy**: export and erasure for signed-in people.
