# Design System Console

> The console section that draws your design system at its rendered values — foundations, the UI kit, your own components, brand, voice — and the revocable link that publishes it to someone with no login.

`/_admin/design-system` draws the design system your config declares, at the values it actually renders with. The export endpoints and `sovrium design-system` hand the same content to a machine as text; this is the version a person reads.

It is admin-gated and returns `404` to anyone else, and it is **read-only**. Nothing on it edits configuration — the console is an operational data console, and the design system is one of the things it reflects.

## The six pages

The section is reached from **Design** in the sidebar's System group. Overview is a page _about_ the design system; the five after it are pages _of_ it, each drawing your real tokens through the same renderer your own pages use. Two of the six also serve a detail route, reached from the page above it.

| Route                                    | What it draws                                                                                                                                                                               |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/_admin/design-system`                  | The system summarised: live counts, one card per page, and the **Share and export** section at its foot.                                                                                    |
| `/_admin/design-system/foundations`      | Every token the app renders with — colour, type, spacing, radius, breakpoints, durations — drawn at the value it resolves to in the scheme you are reading, with the type ladder beside it. |
| `/_admin/design-system/ui-kit`           | Every component type this instance ships, grouped by category with the field types folded in, drawn by the renderer your own pages use.                                                     |
| `/_admin/design-system/ui-kit/:type`     | One catalogued type, addressed by the schema's own spelling of its name.                                                                                                                    |
| `/_admin/design-system/brand`            | The identity you declared: the logo and its rules, the imagery rules, what each colour is for, and the accent budget each zone may spend.                                                   |
| `/_admin/design-system/voice`            | The rules a writer follows here: the principles, how the app addresses a reader, the tone per moment, and the per-zone overrides.                                                           |
| `/_admin/design-system/components`       | The reusable components your own config declares, each rendered on its own beside its usage guidance and its usage count.                                                                   |
| `/_admin/design-system/components/:name` | One declared component.                                                                                                                                                                     |

There was a seventh page, `/design-system/agents`, and it is **retired** rather than redirected. What it carried — the share link, the two export documents and the CLI block — is the **Share and export** section at the foot of the Overview, because a hand-over is what a reader does after reading what they have. A page nothing links to is not a page nobody opens; it is an unaudited one.

Every page renders through the same shell and reads the same endpoints, so what a page is built from is invisible from the outside. There is **one scheme toggle**, in the console chrome, and it switches the specimens and the chrome around them together. `?scheme=dark` deep-links into it. The values printed beside each swatch follow the scheme, so the page never labels a swatch with a colour it is not showing.

## The component catalog

The **UI kit** page renders one specimen per component type, grouped by category. Each type also has a page of its own at `/_admin/design-system/ui-kit/{type}`.

Most types are drawn. One that is not is **named anyway, with the reason**: that is the point of the catalog, because a heading over an empty box would assert that the blank is the design. Two reasons appear:

- **Not previewable in a flat document.** The console draws every specimen in one page, because a design system inside a nested scrolling frame is not one a reader can read. That rules out anything with no resting appearance — an overlay that covers the page for as long as it is open, a command palette that builds itself in the browser on the first ⌘K, an `iframe` that would put the nested frame back — and anything carrying a live write control, which a read-only console may not have at all.
- **Needs a data source this page has none of.** A `record-field` draws one field of the record its page is bound to, and this page is bound to no record. A `language-switcher` draws the languages an app declares, and the console's own surface app declares none.

Each of those types carries its own sentence on its card, saying which of the two applies and where the component can be seen instead. Nothing is silently absent: every catalogued type has either a specimen or a sentence, and the count of each is a property of the catalog rather than of this page.

**No specimen carries a write path.** `form` is excluded from the `data` category because it ships a live submit control. This is not a backlog item: a console that edits configuration is the plane Sovrium deliberately does not ship, and a specimen is not the door it comes back through. Sovrium once shipped four config-editing component types for that plane and excluded them from this catalog for the same reason; they are now removed from the schema entirely, so there is nothing left to exclude — a config naming one is refused at boot.

### States

A type page draws a **States** strip when the type has states worth showing, and nothing at all when it does not. States belong to the TYPE rather than to its category: a `table` and a `chart` are both `data` components, and a table draws five states where a chart draws two — "empty" is a real state of a grid and means nothing on a plotted series. A type that has no strip of its own inherits its category's, so a button and a button group show the same four without either being written out twice.

Each state says two things about itself, and both are there because a strip that hid them would flatter itself:

- **Reached or drawn.** A _reached_ state is the component genuinely in that state — a disabled control is disabled, and an empty grid is a grid whose source returned no rows. A _drawn_ one is a picture: `:hover` and `:focus-visible` cannot be forced from markup, and a fetch in flight cannot be held still, so those cells show what the state looks like without the browser ever being in it. Publishing which is which is the difference between a documented state and a screenshot of one.
- **What it applies to.** Most states are the whole component's. Some are one **row's** — a hovered row, a selected row — and the strip says so, because "a row is selected" read as "the table is selected" is a different claim, and a highlight meant for one row painted across the whole grid is a different picture.

### Specimens are live

A component on its type page is the real component, mounted under your own theme — not a screenshot of one. Open a disclosure, switch a tab, sort a column, drag a card: the specimen answers, exactly as it will on your own pages.

Everything you do there stays in your browser. The console holds no write path of any kind, so nothing you change is saved, and reloading the page returns every specimen to how it was authored. A component whose only purpose is to write — a comment composer, for instance — is named on its page rather than drawn, for that reason.

## Seeing a component at three widths

A component page draws its subject at 1280, 768 and 375, stacked and sharing one left edge. Each is a real render at that width, not the same render squeezed: the component's own media queries evaluate against the frame, so a header that collapses to a menu button below `lg` collapses here too. The three frames follow whatever colour scheme you are reading the console in.

In your own config this is `viewport` on a `specimen`:

```yaml
- type: specimen
  subject:
    component: site-header
  viewport:
    width: 375
