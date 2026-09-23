# Sidebar Navigation

> The `sidebar` layout component — declarative navigation groups, fetched entries, expanding sections, the current-entry mark, and the icon rail.

A vertical navigation panel, usually paired with a `container` main region to form an app shell. Compose it statically from `children`, or declare its shape with `groups` and let it render as one navigation landmark of real links.

<!-- sovrium:options type:sidebar depth=6 -->

## `groups`

Assembling navigation from `children` means every app writes its own tree of containers, headings and anchors, each with slightly different accessibility. `groups` declares the shape instead.

A group needs at least one of `items` and `source`; declaring neither is refused at startup, because a heading with nothing under it is never what was meant. Declaring **both** is supported and useful — the authored entries come first.

`source` is the same rows-envelope binding a data component uses, plus two projections that turn a row into an entry: `labelKey` names the row key holding the label, and `hrefTemplate` is a path whose `{field}` placeholders are filled from the row.

```yaml
- type: sidebar
  groups:
    - label: Overview
      items:
        - { label: Home, href: /, icon: home }
        - { label: Activity, href: /activity }
    - label: Products
      items:
        - { label: All products, href: /products }
      source:
        endpoint: /api/tables/products/records
        rowsKey: records
        labelKey: name
        hrefTemplate: /products/{name}
```

### Marking the current entry

An entry can say how it recognises itself as the page you are on. The match runs on the server, and the matching entry carries `aria-current="page"` — so "where am I" is answerable by a screen reader, not only by a colour. `activeMatch: exact` is the default and marks when the request path equals `href`; `prefix` marks when it equals `href` or begins with `href/`.

Use `prefix` on a section entry so it stays marked while a visitor is inside it — `/tables` keeps its mark at `/tables/customers`. Do **not** use it on a root entry: `href: /` under prefix matching marks every page in the app.

### Badging an entry

`badge` takes either a literal string — a status word your config can state truthfully, like `Beta` — or `{ endpoint, valuePath }` for a count it cannot. `valuePath` is a dot path into the response, defaulting to `total`.

### Sections inside one landmark

By default a group **with a label** is its own navigation landmark, named by that label. That is right when the groups are unrelated, and wrong when several of them are subdivisions of one navigation — a reader cycling landmarks then meets four "navigation"s where you meant one holding four headings.

`landmark` names the landmark a group belongs to; groups sharing a value are folded into one `nav` carrying it as the accessible name. `headingLevel` renders the group label as a real heading of that level, `2` to `6`, instead of a landmark's name. Declaring neither leaves the group exactly as it rendered before these existed.

```yaml
- type: sidebar
  groups:
    - label: Tables
      landmark: Data
      headingLevel: 2
      items: [{ label: Customers, href: /tables/customers }]
    - label: Files
      landmark: Data
      headingLevel: 2
      items: [{ label: Uploads, href: /files/uploads }]
    - label: Account
      items: [{ label: Settings, href: /settings }]
```

That is two landmarks: one named `Data` holding two headed sections, and one named `Account` by its own label.

Four shapes are refused at startup:

- `headingLevel` without `landmark`. A group that is its own landmark is already named by its label, and a heading repeating it announces the same words twice to the same reader.
- `headingLevel` on a group with no `label`. The heading's text is the label, so this would render an empty heading — a stop heading navigation offers that announces nothing. Reported by position, since a group with no label has no name to quote.
- Groups sharing a landmark that are **not listed together**. The sidebar renders groups in declared order, so a landmark can only wrap an unbroken run of them, and silently reordering them would move entries you placed deliberately.
- Two navigation landmarks sharing an accessible name, including a `landmark` colliding with the label of a group that is its own landmark.

`headingLevel: 1` is refused by the schema: the page's own title is the `h1`, and a sidebar section is never the top heading of the document beside it.

### A group with no label

Omit `label` and the group states no category name at all: it contributes neither a heading nor a landmark, and its entries render straight into the navigation root, above the first named group. A console's landing row is the way back out of every section rather than a section of its own.

