# sovrium design-system: export, import, and the console

The design system is declared in the config and handed over by one generator, so every surface — the brief, the token document, the bundle, the console — says the same thing. Nothing here edits configuration over HTTP: exports are read-only, and the import writes a local file from the command line. Manual: `sovrium docs theming/design`, `sovrium docs admin/design-system-console`.

## Contents

- [Export](#export)
- [The bundle](#the-bundle)
- [Import tokens from a design tool](#import-tokens-from-a-design-tool)
- [Import pages](#import-pages)
- [The console](#the-console)
- [Admin routes](#admin-routes)

## Export

```bash
sovrium design-system app.yaml                                    # the agent brief, markdown, on stdout
sovrium design-system app.yaml --output DESIGN.md                 # committed beside the config
sovrium design-system app.yaml --format json --output tokens.json # a W3C DTCG document, light
sovrium design-system app.yaml --format json --mode dark          # the dark palette, same shape
sovrium design-system app.yaml --format bundle --output design-system
```

- Runs offline: no server, no database. It fits a pre-commit hook or a CI step.
- Refuses a config that fails validation, an unknown `--format`, and `--mode` with anything but `--format json`.
- **Read the brief before any design change.** It lists principles, voice, colour roles and, per colour, the light and the dark value the app paints — the Dark column is what is drawn under `.dark`, inherited values included.
- The DTCG document carries standard token types; principles, voice, roles, imagery and component guidance ride in its extensions, and values with no faithful DTCG form (an elevation's raw shadow) are recorded there with a reason. [S6]

## The bundle

`--format bundle --output <dir>` writes one directory for a design tool or an assistant: the brief, an index to read first, light and dark token files, the theme CSS in shadcn/ui variable names and as a Tailwind `@theme`, a rendered component kit (each type and variant drawn in light and dark, offline), the fonts the kit uses, the same tokens in each design tool's own format, and a manifest with every file's digest. `--force` writes into a non-empty directory.

`--pages` adds the app's pages, drawn as the app draws them, so a designer starts from the real screens; `--seed <dir>` draws them from seed files, and `--state <page>:<key>=<value>` adds a board per state. Reworking those pages on a canvas and bringing them back is `sovrium-pages`' canvas loop.

A bundle is never accepted back as a bundle: tokens come back through `import`.

## Import tokens from a design tool

```bash
sovrium design-system import tokens.json --config app.yaml          # the change; writes nothing
sovrium design-system import tokens.json --config app.yaml --write  # write it, then review the diff
sovrium design-system import figma-modes/ --config app.yaml --from figma
```

- Reads a Claude Design system, Figma Variables, Tokens Studio, Penpot, Style Dictionary, DTCG, or CSS custom properties with a Tailwind `@theme`. The format is detected from the file's shape; `--from` settles a file matching two.
- **Only tokens map**: colours to `colors` (and `darkColors` where the source's dark value differs from what the app paints), lengths to `radius`, `spacing` or `breakpoints` when their group says which, a font family under a font group to `typeScale.families`, a text style named for a rung to that rung. Everything else is listed as unmapped with its reason, never guessed.
- **Components are never imported**: the report counts them and reads their tokens only.
- A value equal to what the app already paints is not a change. The import adds and changes keys; it never removes one, and a second `--write` with the same file changes nothing.
- A YAML or JSON config is patched on its `design` key only (a comment inside `design:` does not survive). A TypeScript config is never edited: the result goes to a `design.json` beside it and the command prints the two lines to paste. A `design` assembled with `$ref` is written through: each change lands in the partial that holds it, named in the report's `file`.
- Local files only: a URL is refused and no network call is made. `--json` prints the report for tooling.
- After `--write`: `sovrium validate`, then the console in both schemes.

## Import pages

`sovrium design-system import <canvas> --pages --config <config>` reads a reworked page drawing back into `pages`. That loop — what the import carries, keeps and refuses — is `sovrium-pages`; the token side of a canvas comes back through the token import above. Manual: `sovrium docs theming/design-pages-import`.

## The console

`/_admin/design-system` draws the system at the values it renders with. Admin only; `404` to anyone else; read-only.

| Page        | Use it to                                                                                                                                    |
| ----------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Overview    | See what `design` declares against the default, facet by facet, and reach Share and export                                                   |
| Foundations | Read every token at its rendered value, each foreground measured against its ground; switch scheme with the console toggle or `?scheme=dark` |
| Components  | See your own templates at 1280, 768 and 375 px, and which layer each rendered class came from                                                |
| Brand       | Check the logo and its rules, imagery, what each colour is for, and the zone map                                                             |
| Voice       | Read principles, address, tone per moment and per-zone overrides                                                                             |

Components and Brand exist only when the config declares what they draw. Engine component types are not documented here; `sovrium docs components` lists them. The Overview can publish the system behind a revocable link to someone with no login.

## Admin routes

All `GET`, admin-gated, `404` to anyone else; no write verb is answered on any of them.

| Route                           | Hands over                                                    |
| ------------------------------- | ------------------------------------------------------------- |
| `/api/admin/design-system.md`   | The brief the CLI prints                                      |
| `/api/admin/design-system.json` | The DTCG document; `?mode=dark` for the dark palette          |
| `/api/admin/design-system.css`  | The theme stylesheet: light under `:root`, dark under `.dark` |
| `/api/admin/design-system.zip`  | The bundle; `?pages=true` adds the pages                      |

The token override layer every page loads can be dropped by the operator with an environment variable; that lever, and what it costs, is `sovrium-performance`.