```

`viewport` needs `subject.component` — a template you declared. It re-renders the subject in a document of its own, which is the only way a width can reach a media query.

## Taking it away with you

The **Share and export** section at the foot of the Overview is the handover: the same system as a document rather than a page. Three routes out, all reading `design` and nothing else.

| Route                               | What it hands over                                                 |
| ----------------------------------- | ------------------------------------------------------------------ |
| `GET /api/admin/design-system.json` | A W3C Design Tokens document — **DTCG 2025.10**.                   |
| `GET /api/admin/design-system.md`   | A markdown brief, written to be pasted into an AI agent's context. |
| `sovrium design-system`             | The same two documents, offline — no server, no database.          |

The CLI takes `--format md` (the default) or `--format json`, and `--output <path>` to write a file instead of stdout, creating parent directories as needed. With `--output` the document goes to the file only; notices go to stderr, so `--format json` leaves stdout parseable. An unrecognised `--format` is an error rather than a silent fall back to markdown.

### `?flat=1` — the same tokens, addressed by path

The DTCG document is a nested tree, which is right for a conformant consumer and awkward for a script that wants one value. Adding `flat` to the **JSON** endpoint returns `{ items, total }` instead: one row per token, each addressed by its dotted path.

```bash
curl -H 'Cookie: <admin session>' \
  'http://localhost:3000/api/admin/design-system.json?flat=1'
