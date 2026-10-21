# Design System

> `design` holds the tokens plus everything a design system needs that tokens alone cannot carry — the principles behind them, the mark, the voice, what each colour is for, the zone map — and exports the lot as a DTCG document or an agent brief.

A palette of hex values tells a renderer everything and a human nothing. `primary: '#3b5bdb'` does not say whether it is a CTA fill or a body-text colour, so anyone adding a page later — a teammate, or an agent working in your repo — picks by feel and the design drifts. `design` makes those rules declarable, and `sovrium design-system` hands them over as a file.

## One key per decision

Every token category is a direct key of `design`, named for the decision it makes rather than for the CSS property that renders it.

<!-- sovrium:options DesignSchema depth=1 -->

**There is no `theme` key.** It was removed, along with `design.theme` and `design.scales`. A config still declaring one is refused by `sovrium validate`, with a message naming the destination for every member — a rename is a rename, and being told which key to use is the whole point of refusing rather than guessing.

The token keys have their own articles: Theme Overview & Colors, Baseline & Dark Mode, Typography, Type Scale, Spacing/Radius/Elevation, Responsive Design, Animations, Density, and Component Styles. What follows is the charter — the half of a design system that is prose rather than values.

## Principles

`design.principles` is an ordered list of the convictions behind the tokens. They render at the top of the export, so whoever reads it gets the reasoning before the values.

```yaml
design:
  principles:
    - Restraint over ornament
    - The visitor is the hero, not the product
    - Colour is spent on error, and nowhere else
```

## Logo

The mark and the rules for placing it — the first section of every brand charter.

<!-- sovrium:options LogoSchema -->

`alt` is required alongside `src` because a mark with no accessible name is a defect rather than a partial declaration: it reaches a screen reader as nothing at all. Write the app's name, not `logo` — a screen reader already announces the element as an image.

`clearSpace` is deliberately prose and not a dimension. Every charter worth reading states clear space **relative to the mark** — "the height of the S on all four sides" — because that is the rule that survives the mark being resized. `minWidth` is a dimension because, unlike clear space, it genuinely is one number, and it is the number a consumer can enforce.

`misuse` is the half that changes behaviour. "Use the wordmark" tells a designer nothing they were not already going to do; "never re-colour it, never set it on a busy photograph" is the sentence that prevents the thing you did not want.

```yaml
design:
  logo:
    src: /logos/wordmark.svg
    srcDark: /logos/wordmark-light.svg
    alt: Acme
    clearSpace: Leave clear space equal to the height of the mark on all four sides.
    minWidth: 96px
    misuse:
      - Never re-colour the mark.
      - Never stretch, rotate or add effects.
      - Never place it on a busy photograph without a plate.
```

**`srcDark` is named for the MODE, not for the ink.** This is the field most often filled in backwards, because logo files are usually named for their ink and the two conventions are opposites. A **dark-ink** file is the one shown in **light** mode, so it belongs in `src`; the **light-ink** file belongs in `srcDark`. Omit `srcDark` entirely when one mark reads on both surfaces — requiring a second file invites a duplicate that then goes stale.

### Where the file lives

`src` and `srcDark` hold a **reference**, not bytes, and the only thing any consumer can do with one is put it in a `src=` attribute. Two forms are accepted:

- **Root-relative** — `/logos/wordmark.svg`. This covers both storage homes with one rule: a file in the app's public directory is served at `/name.ext`, and a bucket object at `/api/buckets/{bucket}/files/{path}`.
- **Absolute `https://`** — for a mark on a CDN or owned by another party.

Everything else is refused, each for a reason. A bare relative path resolves against the **current page**, so the same declaration loads `/wordmark.svg` on the home page and `/fr/docs/guide/wordmark.svg` inside a docs zone — there is no way to write a correct one, so accepting one accepts only mistakes. `http://` on an https app is mixed content: the browser blocks it silently and the mark is simply absent. `data:` inlines a wordmark into every page's HTML, paid for on every request and cached on none.

**Prefer SVG.** A wordmark is line art: resolution-independent, smaller than any raster encoding of it, sharp at every density, and with no codec question at all. A mark declared here is served verbatim and never enters the runtime image-transform pipeline — a customer's wordmark is their trademark, and re-encoding it is not Sovrium's call.

## Voice

How the app speaks, whatever the situation. Every field is optional.

<!-- sovrium:options VoiceSchema -->

`pronoun` is a free string rather than a fixed list, because the register contract is per-language: an app written in French chooses between `tu` and `vous`, one written in English has no choice to make, and a fixed list would refuse the first language it never enumerated.

`prefer` and `avoid` are the two halves of a house style guide. Put the work into `avoid`: refusals are what stop plausible-looking off-brand copy.

`tone` covers the moments where a system speaks. Each value is one instruction telling the writer _how_ to write that moment, not the literal string — the strings are per-locale and live under `languages`. Declare the moments you have thought about and omit the rest; an absent key is better than an instruction invented to fill a table.

