# Design System Console

> The console section that draws your design system at its rendered values — foundations, your own components, brand, voice — and the revocable link that publishes it to someone with no login.

`/_admin/design-system` draws the design system your config declares, at the values it actually renders with. The export endpoints and `sovrium design-system` hand the same content to a machine as text; this is the version a person reads.

It is admin-gated and returns `404` to anyone else, and it is **read-only**. Nothing on it edits configuration — the console is an operational data console, and the design system is one of the things it reflects.

## The pages

The section is the sidebar's **Design** group: Overview, Foundations, Components, Brand and Voice, listed directly. Overview is a page _about_ the design system; the pages after it are pages _of_ it, each drawing your real tokens through the same renderer your own pages use. Two of them exist only when your config declares what they draw: Components answers 404, and leaves no row in the sidebar, on an app that declares no reusable component, and Brand does the same on an app whose `design` declares tokens and no identity.

| Route                                    | What it draws                                                                                                                                                                               | Shown when                                                           |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `/_admin/design-system`                  | The system summarised: what `design` declares against the default, one row per facet, and the **Share and export** section at its foot.                                                     | always                                                               |
| `/_admin/design-system/foundations`      | Every token the app renders with — colour, type, spacing, radius, breakpoints, durations — drawn at the value it resolves to in the scheme you are reading, with the type ladder beside it. | always                                                               |
| `/_admin/design-system/components`       | The reusable components your own config declares, grouped by kind, each drawn on its own with where it is used.                                                                             | `components`                                                         |
| `/_admin/design-system/components/:name` | One declared component.                                                                                                                                                                     | `components`                                                         |
| `/_admin/design-system/brand`            | The identity you declared: the logo and its rules, the imagery rules, what each colour is for, and the zone each route family belongs to.                                                   | `design` declares a logo, colour roles, imagery, principles or zones |
| `/_admin/design-system/voice`            | The rules a writer follows here: the principles, how the app addresses a reader, the tone per moment, and the per-zone overrides.                                                           | reads `design.voice`                                                 |

On the Overview, each page row carries a small preview drawn from your own design: your colours (the ones you declare first), the names of your templates, and one sentence of your voice (its first preferred line, else its first personality trait).

The console does not document the engine's own component types. Those are shadcn/ui's, and `sovrium docs components` lists every one of them with its options; the Overview points there once.

Every page renders through the same shell and reads the same endpoints, so what a page is built from is invisible from the outside. There is **one scheme toggle**, in the console chrome, and it switches the specimens and the chrome around them together. `?scheme=dark` deep-links into it. The values printed beside each swatch follow the scheme, so the page never labels a swatch with a colour it is not showing.

Foundations lists colours under shadcn/ui's names (`background`, `card`, `primary`, `muted-foreground`…), in shadcn's order. A key you wrote under an older name shows under its shadcn twin (`background-raised` as `card`), and an extension such as `success` or `primary-hover` shows only when you declare it. Each swatch is filled with its colour and carries its values on it. Each `*-foreground` is measured against the colour it sits on (`primary-foreground` on `primary`), every other colour against `background`. In dark, a colour you did not declare for dark shows the value your app actually paints, marked with where it comes from and measured. A brand colour (`primary`, `secondary`, `accent`, `ring`, a chart colour) you declared for light only keeps your light value, and the text drawn on it keeps its light value too; so does a colour of your own the platform has no dark default for. Every other colour takes the platform's dark default, including a background, card, body text or border you declared for light only, because kept light it would draw dark text on a dark page. When you declare `primary` and neither `primary-hover` nor `primary-active`, both are derived from it: the same hue, a step lighter and a step darker.

## Your components

The Components page is a gallery of the templates in your `components` list, grouped by what each one is — **Page sections**, **Cards**, **Forms**, **Navigation** and **Data views** — read from the type of its outermost component. Each tile draws the template live under your own theme, names it, says on how many pages it is used, and offers **Copy $ref**, which copies the line that places it in a page. A template's own page draws it larger, and at the widths below.

