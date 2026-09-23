# Layout Components

> Structural page components — container, flex, grid, card and split-pane. The sidebar has its own page.

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

`element` chooses the rendered tag — `div` by default, or `section`, `main`, `aside`, `nav`, `header`, `footer`, `article`. `content` renders when there are no `children`. `repeat: { record: <field> }` renders `children` once per element of an array the bound record already carries; it is supported inside a record-bound drawer's `children` and refused anywhere else.

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

A bordered, padded surface for grouping related content — prestyled with background, border, radius, shadow and padding. A `props.className` you supply is appended last, so it wins the Tailwind cascade and can tighten the defaults.

<!-- sovrium:options type:card -->

### `variant` — three cards that do one extra job

Omit `variant` and you get the ordinary raised card. Each of the three named modes is a card that also does one specific thing, and each was its own component type until they were folded in here.

| `variant`  | What it adds                                                                                                  |
| ---------- | ------------------------------------------------------------------------------------------------------------- |
| `bubble`   | A tail, for a message in a conversation. Painted on the info-toned surface with the tail-side corner squared. |
| `specimen` | A stage around the children, so a drawn component and its caption read as one unit.                           |
| `scoped`   | A design boundary — the card emits the scope marker and holds its children inside it.                         |

`variant` is the card's rendering **mode**, not its paint. That is why omitting it leaves an ordinary card rather than an unstyled one, and it is the same axis `badge` carries: a mode changes what a component draws, where a style changes how the same drawing is painted. Keys belonging to one mode are **inert** under the others rather than refused — a `side` on a `specimen` card decodes cleanly and does nothing.

`variant: bubble` takes `content` or `children` for the message, and `side` for the tail: `left` is the sender and the default, `right` the receiver.

```yaml
components:
  - { type: card, variant: bubble, content: 'Can you send the invoice over?' }
  - { type: card, variant: bubble, side: right, content: 'On its way.' }
```

**`speech-bubble` is now `card` with `variant: bubble`.** It is no longer a component type and there is no alias — a config still declaring it is refused at startup with a message pointing here. It was a card with a tail and nothing else, so the tail became a variant: `content`, `children` and `side` carry over unchanged.

`variant: specimen` wraps the children in a stage element, so the drawing is one addressable thing next to whatever caption sits beside it. Anything in `props` passes through untouched, which is how a style-guide page marks up what is being shown without the engine needing to know.

`variant: scoped` makes the card a design boundary: it carries the scope marker and its children render **inside** it, so the styles keying on that scope reach them and nothing else on the page. Use it when one page has to show two design systems at once.

## `split-pane`

Two resizable regions separated by a draggable divider. The first two `children` become the panes.

<!-- sovrium:options type:split-pane -->

`orientation` is `horizontal` — side by side — by default, or `vertical` for stacked. `defaultRatio` is the fraction of the container the first pane starts at, between 0 and 1, defaulting to `0.5`. `minSize` and `maxSize` bound how far the first pane may be dragged, in pixels.
