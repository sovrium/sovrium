# Navigation Components

> The seven types that move a reader around — navigation-menu, dropdown-menu, context-menu, menubar, breadcrumb, command and pagination.

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

A top-level navigation bar supporting nested items and mega-menu layouts. Reference: shadcn/ui Navigation Menu. A top-level entry takes a `muted` ground on hover and while its panel is open. An entry with `children` is a button that discloses a panel of links (`aria-expanded` tells a screen reader whether it is open); it is not a menu, so its rows are links a reader follows like any other, and Escape closes the panel. Without `openOnHover` a panel opens on a click; with it, also when the pointer rests on the entry.

<!-- sovrium:options type:navigation-menu depth=3 -->

Each nav item takes `label`, `href` (omitted on a parent carrying `children`), `description` for the second line in a mega-menu, `icon`, `target` and `rel`, and `children` for a sub-menu.

## `dropdown-menu`

A menu that opens from a trigger button, with optional nested sub-menus. Reference: shadcn/ui Dropdown Menu. Its panel paints the `popover` colour (`design.colors.popover`) and draws a faint ring around its edge rather than a border; a `separator` row is a hairline in the `border` colour, and a row under the pointer or the keyboard takes the `accent` colour — a `destructive` row a light tint of `destructive`.

<!-- sovrium:options type:dropdown-menu depth=3 -->

`triggerLabel` defaults to `Menu` and stays the button's accessible name even when `children` supply what is visible. `children` are drawn INSIDE the trigger, for a richer affordance than a word — an avatar over a name and an email, say; the menu itself is `menuItems`, so children can only be the trigger.

### Item actions

A menu item's `action` runs when the item is picked, as it would from a button: `navigate` follows its path (an `http(s)` address opens in a new tab), `auth` with `method: logout` signs the reader out, `toast` shows its message, `automation` presses the named manual automation through the same page rule a button on the page answers to, and `fetch` sends its request and shows its `onSuccess` or `onError` toast. An automation item with `await: true` waits for the run and shows `onError` when it failed.

```yaml
menuItems:
  - { label: Export orders, action: { type: automation, name: export-orders } }
  - label: Check for new orders
    action:
      {
        type: fetch,
        method: GET,
        url: /api/tables/orders/records,
        onSuccess: { type: toast, message: Orders are up to date },
      }
```

### Toggle items

A menu item may hold a state instead of performing an action. Give it `toggle: checked` or `toggle: unchecked` and it renders as a two-state row — label on the left, switch on the right — that a reader can flip without the menu closing.

```yaml
menuItems:
  - { label: Compact rows, toggle: unchecked }
  - { label: Show archived, icon: archive, toggle: checked }
```

The value is where the switch **starts**, not a binding: the state lives in the reader's browser and nothing is written when they flip it. A toggle row does not run an `action`: one declared beside `toggle` is ignored, so flipping the switch never navigates, submits or calls an automation. `toggle` is inert on a `separator` row — the divider wins.

Rows that share a `radioGroup` name, one after the other, are the radio items of one group: the row whose `toggle` is `checked` starts checked, and choosing another moves the check while the menu stays open. Like a toggle, the choice is a starting position held in the reader's browser. A row with `heading: true` draws its `label` as a group heading above the rows that follow; it is not a menu item, and the keyboard passes over it. Both apply to a `dropdown-menu`, a `context-menu` and a `menubar` alike.

```yaml
menuItems:
  - { label: Row density, heading: true }
  - { label: Compact, radioGroup: density }
  - { label: Comfortable, radioGroup: density, toggle: checked }
  - { separator: true }
  - { label: Export as CSV, icon: download }
```

## `context-menu`

A right-click menu, anchored to the pointer position rather than to a trigger button. Reference: shadcn/ui Context Menu. Its items are the same shape as a dropdown's, and its panel is drawn like one.

<!-- sovrium:options type:context-menu depth=3 -->

`children` is the element the menu is attached to.

## `menubar`

A horizontal application menu bar — File, Edit, View — each top-level entry opening a menu of the same item shape. Reference: shadcn/ui Menubar. The bar itself is outlined in the `border` colour; the menus it opens are drawn like a dropdown's. From the keyboard, ArrowRight and ArrowLeft move between its menus, wrapping at either end; with a menu open, they open the neighbouring menu instead.

<!-- sovrium:options type:menubar depth=3 -->

## `breadcrumb`

A trail of navigation segments. Reference: shadcn/ui Breadcrumb. The trail is drawn in the `muted-foreground` colour, a link lifts to `foreground` on hover, and the current page is `foreground`. Two choices differ from shadcn/ui: the separator is your `separator` string rather than a chevron, and the current crumb is marked `aria-current="page"` without being announced as a disabled link.

<!-- sovrium:options type:breadcrumb depth=3 -->

`separator` defaults to `/`. Each authored item takes `label`, `href` (omitted on the current-page item) and an optional `icon`. `maxItems` (at least 3) shortens a long trail: the first crumb stays, an ellipsis named "More" stands for the middle ones, and the last `maxItems - 1` follow it. With `collapse: menu` the ellipsis is a button opening a menu of the collapsed crumbs, each going where its crumb goes; `ellipsis`, the default, only marks them.

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

### A catch-all page

On a page whose path ends in a catch-all segment, such as `/templates/:path*`, everything the catch-all captures is one value, not a set of folders. The trail gives it one crumb, named after its last segment and marked as the current page: `/templates/emails/welcome/body.html` renders **Templates › body.html**, with no crumb for `emails` or `welcome`. `labels` and `unlinked` apply only to the segments before the catch-all; a captured segment is shown as it appears in the URL, even when it shares a name with a labelled one. `currentLabel` still names that last crumb when set, and a request that captures nothing ends the trail at the last segment before the catch-all.

## `command`

The keyboard-first way into everything a page can reach: one overlay, one input, results from the sources the page declares. Reference: shadcn/ui Command. It was named `command-palette`; a config still writing `type: command-palette` is refused with a message naming `command`, and renaming the `type` is the whole migration.

The palette's "Go to" actions list only the pages the visitor may open. An anonymous visitor is offered pages with no `access`, or an `access` open to everyone; a signed-in reader is also offered the pages that require a session and those whose roles include theirs. A page the visitor cannot open is never named in the palette or in the page that carries it. That holds for a list you write yourself in the palette's `props.pages` too: your list is the set of candidates, and an entry pointing at a page the visitor may not open is dropped for that visitor.

<!-- sovrium:options type:command depth=3 -->

`groups` replaces the built-in quick actions with your own commands: each group has a `label` and its `items`, and each item a `label`, an optional `icon`, an optional `shortcut` drawn as one keycap per key (`['G', 'I']`), and either an `href` or an `action` (`toast` or `navigate`). Typing narrows the items across groups and hides a group left with no match; choosing an item closes the command, then goes where it points or runs its action. In search mode (`search`), `groups` is not used.

## `pagination`

Page-navigation controls for a paginated list or table. Reference: shadcn/ui Pagination. The row is centred; the current page is an outlined square button and the others are quiet ones, with Previous and Next carrying a chevron (their words fold away on a narrow screen, their names do not). Each page is a button rather than a link, and a gap shows `...`.

<!-- sovrium:options type:pagination -->

`totalPages` and `currentPage` state where the reader is, and `siblingCount` decides how many page numbers are drawn on each side of the current one. `paginationVariant: simple` draws only Previous and Next, and `icons` draws them as square icon-only controls that keep their names; `default` draws the full row. `previousLabel` and `nextLabel` rename the two controls, such as "Newer articles" and "Older articles".