A template drawn on its own has no `vars`, so the console draws it on **sample data**: each `$variable` takes the value the first page in your `pages` list hands it through `vars`, and a variable no page supplies is drawn as its own name. A template's page also carries a **Props** table: every variable it reads, the type of node it fills, and that sample.

A template is also drawn in the **state its users meet**, on a sample made from your config alone — never a record, an invitation or a person of your instance. A template placed on a page bound to one record reads `$record` from a sample of that table: each text field reads `Sample <field>`, an option field its first option, a date a fixed day. An invitation card is drawn on a pending invitation, a two-step code block on a sign-in waiting for its code, and a record's history on a few changes by a sample person. Every form in a frame can be filled and pressed, and none of them sends anything.

## Seeing a component at three widths

A component page draws its subject at 1280, 768 and 375, stacked and sharing one left edge. Each is a real render at that width, not the same render squeezed: the component's own media queries evaluate against the frame, so a header that collapses to a menu button below `lg` collapses here too. The three frames follow whatever colour scheme you are reading the console in. A frame wider than the column is scaled down to fit it, and its heading says by how much ("shown at 51 %"); the component still lays out at the width the heading names.

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

The **Share and export** section at the foot of the Overview is the handover: the same system as a document rather than a page. It lists the full bundle first — the one download to take into a design tool or an AI — then its parts one file at a time (the markdown brief, the token document and the theme stylesheet), and the two terminal commands, for the brief and for the bundle. These routes out all read `design` and nothing else.

| Route                                      | What it hands over                                                                           |
| ------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `GET /api/admin/design-system.json`        | A W3C Design Tokens document — **DTCG 2025.10**; `?mode=dark` for the dark palette.          |
| `GET /api/admin/design-system.md`          | A markdown brief, written to be pasted into an AI agent's context.                           |
| `GET /api/admin/design-system.css`         | The theme stylesheet in shadcn/ui variable names: light under `:root`, dark under `.dark`.   |
| `GET /api/admin/design-system.zip`         | The **portable bundle**, as one download (below).                                            |
| `GET /api/admin/design-system/bundle`      | The bundle's `manifest.json`: every file with its size, SHA-256 and role.                    |
| `GET /api/admin/design-system/bundle/file` | One text file of the bundle by `?path=`, byte for byte. Fonts are only in the zip.           |
| `sovrium design-system`                    | The same documents offline — no server, no database — and the bundle with `--format bundle`. |

The CLI takes `--format md` (the default), `--format json` or `--format bundle`, `--mode light` (the default) or `--mode dark` with `--format json` only, and `--output <path>` to write a file instead of stdout, creating parent directories as needed. With `--output` the document goes to the file only; notices go to stderr, so `--format json` leaves stdout parseable. An unrecognised `--format` or `--mode` is an error rather than a silent fall back to the default. The brief lists each colour's light and dark value side by side, one row per colour; the Dark column is what the app paints under `.dark`, so the brief needs no `--mode`.

### The portable bundle

