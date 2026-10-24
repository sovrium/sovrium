`sovrium design-system --format bundle --pages` hands a designer your pages, drawn as the app draws them. When they come back reworked in Claude Design, Figma or Penpot, `sovrium design-system import --pages` turns the drawing back into the page entries of your config, so nobody rewrites a page by hand to match a picture.

```bash
sovrium design-system import dashboard.figma.json --pages --config app.yaml          # what would change; writes nothing
sovrium design-system import dashboard.figma.json --pages --config app.yaml --write  # write it, then review the diff in git
sovrium design-system import harbour-desk.penpot --pages --config app.yaml --page dashboard --write
sovrium design-system import design-system/ --pages --config app.yaml --from claude-design
```

It reads one tool's file: a Figma page document (`<page>.figma.json`, which the Sovrium Figma plugin reads and writes), a Penpot file (`.penpot`), or a Claude Design canvas project (the folder holding `canvas.json`). The tool is detected from the file. A whole bundle folder holds all three, so it is refused until `--from claude-design`, `--from figma` or `--from penpot` names the one to read. `--page <name>` imports that page only, and every other page is left exactly as it was.

A drawing that cannot be taken as one of your pages is skipped and named, with its reason, and the other pages are imported: a board drawing a page your config does not declare, or a sketch that names no page at all. A Claude Design board names its page on its root, never through a link it draws to another page.

A canvas exported with `--seed`, `--state` or `--prototype` comes back the same way. Every board of a page, its dark, phone or role board included, is that page, so an edit on any of them is an edit of the page; a branch the default board did not draw is never read as a deletion; a seeded value is never read as an edit; and the Prototype board `--prototype=app` writes is never read.

## It rebuilds the tree; it never copies pixels

The import does not trace what the designer drew. It reads the drawing as a tree of tagged nodes, matches each one to the page node it was drawn from, and writes the few properties a design tool may change. Sovrium then draws the page again from the config, which is what keeps the result exact: a value that is not on your token scale, or a layer that is not a component of the kit, is reported and never approximated into the nearest thing that would validate.

Only the drawing is read from the file. The page's tree, its bindings and its rules are worked out again from the config on disk (a Claude Design board may also carry rules you edited, see below), and so is what an unedited export would have drawn, so the import compares the drawing with your config as it is now, never with a stale copy. A drawing imported back with no edit changes nothing and writes zero bytes.

## Matching a drawn node to a page node

1. **By `key`** when the node has one: a key survives any move, including a move you made in the config after the export.
2. **By position** otherwise, and only when the component type is the same. A button drawn where a card used to be is not that card edited: the card is removed and a button added.
3. A drawn node matching nothing is a new node. A page node the drawing no longer holds is removed — but only when the export drew it. A node you added to the config after the export was never in the drawing, so it is kept where it is.
4. A board of a page your config declares that carries no export stamp — a board `--new-pages` turned into a page, for one — is matched by position only while it keeps the page's shape. Once nodes are added to it, removed from it or replaced by another kind of component, they cannot be matched, so the board is refused by name and nothing is written. The same happens to a board written back unchanged after `--new-pages` created its page with some of its nodes refused and left out: the board holds more nodes than the page, and the refusal says so. Export the page again with `sovrium design-system --format bundle --pages` and redraw the edit on the new board, which carries the stamps.

## What comes back

| On a page node                                                                                                                              | Written                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Its place: its order among its siblings, or a move to another parent on the same page                                                       | as a move, its bindings, rules and interactions carried along  |
| Its existence                                                                                                                               | a deletion removes it                                          |
| Its `variant` and `size`                                                                                                                    | as drawn; a badge's drawn tone as its `badgeVariant`           |
| A container's direction, gap, alignment, padding and width, at the base and at each breakpoint, set in its inline style or its `class` list | as the utility class of the token (`gap-6`), on the scale only |
| A colour equal to one of your colour tokens, by value or as its `var(--…)`, and a text size equal to a type step                            | as the token's class: `bg-muted`, `text-primary`, `text-lead`  |
| Its literal text                                                                                                                            | as drawn                                                       |
| Its translated copy (`$t:`)                                                                                                                 | in your default language's entry for that key (see below)      |
| A value a template placement passes as exactly one text input                                                                               | as that placement's `vars.<input>`                             |
| A new node, drawn with a kit component                                                                                                      | added without bindings, and named in the report                |

