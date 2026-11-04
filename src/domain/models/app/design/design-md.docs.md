# DESIGN.md for Design Agents

Design agents read a `DESIGN.md` at the root of a project to stay on its design system: YAML front matter holding the tokens, then eight sections with fixed headings. `sovrium design-system --format design-md` writes that file from your config, so an agent asked to rework a page starts from the colours, type and radii the app really paints, on shadcn/ui, instead of inventing a new look.

```bash
sovrium design-system app.yaml --format design-md                      # print it
sovrium design-system app.yaml --format design-md --output DESIGN.md   # write it and its records
```

The default `sovrium design-system` brief is a different file, written for a model writing copy and pages; keep both if you use both, under different names.

## What the file holds

**The front matter** has exactly seven keys:

| Key           | What Sovrium writes                                                                                          |
| ------------- | ------------------------------------------------------------------------------------------------------------ |
| `name`        | the app's `name`                                                                                             |
| `description` | the app's `description`, or a sentence naming the app                                                        |
| `colors`      | every colour the app paints in the light scheme, under its token name (`primary`, `background`, `signature`) |
| `typography`  | the type rungs, named by role (below)                                                                        |
| `rounded`     | the radius ladder, `none` to `full`                                                                          |
| `spacing`     | the spacing steps                                                                                            |
| `components`  | the shadcn/ui components drawn from those tokens: `button-primary`, `card`, `input` and the like             |

A component uses only `backgroundColor`, `textColor`, `typography`, `rounded`, `padding`, `size`, `height` and `width`, and names tokens by reference: `backgroundColor: "{colors.primary}"`.

**Type rungs are named by role.** The format calls text roles `display`, `headline`, `title`, `body` and `label`; Sovrium names its rungs after the HTML they style:

| Role       | Rung      |
| ---------- | --------- |
| `display`  | `display` |
| `headline` | `h1`      |
| `title`    | `h2`      |
| `body`     | `body`    |
| `label`    | `caption` |

Every other rung you declare under `design.typeScale.steps` keeps its own name (`lead`, `h3`, `overline`). Only the rungs you declare are written, and a role names a face only when its rung sets `font`: the faces the app is set in are described in the sidecar. An app declaring no rung has an empty `typography`, so no size or face the platform chose is written as yours.

**The body** has the eight sections in their fixed order: Overview, Colors, Typography, Layout, Elevation & Depth, Shapes, Components, Do's and Don'ts. The last one says how this design changes: in the `design` key, in `design.components` for a component everywhere it appears, and in a component's `classes` or `className` for one place. Never by a CSS or HTML file, a new visual world, or a value pasted into a page.

## The sidecar

The front matter has one value per colour and no place for shadows, motion or breakpoints, so `.impeccable/design.json` is written beside the file. It holds, for every colour, the value painted under `.dark` and whether your config declared it or the platform supplied it (`declared` or `inherited`, with the config key for a declared one); which rung each renamed type role came from, and the faces the app is set in; the shadow ladder, durations, easings and breakpoints; and one small drawing per component that a design tool can render on its own. Its one date is the Unix epoch, so it changes only when the design does.

## The records beside it

With `--output`, three more things are written next to the file, each only when it does not exist yet, because each is meant to be completed by hand:

- **One surface brief per zone**, `.impeccable/surfaces/<slug>.md`, naming the files that zone's pages live in (the first one gives the slug: `config/pages/dashboard.yaml` becomes `config-pages-dashboard-yaml`) and its **Mode**: `Operate` for a screen people work in, `Read` for documentation, `Persuade` for a page meant to convince, `Experience` for a showcase. The Mode is read from the zone's name first (`product`, `admin`, `dashboard`, `settings` are Operate; `docs`, `help`, `guides`, `blog` are Read; `gallery`, `portfolio` are Experience; `marketing`, `landing`, `home`, `pricing` are Persuade), then from its pattern (`/app/*`, `/admin/*`, `/settings` are Operate; `/docs/*`, `/help/*`, `/blog/*` are Read). When neither says, the brief says the Mode was not inferred and asks for one. Zones whose pages share one file get no brief, and the command names them: split the pages into their own files with `$ref` to get one.
- **`PRODUCT.md`**, the product record a design agent reads first: the platform, the stack, the purpose from your `description`, the name and voice. What the config cannot say, who the users are and what evidence exists, is marked as not recorded rather than guessed.

Zones are declared under `design.zones`; see [Design System](/en/docs/design).

## Regenerating it

Run the same command again whenever the `design` key changes, by hand, in a pre-commit hook or in CI. The output depends only on the config: the same config gives the same bytes, with no clock, version or machine path in either file.

The file is generated, so write by hand only inside its narrative blocks. Each section ends with one, empty when written:

```markdown
<!-- sovrium:narrative:begin section="colors" -->

### Roles

- **Signature** marks one accent per viewport, never a fill.

<!-- sovrium:narrative:end -->
```

Text inside a block survives the next export; text anywhere else is replaced. A `DESIGN.md` the command did not write, one without its generated marker comment under the front matter, is never overwritten unless you pass `--force`. `--mode` and `--pages` are refused with this format, as with the brief.

## In the bundle

`--format bundle` carries the same file and its sidecar under `adapters/design-md/`, byte for byte what `--format design-md` prints. It carries no brief and no `PRODUCT.md`, because those name the files of your project. Copy the folder to the root of a project to hand it to an agent.
