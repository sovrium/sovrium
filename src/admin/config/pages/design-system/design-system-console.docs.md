# Design System Console

> The console section that draws your design system at its rendered values — foundations, your own components, brand, voice — and the revocable link that publishes it to someone with no login.

`/_admin/design-system` draws the design system your config declares, at the values it actually renders with. The export endpoints and `sovrium design-system` hand the same content to a machine as text; this is the version a person reads.

It is admin-gated and returns `404` to anyone else, and it is **read-only**. Nothing on it edits configuration — the console is an operational data console, and the design system is one of the things it reflects.

## The pages

The section is reached from **Design system** in the sidebar's Design group. Overview is a page _about_ the design system; the pages after it are pages _of_ it, each drawing your real tokens through the same renderer your own pages use. Two of them exist only when your config declares what they draw: Components answers 404, and leaves no row in the sidebar, on an app that declares no reusable component, and Brand does the same on an app whose `design` declares tokens and no identity.

| Route                                    | What it draws                                                                                                                                                                               | Shown when                                                           |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `/_admin/design-system`                  | The system summarised: what `design` declares against the default, one row per facet, and the **Share and export** section at its foot.                                                     | always                                                               |
| `/_admin/design-system/foundations`      | Every token the app renders with — colour, type, spacing, radius, breakpoints, durations — drawn at the value it resolves to in the scheme you are reading, with the type ladder beside it. | always                                                               |
| `/_admin/design-system/components`       | The reusable components your own config declares, grouped by kind, each drawn on its own with where it is used.                                                                             | `components`                                                         |
| `/_admin/design-system/components/:name` | One declared component.                                                                                                                                                                     | `components`                                                         |
| `/_admin/design-system/brand`            | The identity you declared: the logo and its rules, the imagery rules, what each colour is for, and the zone each route family belongs to.                                                   | `design` declares a logo, colour roles, imagery, principles or zones |
| `/_admin/design-system/voice`            | The rules a writer follows here: the principles, how the app addresses a reader, the tone per moment, and the per-zone overrides.                                                           | reads `design.voice`                                                 |

The console does not document the engine's own component types. Those are shadcn/ui's, and `sovrium docs components` lists every one of them with its options; the Overview points there once.

Every page renders through the same shell and reads the same endpoints, so what a page is built from is invisible from the outside. There is **one scheme toggle**, in the console chrome, and it switches the specimens and the chrome around them together. `?scheme=dark` deep-links into it. The values printed beside each swatch follow the scheme, so the page never labels a swatch with a colour it is not showing.

## Your components

The Components page is a gallery of the templates in your `components` list, grouped by what each one is — **Page sections**, **Cards**, **Forms**, **Navigation** and **Data views** — read from the type of its outermost component. Each tile draws the template live under your own theme, names it, says on how many pages it is used, and offers **Copy $ref**, which copies the line that places it in a page. A template's own page draws it larger, and at the widths below.

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

| Endpoint                                      | Rows                                                                                                  |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `GET /api/admin/design-system/tokens`         | Token rows; `?group=` restricts to one top-level DTCG group.                                          |
| `GET /api/admin/design-system/guidance`       | The principles, voice and tone rules a writer follows.                                                |
| `GET /api/admin/design-system/coverage`       | One row per layer — its count, its label, and a short `summary` saying what the layer actually holds. |
| `GET /api/admin/design-system/exports`        | The available export documents, with their size and line metadata.                                    |
| `GET /api/admin/design-system/usage`          | Per-component usage, when and don't guidance, with usage counts.                                      |
| `GET /api/admin/design-system/brand`          | The brand mark and its declared facts. A singleton, so it takes no query.                             |
| `GET /api/admin/design-system/zones`          | Per-zone voice overrides.                                                                             |
| `GET /api/admin/design-system/provenance`     | For one `?type=` and `?part=`, which layer each rendered class came from.                             |
| `GET /api/admin/design-system/type-ladder`    | The platform type ladder, as rows.                                                                    |
| `GET /api/admin/design-system/specimen-rows`  | The fixture rows the catalog's data specimens are drawn from.                                         |
| `GET /api/admin/design-system/specimen-graph` | The same fixture as nodes and edges (people, teams, projects), for the graph and matrix specimens.    |

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