```yaml
design:
  voice:
    personality: [warm, direct, never condescending]
    pronoun: you
    prefer:
      - 'Lead a CTA with its verb: Deploy, Save, Delete.'
      - Every empty state carries a guidance line naming the next action.
    avoid:
      - No exclamation marks in product chrome.
      - No emoji.
    tone:
      empty: Say what this is, then the one next action.
      loading: Say how long, and that they can leave.
      error: State the constraint, then offer two ways forward. Never accuse.
      success: One line, ending in a period. No fireworks.
      destructive: Name what is deleted, how many, and whether it is reversible.
```

## Colour roles

`design.colorRoles` answers the question `design.colors` cannot: what is this colour _for_? `usage` says what it is for and — more usefully — what it is not for; `pairsWith` names the token this one is designed to sit against, usually its foreground companion, so a reader does not have to re-measure the contrast. The full option table is in the Component Styles article, beside the ramps roles resolve through.

**Every key must name a colour your palette declares.** A role documenting a token that does not exist is guidance nobody can act on, and in practice it is a typo — so `sovrium validate` refuses it and lists the tokens that do exist. `pairsWith` is deliberately not checked the same way: a legitimate companion is often a platform role token your app never redeclared.

## Imagery

How the app looks where tokens cannot reach. Two pages can use identical tokens and still look like two different products, because one chose a stock photograph of people pointing at a whiteboard and the other chose a screenshot of the running app.

<!-- sovrium:options ImagerySchema -->

`principles` and `photography` are separate because a principle is a standard to judge against and a rule is a constraint to obey. "Show the product working" is a principle; "no stock photography, ever" is a rule, and conflating them makes the rule sound negotiable.

`iconSet` is the highest-leverage field here. Icon drift is not caused by anyone choosing a _bad_ icon — it is caused by three authors each choosing a _reasonable_ icon from three different sets, after which no amount of token discipline makes the toolbar look like one product. Naming the set once removes the decision. It is a **name**, not a URL or a package specifier: what a reader needs is which set to search, and a version pin answers a different question and goes stale on every bump.

**Nothing in `imagery` names a file**, deliberately. A logo is one specific artifact with one URL; imagery is a class of artifact with rules, and the images themselves are declared where they are used — in pages, in records, in buckets. An asset list here would look like it did something and would in fact be a second, unrendered copy going stale the moment either side changed.

## Zones

`design.zones` is the one key here that describes **routes** rather than tokens or words: which route patterns belong to which zone, and how each zone's voice departs from `design.voice`.

<!-- sovrium:options DesignZoneSchema -->

```yaml
design:
  zones:
    - { pattern: '/app/*', zone: product }
    - { pattern: 'everything else', zone: marketing }
```

## Component guidance

Guidance gives your own reusable components something to say beside their name, and it lives **on the template**, as `components[].guidance` — not here. Three fields, three different questions: `usage` is what it _is_, `when` is the situation that selects it over its neighbours, and `dont` is the misuse to refuse. All optional.

Co-locating it removed a whole class of mistake rather than moving one: a rename can no longer half-apply, because there is no second place holding the name.

## Exporting it

The whole point of declaring this is to be able to hand it over. One generator produces all three surfaces, so they cannot disagree about what your design system is.

```bash
sovrium design-system app.yaml                                  # the agent brief, on stdout
sovrium design-system app.yaml --output DESIGN.md               # committed beside the config
sovrium design-system app.yaml --format json --output tokens.json
sovrium design-system app.yaml --format bundle --output design-system
sovrium design-system app.yaml --format bundle --pages --output design-system  # with your pages
```

Markdown is the default because the default reader is a model. The command runs offline — no server, no database — so it fits a pre-commit hook or a CI step. It refuses an unknown `--format`, refuses `--mode` with any format but `json` (the brief and the bundle describe both colour schemes), and refuses a config that fails validation rather than exporting a design system describing an app that cannot boot. The brief lists each colour's light and dark value side by side, one row per colour; the Dark column is what the app paints under `.dark`. `--format bundle` writes the portable bundle — the brief, the tokens for both colour modes, the theme CSS and a rendered component kit — into a directory a design tool or an assistant can be handed whole. `--pages` adds your pages to it, drawn as the app draws them, so a designer starts from the real screen rather than a screenshot.

The same content is served at runtime from `GET /api/admin/design-system.json` (a W3C DTCG 2025.10 document; `?mode=dark` answers the dark palette) and `GET /api/admin/design-system.md` (the brief the CLI prints), with the bundle at `GET /api/admin/design-system.zip`. All are admin-gated and read-only, and return `404` to anyone else. The design-system console renders the same content as a page a person reads, and can publish it behind a revocable link to someone with no login.

In the JSON document tokens appear as standard DTCG types — colours as `{colorSpace, components, hex}` objects, dimensions as `{value, unit}`, the type scale as `typography` composite tokens — and the Sovrium-specific layer (principles, logo, voice, colour roles, imagery, component guidance) rides in `$extensions` under `com.sovrium.design-system`, which is exactly what DTCG reserves `$extensions` for.