The bundle is one directory for a design tool or an assistant: `DESIGN.md` (the brief), `llms.txt` (an index to read first), `tokens/` (the DTCG documents for light and dark, and a `sovrium.resolver.json` choosing between them), `css/theme.css` and `css/tailwind.css` (a Tailwind v4 `@theme`), `components/` (a rendered kit — one static page per component type, each variant drawn in light and dark, with the component alone and none of the page around it), `fonts/` (the font files the kit uses, copied, never inlined), `assets/` (the sample picture, video and sound the media specimens draw, and your logo files when `design.logo` names files in your public directory — a logo given as an `https://` address is named, never fetched), `adapters/` (the same tokens in each design tool's own format, below), and `manifest.json`, which lists every other file with its SHA-256. The kit loads nothing from the network, so it opens offline. A type it cannot draw as a static page — a live form, one that needs your records — is listed in `components/manifest.json` with the reason, rather than left out. Each component's entry, and its README in the Claude Design folder, carries the dos and don'ts the component manual states for that type, sentence for sentence; a type the manual gives no such rule is left without any. The light tokens hold the same values as the `.json` export, and the brief is the `.md` export. The token files are written indented, the same on every surface — the CLI's directory, the zip, a shared link and the file read — so one config gives the same files, checksum for checksum, wherever the bundle came from. A bundle is never accepted back: every route above answers `GET` only.

Taking the system away is recorded in the audit log: each download of the zip, each read of the manifest and each read of the stylesheet writes one design read event naming you, as the `.json` and `.md` exports do. Reading the bundle one file at a time writes none — the manifest read that lists those files already records the handover.

#### One folder per design tool

Each design tool gets its own format under `adapters/`, converted from the bundle's token documents rather than rebuilt from the config, so every tool sees the same values:

| Tool                  | Files                                                                                                                                                                                                 | Load it                                                                                                                                                                                                                                                                                                                                                                                                           |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Claude Design         | `claude-design/project/`: `design-system.json`, `README.md`, `tokens.json`, `fonts/`, `components/bundle.css`, `components/Cover/preview.html`, `components/<Component>/README.md` and `preview.html` | Publish the `project/` folder as a Design System (the 0.2.47 format) as it is: it carries the index the page reads first and a cover drawn from your tokens. Light and Dark are two colour themes; every token carries a usage line, from `colorRoles` when declared. The folder holds no picture, video or sound: the artifact keeps those as uploads, so add your logo from the bundle's `assets/` in the page. |
| Figma                 | `figma/light.tokens.json`, `figma/dark.tokens.json`                                                                                                                                                   | Import both files into one Variables collection with Figma's DTCG import, one mode each. Lengths in px (rem at a 16px root), durations in seconds, one family per font.                                                                                                                                                                                                                                           |
| Tokens Studio, Penpot | `tokens-studio/tokens.json`                                                                                                                                                                           | Load the file: a `global` set, a `light` and a `dark` colour set, and a Light and a Dark theme.                                                                                                                                                                                                                                                                                                                   |
| Style Dictionary      | `style-dictionary/config.json`, `style-dictionary/config.dark.json`                                                                                                                                   | `style-dictionary build --config adapters/style-dictionary/config.json` from the bundle root builds `variables.css` from `tokens/base.tokens.json`, the light tokens. `style-dictionary build --config adapters/style-dictionary/config.dark.json` builds `variables.dark.css` from `tokens/dark.tokens.json` under `.dark`.                                                                                      |

Each component card in the Claude Design project draws the kit's own rendered component; the kit stylesheet is the project's `components/bundle.css`, which the artifact loads into every card, and the fonts are copied into the project, so a card loads nothing from the network. When your config declares no type scale or spacing, the brand book says so and lists the platform's text sizes, rather than inventing tokens. Typography composites and easing curves have no Figma variable type and are not in the Figma files.

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
| Download  | `GET /s/design-system/{token}.zip`            | Anonymous. The same bundle an admin downloads; dies with the link.         |

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
- as a **download**, the whole portable bundle: the token files for both colour modes, the stylesheets and the rendered component kit — files a reader keeps after you revoke the link.

It contains no environment-variable value and no record data — the projection reads `design` and nothing else, so there is no path on which a secret could arrive. But a brand charter is a document about your product, and a public link to it is a decision. Treat minting one as publishing.

Both mint and revoke write to the audit log — a mint at `warning` severity, because it is the entry an operator scans for when reconstructing when something became public. Neither entry records the token.

## Related reading

- **Design System** — the `design` key the console draws.
- **Type Scale** — the ladder the Foundations page renders.
- **Admin Dashboard** — the rest of the console, and the export endpoints.
- **Console Customization** — how your `design` paints the chrome around these specimens, and the accessibility floor it cannot remove.
- **Component Styles** — the `design.components` layer the provenance facet reports on.
- **Activity Monitoring** — where a mint and a revoke are recorded.