Write it as a group rather than as an authored `link` child, for two reasons. Groups render **before** every authored child, so a child lands below the whole navigation and never above it. And everything the row needs is inherited from the navigation root: the shared entry styling, the current-entry mark with its `aria-current`, the rail's row rules, and the tracker that re-marks the current entry after a same-document navigation. A hand-written anchor outside that root gets none of it — in a rail it keeps a full-width label inside a 56px column.

A label-less group may still fetch from a `source` and may still declare a `landmark`. What it may not carry is `headingLevel`.

### Naming a row with attributes

An entry carrying nothing but a label can only be reached _by_ that label — so every assertion, analytics hook and operator runbook is coupled to display copy that translation will move. A props bag gives the row a name that does not move: `items[].props` lands on the entry's own link (or its toggle button, when the entry declares no `href`), `items[].childrenProps` on a disclosure's list element, and `source.itemProps` on each fetched entry, with `{field}` placeholders filled from the row exactly as `hrefTemplate`'s are — and **not** percent-encoded, because it is an attribute rather than a URL.

The renderer computes `href`, `class` / `className`, `aria-current`, `aria-expanded` and `aria-controls` from the entry's own fields and state. Declaring any of them in a props bag is refused at startup, naming both the key and the entry, rather than being dropped in silence, which is what an attribute with two owners otherwise does.

## Expanding an entry

A destination whose contents are themselves navigable — a records page over many tables, a files page over many buckets — otherwise costs a second click and a full page load just to discover what is under it.

A parent that declares an `href` stays a real link to its own page, with a small `button` carrying `aria-expanded` and `aria-controls` beside it. `children` holds authored sub-entries; `source` fetches them, on **first** expand and only once. `defaultExpanded` starts the disclosure open, `expandLabel` and `collapseLabel` name the toggle (`Expand {label}` and `Collapse {label}` by default), and `childrenProps` attributes the list element.

Declaring **both** `children` and `source` is refused at startup: only the fetched list has loading, error and empty states, and an authored one must not inherit them. Declaring `defaultExpanded`, `expandLabel`, `collapseLabel` or `childrenProps` on an entry with neither is refused too — there is nothing to expand.

Fetching on first expand rather than at render keeps the cost proportional: a sidebar of ten disclosures makes ten requests only if the reader opens all ten. A fetched list says which of its three states it is in, with copy you can override on the `source` — `loadingLabel` (`Loading…`), `errorLabel` (`Couldn't load the list.`) and `emptyLabel` (`No items.`).

`expandLabel` and `collapseLabel` must carry `{label}`; one without it is refused at startup, because a fixed string gives every disclosure the same accessible name — which is exactly the "which one is this?" a name exists to answer.

The disclosure holding the current page is open on arrival, resolved on the server. That is independent of `defaultExpanded`: it is the navigation answering "where am I", not a default.

### A parent that goes nowhere

**Omit `href` and the whole row becomes the toggle** — one `button` carrying the icon, the label, any badge and the chevron, with hover treatment and no selected state. `href` is optional only on a **top-level** entry, and only on one declaring `children` or `source`; sub-entries and leaf entries always require one.

Two consequences follow, and both are the point rather than a limitation. The row is never marked as the current page — `aria-current` says "this is the page you are on", and a row that goes nowhere can never be one — so `activeMatch` is **refused** on it. And its accessible name is its own label, read with the state `aria-expanded` already announces, so `expandLabel` and `collapseLabel` are refused for the same reason: on a row whose visible text is its name, a second string would shadow the words on the screen.

An entry with **neither** `href` nor `children` nor `source` is refused at startup, naming the entry and saying which it is missing. Such a row is neither a link nor a control — rendered, unclickable, and legal in every remaining field, which is exactly why nothing but this rule can catch it.

### A third level

A sub-entry may carry `children` of its own — one more level, and the last. Use it when the destination is a single page holding many named parts: a component catalogue under a dozen headed categories, a settings page with a long rail of sections.

The third level is **always open** and carries no toggle. A disclosure inside a disclosure needs an accessible name saying which of two nestings it operates, and there is no brief wording that does. It takes none of the disclosure fields — `defaultExpanded`, `expandLabel`, `collapseLabel` and `source` all stay one level up — and a `childrenProps` declared without `children` is refused at startup. A fetched third level is not expressible either: a list with loading, error and empty states needs a disclosure to host them, which is what this level declines to be.