**What the export leaves out of the token tree.** Some values have no faithful DTCG form, and a malformed token is worse than an absent one because a tool would act on it. Those keep their raw text under `$extensions`: `design.elevation.*`, because DTCG shadows are decomposed into colour, offsets, blur and spread and a raw CSS `box-shadow` cannot be parsed back into those reliably; and a spacing value the dimension type cannot carry.

**One document per colour mode.** DTCG has no scheme concept inside one file, so the dark palette is a second document of the same shape: `?mode=dark` on the endpoint, `--mode dark` with `--format json` on the CLI. Its colour group holds what the app paints in dark mode — a `darkColors` value where you declared one, a brand colour (`primary`, `secondary`, `accent`, `ring`, the chart series) declared only in `colors` kept as it is, and the platform's dark default for the rest — and every other group is identical to the light document. The light document is the default and is unchanged by the parameter.

## Importing tokens back

Design work often continues in a design tool. `sovrium design-system import` brings it back: it reads the token file the tool exported and maps it onto your `design` key, so nobody copies hex values off a panel by hand.

```bash
sovrium design-system import tokens.json --config app.yaml               # what would change; writes nothing
sovrium design-system import tokens.json --config app.yaml --write       # write it, then review the diff in git
sovrium design-system import figma-modes/ --config app.yaml --from figma # one Figma Variables file per mode
```

It reads a Claude Design system in the 0.2.47 format (`tokens.json`, or the project folder holding it), Figma Variables files in the DTCG form Figma imports (one file, or a folder of one file per mode, as the bundle's Figma folder holds them), Tokens Studio and Penpot (a folder of sets with `$themes.json`, or a single file), a Style Dictionary source tree, DTCG (a document, a `*.resolver.json`, or a folder with a `dark` file), and CSS custom properties under `:root` and `.dark` with a Tailwind `@theme` block. The format is detected from the file's shape; a file that matches two formats is refused naming both, and `--from` settles it.

**Only tokens map.** A colour goes to `colors` under its path joined with `-` (a leading `color` group dropped), and the dark value the source states to `darkColors` when it differs from what the app paints in dark, even when it equals the light one. A layered source (a DTCG `dark` file or resolver context, a Tokens Studio dark theme, a `.dark` block) states only what its dark layer says; a Claude Design system or a Figma mode file states every token in every mode. A length goes to `radius`, `spacing` or `breakpoints` when its group says which; a font family under a `font` group to `typeScale.families`; a text style named for a type-scale rung (`h1`, `body`, `caption`, …) to that rung. Everything else is listed as unmapped with the reason, never guessed into a key. A colour written in a space `colors` cannot hold — `oklab()`, `lab()`, `lch()`, `hwb()`, `color()`, or a DTCG colour space other than sRGB and Oklch with no hex — is listed as unmapped too, naming the space, so an import never writes a value the config would refuse. **Components are never imported**: the report counts the ones it found and reads their tokens only. A Claude Design project's components are counted as Claude Design lists them, each name once: a `components/<Name>/` folder holding a `preview.html` or a `README.md`, a single `components/<Name>.html` or `components/<Name>.prompt.md`, a `components/<group>/<Name>/` card, and the names `components/bundle.js` declares; `lib/`, `src/` and a folder of types only are not components.

**A change is a real change.** Each token is compared with what the app already paints, declared or inherited, by value: `10px` and `0.625rem` are the same length at a 16px base, and two colours are the same when their sRGB hex and their opacity are. Radius and spacing are written in `rem`, except a length of 1000px or more, written in `px` as a pill radius is (`9999px`); breakpoints are written in `px`. The import adds and changes keys; it never removes one, and a second `--write` with the same file changes nothing.

**Writing.** Without `--write` (or with `--dry-run`) nothing is written. With it, a YAML or JSON config is patched on its `design` key only — the rest of the file, comments included, is left as it was; the block itself is rewritten, so a comment inside `design:` does not survive. The result is validated before it is written. A TypeScript config is never edited: the whole resulting `design` goes to a `design.json` beside it, and the command prints the two lines to paste:

```ts
import design from './design.json'

export default {
  name: 'my-app',
  design,
}
```

Put the import at the top of the file and replace the inline `design: { … }` block with `design,`. The sidecar already holds your own design merged with the import, so the swap loses nothing. An existing `design.json` is replaced only when it already holds this config's design; any other file of that name is refused rather than overwritten. A `design` that takes any part of itself from another file through `$ref` is not patched in place either: copy the dry-run changes into that file instead. A run with nothing to change writes nothing, and every write goes through a temporary file, so an interrupted one never leaves a half-written config.

The import reads a local file or folder only: a URL is refused, and it makes no network call. It never runs over HTTP or in the console. `--json` prints the report as one document for tooling.

The pages a designer reworked come back the same way, with `--pages`: see [Importing Designed Pages](/en/docs/design-pages-import).
