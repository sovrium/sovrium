# Navigation Components

> The seven types that move a reader around — navigation-menu, dropdown-menu, context-menu, menubar, breadcrumb, command-palette and pagination.

Navigation components carry a reader from one place to another: top-level menus, dropdown and context menus, an application menu bar, a breadcrumb trail, a command palette and pagination controls. All accept the shared `props` bag plus the `visibility` and `responsive` modules.

```yaml
components:
  - type: navigation-menu
    navItems:
      - { label: Home, href: / }
      - label: Products
        children:
          - { label: Catalog, href: /catalog, description: 'Browse everything' }
  - type: breadcrumb
    breadcrumbItems:
      - { label: Home, href: / }
      - { label: Contacts }
```

Two neighbours are documented elsewhere because they belong to another category: `tabs` is a display type, and `toggle`, `toggle-group` and `button-group` are form controls and an interactive type respectively.

## `navigation-menu`

A top-level navigation bar supporting nested items and mega-menu layouts.

<!-- sovrium:options type:navigation-menu depth=3 -->

Each nav item takes `label`, `href` (omitted on a parent carrying `children`), `description` for the second line in a mega-menu, `icon`, `target` and `rel`, and `children` for a sub-menu.

## `dropdown-menu`

A menu that opens from a trigger button, with optional nested sub-menus.

<!-- sovrium:options type:dropdown-menu depth=3 -->

`triggerLabel` defaults to `Menu` and stays the button's accessible name even when `children` supply what is visible. `children` are drawn INSIDE the trigger, for a richer affordance than a word — an avatar over a name and an email, say; the menu itself is `menuItems`, so children can only be the trigger.

### Toggle items

A menu item may hold a state instead of performing an action. Give it `toggle: checked` or `toggle: unchecked` and it renders as a two-state row — label on the left, switch on the right — that a reader can flip without the menu closing.

```yaml
menuItems:
  - { label: Compact rows, toggle: unchecked }
  - { label: Show archived, icon: archive, toggle: checked }
```

The value is where the switch **starts**, not a binding: the state lives in the reader's browser and nothing is written when they flip it. An item that must persist what it toggles carries an `action` as well, like any other item. `toggle` is inert on a `separator` row — the divider wins.

## `context-menu`

A right-click menu, anchored to the pointer position rather than to a trigger button. Its items are the same shape as a dropdown's.

<!-- sovrium:options type:context-menu depth=3 -->

`children` is the element the menu is attached to.

## `menubar`

A horizontal application menu bar — File, Edit, View — each top-level entry opening a menu of the same item shape.

<!-- sovrium:options type:menubar depth=3 -->

## `breadcrumb`

A trail of navigation segments.

<!-- sovrium:options type:breadcrumb depth=3 -->

`separator` defaults to `/`. Each authored item takes `label`, `href` (omitted on the current-page item) and an optional `icon`.

### Deriving the trail from the path

A page's hierarchy is already stated in its `path`, so enumerating it a second time in `breadcrumbItems` means restating it on every page — and a dynamic `:param` route cannot state it at all, because the last segment differs per URL.

`derive: path` reads the request path instead: one crumb per segment, each linking to its own prefix, the last marked as the current page.

```yaml
- type: breadcrumb
  derive: path
  labels:
    data: Data
    tables: Tables
```

At `/data/tables/customers` that renders **Data › Tables › customers**, with `Data` linking to `/data` and `Tables` to `/data/tables`. A segment with no `labels` entry falls back to itself, so the map stays optional rather than exhaustive.

Declaring `breadcrumbItems` and `derive` together is refused at startup — there is no defensible precedence between an authored trail and a derived one. So is `labels` without `derive`, which would silently do nothing.

### The root crumb

A derived trail starts at the first path segment, so it offers no way back to the root — the one destination every trail should have. `home` prepends that crumb, declared once instead of per page:

```yaml
- type: breadcrumb
  derive: path
  home: { label: $app.label }
  labels: { data: Data }
```

Its label accepts a `$t:` key and the `$app.*` variables, so the crumb can print the name of the app serving the page rather than a constant. Its href is deliberately not authorable: it is always the app root, which the renderer resolves per request.

`home` on an enumerated trail is refused at startup, because such a trail already states its own first item.

### A segment with no page

Every derived ancestor links to its own path prefix, and not every prefix is a page. A run page at `/automations/runs/:id` has nothing at `/automations/runs`, so its middle crumb would link to a page that does not exist. `unlinked` names the segments to keep as plain text:

```yaml
- type: breadcrumb
  derive: path
  labels:
    automations: Automations
    runs: Run
  unlinked: [runs]
```

At `/automations/runs/42` that renders **Automations › Run › 42**, with `Automations` linking to `/automations`, `Run` as text with no link, and `42` as the current page. The segment stays in the trail because it still tells the reader where they are; only the dead link goes. Name the segment as it appears in the URL, not its label: `labels` still applies to it. Like `labels`, `unlinked` requires `derive` and is refused at startup without it — on an enumerated trail, leave `href` off the item instead.

### Naming the current page

The last crumb of a derived trail is the page the reader is on, and on a record page its segment is an id. `currentLabel` names that crumb directly — `currentLabel: $record.title` turns `Orders / 42` into `Orders / Acme — spring order` — and, like `labels` and `home`, requires `derive`.

## `command-palette`

The keyboard-first way into everything a page can reach: one overlay, one input, results from the sources the page declares.

The palette's "Go to" actions list only the pages the visitor may open. An anonymous visitor is offered pages with no `access`, or an `access` open to everyone; a signed-in reader is also offered the pages that require a session and those whose roles include theirs. A page the visitor cannot open is never named in the palette or in the page that carries it. That holds for a list you write yourself in the palette's `props.pages` too: your list is the set of candidates, and an entry pointing at a page the visitor may not open is dropped for that visitor.

<!-- sovrium:options type:command-palette depth=3 -->

## `pagination`

Page-navigation controls for a paginated list or table.

<!-- sovrium:options type:pagination -->

`totalPages` and `currentPage` state where the reader is, and `siblingCount` decides how many page numbers are drawn on each side of the current one.
