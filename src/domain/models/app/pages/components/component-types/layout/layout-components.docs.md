# Layout Components

> Structural page components — container, flex, grid, card and resizable. The sidebar has its own page.

Layout components arrange the page. They define the visual skeleton — centred containers, flex and grid tracks, cards, resizable panes — and host other components as `children`. Positioning is expressed as Tailwind classes in `props.className`: these components add structure, not styling opinions.

```yaml
components:
  - type: container
    element: section
    props: { className: 'text-center px-6 py-16 lg:py-24' }
    children:
      - { type: text, element: h1, content: Ship internal tools from config }
  - type: container
    element: section
    props: { className: 'max-w-4xl mx-auto px-6' }
    children:
      - type: grid
        props: { className: 'grid-cols-3 gap-6' }
        children:
          - { type: card, children: [{ type: text, content: 'Fast' }] }
```

## `container`

A generic block-level wrapper — the workhorse for constraining width, applying padding and grouping children. It is also the only layout component that accepts a `dataSource`, which makes it the usual way to bind a whole region to a record.

<!-- sovrium:options type:container depth=3 -->

`element` chooses the rendered tag — `div` by default, or `section`, `main`, `aside`, `nav`, `header`, `footer`, `article`. `content` renders when there are no `children`. `repeat: { record: <field> }` renders `children` once per element of an array the bound record already carries; it is supported inside a record-bound drawer's `children` and on a page bound to one record, and refused anywhere else. `repeat.as` names the element, so `$<as>.<key>` reads it while `$record.<key>` keeps reading the bound record, and a second repeat may nest inside a named one.

### The page opener

There is no dedicated banner type. A landing-page opener is a `container` carrying its own padding, with a `text` headline and `button` calls to action as children:

```yaml
- type: container
  element: section
  props: { className: 'text-center max-w-4xl mx-auto p-8 sm:p-12 md:p-16 lg:p-20' }
  children:
    - { type: text, element: h1, content: Ship internal tools from config }
    - { type: text, element: p, content: One config file. A running app. }
    - type: container
      props: { className: 'flex gap-4 justify-center' }
      children:
        - { type: button, content: Start now }
        - { type: button, content: Read the docs }
```

## `flex`

A flexbox container. Direction, gap, alignment and wrapping all come from `props.className` — `flex flex-col`, `gap-4`, `items-center`, `justify-between`. It declares no schema option of its own and accepts `children`, `props`, `responsive` and `visibility`.

## `grid`

A CSS grid container. The simplest form takes fixed column tracks from `props.className`: `grid grid-cols-3`, `gap-6`, `auto-rows-fr`. Children flow into the cells.

When the column count is the thing changing across breakpoints, declare it instead of writing breakpoint-prefixed classes: `props.columns` sets the base count and `props.responsive` overrides it per breakpoint (`sm`, `md`, `lg`).

```yaml
- type: grid
  props:
    className: 'gap-6'
    columns: 1
    responsive: { md: 2, lg: 3 }
  children:
    - { type: card }
```

`grid` declares no schema option either — both keys above live in the open `props` bag. Note that `props.responsive` and the top-level `responsive` module are two different things: the first maps a breakpoint to a **column count**, the second maps a breakpoint to a set of **prop overrides**, and both work on a `grid`.

**`responsive-grid` was merged into `grid`.** It is no longer a component type and there is no alias — a config still declaring `type: responsive-grid` is refused at startup with a message pointing here. The two declared exactly the same fields and `grid` already resolved column counts per breakpoint, so the migration is renaming the `type` and changing nothing else.

## `card`

A surface for grouping related content. Reference: shadcn/ui Card. It paints the `card` colour with a faint ring instead of a border, rounds its corners with `radius-xl`, and spaces and pads its children by 16 px. Its children sit directly inside it, so it pads all four sides itself. A `props.className` you supply is merged last, so it wins every conflict with these defaults.

A card can also be laid out on shadcn/ui's anatomy: `title` and `description` fill its header above the body, `action` (one component, such as a "Change plan" button) sits in the header on the title row and to its right, and `footer` (a list of components) draws a muted band below the body. A card declaring any of them puts its `children` in the body between them. `size: sm` draws a tighter card with a smaller title.

```yaml
- type: card
  title: Team plan
  description: Renews on 1 November 2026
  action: { type: button, variant: outline, size: sm, label: Change plan }
  children:
    - { type: text, element: p, content: 12 of 15 seats in use. }
  footer:
    - { type: button, label: Download last invoice }
```

<!-- sovrium:options type:card -->

### `variant` — two cards that do one extra job

Omit `variant` and you get the ordinary raised card. Each of the two named modes is a card that also does one specific thing, and each was its own component type until they were folded in here.

| `variant`  | What it adds                                                                          |
| ---------- | ------------------------------------------------------------------------------------- |
| `specimen` | A stage around the children, so a drawn component and its caption read as one unit.   |
| `scoped`   | A design boundary — the card emits the scope marker and holds its children inside it. |

`variant` is the card's rendering **mode**, not its paint. That is why omitting it leaves an ordinary card rather than an unstyled one, and it is the same axis `badge` carries: a mode changes what a component draws, where a style changes how the same drawing is painted. Keys belonging to one mode are **inert** under the others rather than refused.

A message in a conversation is its own type, [`bubble`](/en/docs/bubble-component), with `align: start` or `align: end` for its side of the thread. `variant: bubble` and `side` are refused on a `card`, each with a message naming `bubble`.

```yaml
components:
  - { type: bubble, content: 'Can you send the invoice over?' }
  - { type: bubble, align: end, content: 'On its way.' }
```

**`speech-bubble` is now `bubble`.** There is no alias — a config still declaring it is refused at startup with a message naming `bubble`. `content` and `children` carry over unchanged; `side: left` becomes `align: start` and `side: right` becomes `align: end`.

`variant: specimen` wraps the children in a stage element, so the drawing is one addressable thing next to whatever caption sits beside it. Anything in `props` passes through untouched, which is how a style-guide page marks up what is being shown without the engine needing to know.

`variant: scoped` makes the card a design boundary: it carries the scope marker and its children render **inside** it, so the styles keying on that scope reach them and nothing else on the page. Use it when one page has to show two design systems at once.

## `resizable`

Two resizable regions separated by a draggable handle. Reference: shadcn/ui Resizable. It was named `split-pane`; a config still writing `type: split-pane` is refused with a message naming `resizable`, and renaming the `type` is the whole migration. The first two `children` become the panes.

<!-- sovrium:options type:resizable -->

`orientation` is `horizontal` — side by side — by default, or `vertical` for stacked. `defaultRatio` is the fraction of the container the first pane starts at, between 0 and 1, defaulting to `0.5`. `minSize` and `maxSize` bound how far the first pane may be dragged, in pixels.