### Showing an entry only inside its own section

`showWhen` is the one gate in the product that reads the **request path**. Give it a section, and the entry is part of the navigation at that path and under it, and absent everywhere else.

`section` is matched the way `activeMatch: prefix` matches: the request path equals it, or begins with it followed by `/`. So a row scoped to `/design-system/ui-kit` is still there at `/design-system/ui-kit/button` — a reader who drills into an object does not watch the navigation they arrived through disappear. It need not be any entry's own `href`, and it must start with `/`.

A gated entry is **removed from the document**, not hidden. A navigation that ships every row and hides most of them is one whose landmark, tab order and screen-reader reading all disagree with what is on the screen.

`showWhen` is available at any of the three levels. Pair it with a third level unless that list belongs in the chrome of every page — a third level that is always present is a sidebar that has become a site map.

## `trackNavigation`

`aria-current="page"` is resolved on the server, which is right and sufficient for an app whose every navigation is a page load. An app that swaps its content region in place leaves the sidebar mounted and the server's mark frozen on the page the reader has already left — so the one element that answers "where am I" becomes the one element that is wrong.

`trackNavigation: true` re-derives the mark on the client after a same-document navigation. It is opt-in because it costs a client island, and an app doing only full page loads gains nothing from it.

The mark moves on two signals. **`popstate`** — browser back and forward — needs nothing from your app. The other is **`sovrium:navigated`**, the event an in-app swapper announces. Update `window.location` first, then dispatch a `CustomEvent` on `document`:

```ts
history.pushState({}, '', '/products/widgets')
document.dispatchEvent(
  new CustomEvent('sovrium:navigated', { detail: { path: '/products/widgets' } })
)
```

That order is the contract, not a convention: the sidebar reads `window.location` itself, so `detail.path` is informational, and dispatching before the location is updated re-derives the mark onto the page the reader is leaving.

`activeMatch` is re-evaluated by the same rule on the client as on the server, so a `prefix` entry keeps its mark across a drill-in. A disclosure whose section becomes current opens with it — but is never re-opened after the reader has deliberately collapsed it.

## `rail` — an icon rail on a narrow screen

A sidebar wide enough to read costs a laptop roughly a quarter of its width, and the surface beside it is usually the one the reader came for. `rail` keeps the navigation present at that width while giving the column back.

```yaml
- type: sidebar
  rail: { below: xl }
  groups:
    - label: Data
      items:
        - { label: Tables, href: /tables, icon: table }
        - { label: Files, href: /files, icon: folder }
```

`below` is a **strict lower bound**: the rail applies at every width below the named breakpoint, and at it and above the sidebar renders exactly as it does without the key. So a console that wants a rail on a laptop and the full sidebar on a wide desktop names the breakpoint at which the desktop starts — `xl` — not the one at which the laptop does.

The tokens are `responsive`'s: `sm`, `md`, `lg`, `xl`, `2xl`. **`mobile` is refused** rather than accepted and ignored — it is the base rather than a breakpoint, so "below mobile" is the empty range and the rail would never apply, on every page, with nothing logged.

Below the breakpoint the sidebar takes a fixed 56px width, every entry centres its icon in it, and the entry labels, entry badges and group headings stop being painted. Give every entry an `icon`: a row with none is a 56px column of nothing.

**The labels are not removed.** They stay in the document and in the accessibility tree, and each row gains a `title` tooltip so a pointer reader can still name it. An entry whose accessible name changed with the viewport would be a link that resolves by name on a desktop and by nothing on a laptop — every deep link, runbook and test would hold at one width and silently fail at another while the page looked correct in both. Every row also keeps its tab stop and its `aria-current="page"` mark.

**A rail is not a drawer.** It stays present, stays a navigation landmark and stays reachable by keyboard in its declared order. An app that wants the sidebar to _leave_ the layout on a phone and come back behind a button is describing a drawer, which is a different affordance with its own control. The two compose: a sidebar may be a rail from one breakpoint down and hidden behind a drawer from a narrower one, because the drawer is the frame's behaviour and the rail is the navigation's.

Omitting `rail` keeps today's rendering at every width.