When a node sets one value in more than one place, the inline `style` wins (the properties panel writes it), then the `class` list, then the `data-kit-layout` the export wrote; the report names each source it overrode. A layout value is on the scale when it is bound to, or measures exactly, a spacing step your `design.spacing` declares. An app that declares no `design.spacing` renders with the default scale (`1` is `0.25rem`, `4` is `1rem`, `6` is `1.5rem`), and a drawn length is read against that one. It is written where the page sets it: the base value in `props.className`, a breakpoint's in `responsive.<bp>.props.className` (or as a `<bp>:` class when that is where the page keeps it). The structure of a page — order, moves, deletions, additions — is read from the drawing at its base width; a drawing at a breakpoint contributes its layout only.

The components a page passes to a template's slots, its `children` and each `slots.<name>`, are the page's own: an edit to one of them is written like an edit anywhere on the page. Only the template's own nodes around them are refused.

A value the template draws as exactly one of its text inputs belongs to the placement, not to the template: a class list that is `$bodyClass`, a heading that is `$heading`. An edit to it is written as `vars.bodyClass` (or `vars.heading`) on that placement, and every other page placing the template keeps its own.

A new collapsible takes its `triggerLabel` from the text drawn on its trigger. One drawn with an empty trigger is refused, since the config would not validate without a label, and the components drawn inside it are still read.

### Translated copy

An edit to text that comes from a `$t:` key rewrites your **default language's** entry for that key in `languages.translations`, and the page keeps the key. Every other language holding the key is listed as needing translation and is never written: a translation is written by someone who reads that language. Nothing is written, and the report says why, when the text holds more than its key, when the default language has no entry for it, or when the config is TypeScript, whose translations are code the import never edits.

## What is kept, whatever the drawing says

| Kept                                                                      | What happens to an edit                                                       |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| A value off the token scale, a colour or a text size no token holds       | reported with the nearest token, never written                                |
| A class or a style the import does not read (`italic`, a border)          | named on its node, never written                                              |
| A layer that is no kit component                                          | refused by its name; the kit components inside it are still read              |
| Text a binding fills (`$record.*`, `$currentUser.*`, `$param.*`)          | refused; the binding stays                                                    |
| The page `path` and `meta`                                                | refused                                                                       |
| Anything else inside a template, a library block or an expanded reference | refused; the placement's own move, removal and `$variable` values are written |
| An island's internals (a bound table's rows, say)                         | not read at all, and listed as such; only its box is                          |

Every edit the import does not carry is named in the report with its reason; none is read as no change. Templates are never imported: the report says so and counts the placements it found.

A Claude Design canvas may be a prototype built over the export. What it adds there — its own markup, handlers and state attributes inside a template or an island — is set aside, and a sample value shown where the export drew a bound value's field name (`[name]`) is no edit, so importing an unedited prototype changes nothing.

## Writing

Without `--write` (or with `--dry-run`) nothing is written, and the command prints each page's changes and everything it refused or kept. With `--write`:

