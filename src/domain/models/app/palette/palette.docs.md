# Command Palette

> The ⌘K overlay Sovrium appends to every page: what it searches and offers, the `palette` property that switches it off, and the `command` component that places your own.

Sovrium appends its own command palette to every page and binds ⌘K / Ctrl+K to it. You get it for nothing, with no configuration at all, and it searches every table you may read, plus your own pages. Reach for this article when that default is not what you want: when your app ships its own overlay on the same keystroke, or when one page's palette should search an endpoint you wrote. **Search Overview** has what the default palette returns.

## What it offers

Every palette shows the keys that drive it in a footer under its list (↑ ↓ to move, ↵ to open, Esc to close), in the page language (« naviguer », « ouvrir », « fermer » in French; renamed under `sovrium.commandPalette.hintNavigate`, `hintOpen` and `hintClose`).

Its « create a record » dialogs offer a table's text fields, and only those its reader may read: a field the reader's role may not read is not named in the page at all.

The pages it lists follow the same rule. An anonymous visitor is offered public pages only, and no title or path of a page behind `access` reaches the page; a signed-in reader is offered the gated pages their session may open, and no others. A table the reader may not read is never named, nor are its fields.

## Switching it off app-wide

Appending the palette everywhere becomes a problem exactly once: when your app ships its own ⌘K overlay, because both open on the same keystroke.

<!-- sovrium:options PaletteSchema -->

```yaml
name: my-app
palette: { enabled: false }
```

With `enabled: false` no palette is rendered and no global keybinding is registered, leaving the keystroke free. Leave the block out entirely unless you are opting out.

## Placing one yourself

Appending it everywhere and switching it off app-wide are two coarse states, and neither can say _the palette on this page searches my endpoint_. Declaring a `command` component is the third: a page carrying one keeps exactly that palette, and the engine appends nothing on top: two palettes on one keystroke open two overlays.

It renders no visible markup. The overlay is built in the browser on the first ⌘K and cached, so the page carries only a configuration block and its runtime.

<!-- sovrium:options CommandPaletteSearchSchema -->

```yaml
name: my-app
pages:
  - name: Shell
    path: /
    components:
      - type: command
        search:
          endpoint: /api/my-search
          placeholder: Search everything
          kindLabels: { record: Records, form: Forms }
```

Omit `search` and you get the built-in quick actions (go to a page, create a record, toggle dark mode), placed where you put the component rather than appended. Declaring `search` **replaces** them: a mode, not an addition, for the same one-keystroke reason.

The endpoint is one you write. The value must be a path on this instance: anything not starting with `/` is refused, so `sovrium validate` catches a cross-origin value offline instead of the palette querying somewhere else at runtime. It is **not** the engine's own `/api/command-search`, whose response is a different shape.

The palette appends `?q=<term>` (or `&q=` when your path already carries a query string), sends the request with credentials, and expects results **already grouped**:

```json
{
  "query": "acme",
  "groups": [
    {
      "type": "record",
      "results": [
        {
          "type": "record",
          "entityId": "42",
          "title": "Acme Corp",
          "href": "/customers/42",
          "updatedAt": "2026-09-23T08:00:00.000Z"
        }
      ]
    }
  ]
}
```

`title` is the row's text, `href` is where selecting it navigates, and `type` plus `entityId` identify the row. `kindLabels` turns a GROUP's `type` into its heading, so the list reads as nouns rather than tokens. A `type` the map does not name prints as itself, except the kinds the operator console's own search returns (`record`, `submission`, `run`, `user`, `file`, `conversation`, `connection`), which are headed in the page language, as is the kind word beside each of their rows. A `record` row whose `href` points into one of your tables (`…/tables/<name>?record=…`) prints that table's plural label before its title (`Client companies · Heartgold Industries`), so two records of two tables never read alike; every other row carries its kind beside it. Two rows may share an `entityId`: each is told apart by its `href`. On a page with no SPA navigation, selecting a row loads its `href` as a link would. Anything that is not a `200` carrying this shape renders the no-results state. The palette never reports a fetch error to the visitor.

## Related reading

- **Search Overview**: the four places a query runs, and which one the default palette reaches.
- **Search Components**: `search-input` and the `list` result display, the other ways to put a search box on a page.
- **Navigation Components**: the other components that move a reader between pages.