```

Two things to know. It is opt-in **by name, not by value** — `?flat`, `?flat=0` and `?flat=1` all switch the shape, because a parameter that reshaped a standards document depending on its value would be a trap for the consumer that appended a cache-buster. And it is a **projection, never a replacement**: without the flag the document is byte-identical to what it always was. The markdown endpoint ignores the flag entirely.

### The facets

The console's own pages are assembled from a set of narrow read endpoints, and they are yours to call too — each admin-gated, each `404` to anyone else.

| Endpoint                                     | Rows                                                                                                  |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `GET /api/admin/design-system/tokens`        | Token rows; `?group=` restricts to one top-level DTCG group.                                          |
| `GET /api/admin/design-system/guidance`      | The principles, voice and tone rules a writer follows.                                                |
| `GET /api/admin/design-system/coverage`      | One row per layer — its count, its label, and a short `summary` saying what the layer actually holds. |
| `GET /api/admin/design-system/exports`       | The available export documents, with their size and line metadata.                                    |
| `GET /api/admin/design-system/usage`         | Per-component usage, when and don't guidance, with usage counts.                                      |
| `GET /api/admin/design-system/brand`         | The brand mark and its declared facts. A singleton, so it takes no query.                             |
| `GET /api/admin/design-system/zones`         | Per-zone accent budget and overrides.                                                                 |
| `GET /api/admin/design-system/provenance`    | For one `?type=` and `?part=`, which layer each rendered class came from.                             |
| `GET /api/admin/design-system/type-ladder`   | The platform type ladder, as rows.                                                                    |
| `GET /api/admin/design-system/specimen-rows` | The fixture rows the catalog's data specimens are drawn from.                                         |

## The share link

A design system's audience is wider than the people who have an account on your instance: designers, an agency, a client stakeholder. `GET /s/design-system/{token}` gives them the charter without giving them a login. The **Share link** panel mints one. The link is unlisted — it appears in no sitemap, no navigation and no page listing — and it is revocable.

| Operation | Endpoint                                      | Notes                                                                      |
| --------- | --------------------------------------------- | -------------------------------------------------------------------------- |
| Mint      | `POST /api/admin/design-system/shares`        | `201` with the id, the creation time, the token and the URL.               |
| List      | `GET /api/admin/design-system/shares`         | `{ items, total }`. Live shares, **metadata only** — id and creation time. |
| Revoke    | `DELETE /api/admin/design-system/shares/{id}` | `200` once; `404` for an unknown or already-revoked id.                    |
| Read      | `GET /s/design-system/{token}`                | Anonymous. No login, no cookie, no account.                                |

**The token is shown exactly once**, in the response to the mint. It is 256 bits of randomness — 64 hex characters — and it is stored only as a SHA-256 digest, so nothing, not the list endpoint, not the audit log, not a log line, can hand it back. That is what makes revocation mean something: an operator who could re-read a link would never learn it had leaked. If you lose the link, revoke it and mint another.

Revoking is immediate and total. The reader gets the same `404` as an unknown or malformed token — never a "this link has been revoked", which is a different answer and exactly what an enumerator collects. The reader page is a single self-contained document: no script, no form, no comment box, no upload. There is nothing on it to interact with, which is the strongest form of "the widest audience gets the weakest surface".

### What the link publishes

Anyone holding the URL reads the whole design system, not just its tokens. Before you send one, know that it contains:

- your **principles** and your **logo** section, including its clear-space, minimum-size and misuse rules;
- your **voice** — personality, pronoun, what to prefer, what to avoid — and the **tone** instruction for each moment;
- every **colour token** with its value, its usage rule and the token it pairs with;
- the **type scale**, and the spacing, radius, breakpoint, font and duration tokens;
- your **imagery** rules and the icon set;
- the **usage, when and don't** guidance for each of your components;
- the values Sovrium kept outside the token tree, and anything you declared that it does not apply.

It contains no environment-variable value and no record data — the projection reads `design` and nothing else, so there is no path on which a secret could arrive. But a brand charter is a document about your product, and a public link to it is a decision. Treat minting one as publishing.

Both mint and revoke write to the audit log — a mint at `warning` severity, because it is the entry an operator scans for when reconstructing when something became public. Neither entry records the token.

## Related reading

- **Design System** — the `design` key the console draws.
- **Type Scale** — the ladder the Foundations page renders.
- **Admin Dashboard** — the rest of the console, and the export endpoints.
- **Console Customization** — how your `design` paints the chrome around these specimens, and the accessibility floor it cannot remove.
- **Component Styles** — the `design.components` layer the provenance facet reports on.
- **Activity Monitoring** — where a mint and a revoke are recorded.