- A **JSON** config gets its changed page entries replaced, and each translation it writes set in `languages.translations`, every other key where it was.
- A **YAML** config gets only the changed page entries rewritten, each on the lines it held under `pages:`, so every line outside them, the comments above each page included, stays byte for byte. Inside a page, an edit of text, variant, size or layout changes only the line holding that value, keeping the page's comments and the quoting you chose; moving, adding or removing a node rewrites that page's entry. A translation it writes changes only the line of that entry; one it cannot find on a line of its own is refused rather than re-laid out.
- A **TypeScript** config is edited in place, one literal at a time: an edited text, variant or layout that is a string or number written in the module that owns the page is rewritten there, and nothing else in the file changes, so a page built from your helpers keeps following them. An edit whose value is computed — a helper's return, an expression, a constant imported from another file — is refused with the file and line where it is computed, and you make it there. A change to the page's structure — a move, an addition, a removal, a class or a value the node did not set — has no literal to rewrite, and is refused whole. `--sidecar` writes the whole changed page to its `<name>.page.json` file beside the config instead, where the export's `pages/page-sidecars.json` says, and when that file is new prints the line to add to the module that owns the page, such as `import dashboard from './dashboard.page.json'`.

Two edits of one translated key drawn two ways are refused, and nothing is written. The whole resulting config is validated before a byte is written, and a write that would fail `sovrium validate` is refused with the validator's finding. A page assembled from another file through `$ref` is not patched in place. A second `--write` with the same drawing changes nothing, and every write goes through a temporary file.

The import reads a local file or folder only: a URL is refused, and it makes no network call. It never runs over HTTP, in the console or as an MCP tool. `--json` prints the report as one document for tooling.

## Round trip through a Claude Design canvas

A Claude Design board carries what a page does as well as how it looks. Each component with a rule carries it as an attribute holding your config's own JSON: `data-sovrium-bind` (the bound text, `$record.title`), `data-sovrium-visible` (its `visibility`), `data-sovrium-source` (its `dataSource`), `data-sovrium-form` (its `formRef`), and `data-sovrium-href` on a button (the page its `navigate` action opens). Edit or add an attribute and the import writes that rule back; the text a bound component draws is a sample and is never read as copy. A rule naming a table, field, form or page your config does not declare is refused by name, and nothing is written. Figma and Penpot files carry no rules.

The canvas also carries `project/SOVRIUM.md`, a guide to what comes back, kept and refused, generated from the same tables the import applies; a note on the canvas points to it. Before handing a canvas back, `--dry-run --json` gives one verdict per board with the nodes it carries, keeps and refuses.

- `--new-pages` imports a board drawing a page your config does not declare as a new page: named after the page its root names (`data-sovrium-page="usage"` is `usage`, whatever the board file is called), at the path its root's `data-sovrium-path` names (else `/usage`), with the access of the page its `data-sovrium-like` names (else your app's default). A `data-sovrium-path` that is no page path, a path one of your pages or another new board already takes, or a `data-sovrium-like` naming a page your config does not declare, is refused naming the board, and nothing is written, in a dry run as with `--write`. The rules drawn on a new node come with it, as on an edited one: a `data-sovrium-bind` is written as the node's text (the sample it draws is never read as copy), and `data-sovrium-visible`, `-source`, `-form` and `-href` as its `visibility`, `dataSource`, `formRef` and `navigate` action. A node whose rule names a table, field, form or page your config does not declare is refused `UNDECLARED_REFERENCE` and left out, and the rest of the page is created. A dry run lists each new page with the nodes it adds. Writing the same canvas back again changes nothing: the board is then read as a drawing of the page it created, node by node at their places, and an edit to a node's text or rules is an edit of that node. A board redrawn since, with a node inserted, removed or reordered, or one whose page was created with nodes refused, no longer matches node by node, so it is refused by name and nothing is written. In a TypeScript config the new page is appended to the `pages` array your config's own module writes, after its last page and in its indentation, nothing else changing; when `pages` is not written there as an array (a helper's return, a spread, an imported constant), the import is refused naming the file and line where `pages` is computed, and `--sidecar` writes the new page to its `<name>.page.json` instead, printing the import line to add to `pages`.
- `--tokens` also reads the canvas's own `ds/<app>/tokens.json`, which the canvas Theme menu edits, and writes a changed colour to your `design`; for a TypeScript config it is reported, not written.
