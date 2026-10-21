# Sovrium pages — the Figma plugin

A small Figma plugin that draws a Sovrium app's pages in Figma and writes the designer's edits back
as the file the Sovrium CLI reads. It is the Figma half of the pages round trip.

It is registered with Figma (plugin ID `1694357084021040891`) and runs as a development plugin
from this folder. It is not published to the Figma Community.

It does four things, and only these:

| Action     | What it does                                                                                                                                                                                                                                     |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Import** | Reads a page document (`<page>.figma.json`) you pick, and draws it: one board per breakpoint, auto layout on every frame, spacing bound to your existing Figma variables by name, every layer tagged with the page node it was drawn from.       |
| **Export** | Writes every Sovrium page on the current Figma page back as its `<page>.figma.json`, in the same format, export stamp included, and downloads it.                                                                                                |
| **Check**  | Lists the values that are off the spacing scale, naming the nearest token, and the layers that are no kit component — the same verdicts the CLI's import reaches, because the check runs the CLI's own reader. You can select each listed layer. |
| **Select** | Selects the layers the check listed, so you can fix them yourself.                                                                                                                                                                               |

## The rule: it never changes a layer

The plugin builds, tags, exports and reports. It may **highlight** a layer and **name** the nearest
token, but it never changes a layer you drew: it does not snap a value to the scale, rename, move,
resize or rebind anything. Import only ever creates new layers, and refuses to draw a page whose
boards are already on the Figma page. Snapping layers to the scale is deliberately not offered.

It also:

- **talks to nothing** — no Sovrium instance, no Sovrium URL, no network. The manifest allows no
  domain (`networkAccess.allowedDomains: ["none"]`); files come in through the file picker and leave
  as a download;
- **creates no tokens** — the variables come from Figma's own Variables import of the bundle's
  token files; a page that binds a variable the file lacks is refused whole;
- **edits nothing Sovrium-specific** — no binding, data source, visibility rule, translation, path
  or meta ever reaches Figma; they stay in the bundle's node map;
- has no AI and costs nothing.

## Run it from Figma

You need the Figma **desktop** app (development plugins do not load in the browser).

```bash
bun install
bun run build:figma-plugin     # writes figma-plugin/dist/code.js and dist/ui.html
```

In Figma: **Plugins → Development → Import plugin from manifest…**, then pick
`figma-plugin/manifest.json`, once. From then on it runs from **Plugins → Development → Sovrium
pages**, using the built `figma-plugin/dist/code.js` and `dist/ui.html`. Rebuild after every
change; Figma reloads the files on the next run.

## The round trip

1. Export the bundle with its pages: `sovrium design-system --format bundle --pages --output ./bundle`.
2. In Figma, import the bundle's `adapters/figma/light.tokens.json` and `dark.tokens.json` with
   Figma's own Variables import (**Local variables → Import**).
3. Run the plugin, **Import a page**, and pick a file from `bundle/adapters/figma/pages/`.
4. Design. Run **Check** before you hand it back: anything it lists is what the import will refuse or
   report.
5. **Export**, copy the downloaded `<page>.figma.json` over the bundle's own, and read it back:
   `sovrium design-system import ./bundle --pages --from figma --dry-run`, then `--write`.

If the download does not start, the exported text is also shown in the plugin, ready to copy.

## Layout of this folder

| Path                             | Role                                                                                                         |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `manifest.json`                  | The plugin manifest Figma loads.                                                                             |
| `build.ts`                       | Bundles `src/code.ts` and `src/ui.ts` into `dist/` (`bun run build:figma-plugin`).                           |
| `src/code.ts`                    | The sandbox entry: wires the real `figma` global to the dispatcher.                                          |
| `src/ui.ts`, `src/ui.html`       | The UI iframe: the file picker, the download, the check's list.                                              |
| `src/figma-port.ts`              | The part of the Plugin API the plugin uses, as a structural port. The typecheck proves `figma` satisfies it. |
| `src/build-board.ts`             | Import: document → boards.                                                                                   |
| `src/read-board.ts`              | Export: boards → document. Reads only.                                                                       |
| `src/check-board.ts`             | Check: the CLI's reader run over each board. Reads only.                                                     |
| `src/plugin-data.ts`             | What a layer stores (`sovrium` is the contract tag; the rest is the plugin's own bookkeeping).               |
| `src/fake-figma.ts`, `*.test.ts` | A minimal fake of the Plugin API and the unit tests that run against it.                                     |

The document format is not defined here. It is the CLI's contract,
`src/domain/models/api/admin/design-system/adapter-figma-pages.ts`, which the plugin imports and
bundles, so the plugin and the CLI cannot disagree about it. It builds against
`@figma/plugin-typings` 1.142.0, pinned exactly in the root `package.json`.

## Gates

```bash
bun run typecheck:figma-plugin   # the three programs: sandbox, UI, tests
bun test figma-plugin            # unit tests, the round trip and the built bundle in a bare sandbox
```

The repository's own `bun run typecheck` deliberately does not read this folder (the Figma globals
would leak into every `src/` file).

## Verified, and what needs Figma

Verified here, without Figma: the contract round trip (document → layers → the same document), the
designer's edits reaching the document, the check's verdicts matching the CLI's, that export and
check change nothing, and that the built `code.js` loads and runs in a context holding only `figma`,
`__html__` and `console`.

Still to check in a real Figma file, because the fake can only model what the typings state:

- that instance sublayers return their main component's plugin data (the plugin falls back to the
  main layer when they do not, but the fallback rests on the `I<instance>;<layer>` id form);
- that the UI iframe allows the `<a download>` (the copy box is the fallback);
- that Figma's Variables import names the spacing variables `spacing/<step>` with px values, as the
  bundle's token files intend;
- that the sandbox runs the bundle's syntax (`toSorted`, `replaceAll`, class fields) and needs no
  global beyond the `TextEncoder` the plugin provides when missing.

## The plugin ID

Figma keeps a plugin's private data (the `sovrium` tag on every layer, and the plugin's own
bookkeeping) under the plugin's **ID**, `1694357084021040891`, which Figma assigned when the plugin
was registered. A file tagged under one ID cannot be read under another, so **never change the ID**
in `manifest.json`: every file already tagged would lose its tags.
