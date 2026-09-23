# Display Components

> The eleven types that present content rather than list it — empty states, scroll areas, design-token swatches, avatars, term-and-detail lists, marquees, accordions, tabs, list items, a single record field, and the timeline.

Display components present content that is mostly authored rather than fetched: nine of the eleven take no `dataSource` at all. The two that do take one read a single thing rather than a page of rows — `record-field` draws one column of one record, and `timeline` binds only in its Gantt shape. All eleven accept the shared `props` bag plus the `visibility` and `responsive` modules.

```yaml
components:
  - type: empty-state
    emptyTitle: 'No invoices yet'
    emptyDescription: 'Invoices you create will appear here.'
    children:
      - { type: button, content: 'New invoice' }
```

## `empty-state`

A placeholder shown when there is nothing to display.

<!-- sovrium:options type:empty-state -->

The `empty` prefixes are the spelling, not a shorthand for one: write `emptyTitle`, not `title`. An unknown key on a component is dropped rather than refused, so a misspelled one costs you a silently empty box instead of an error. `children` holds optional calls to action below the two.

## `scroll-area`

A scrollable region with custom scrollbars.

<!-- sovrium:options type:scroll-area -->

`orientation` picks the axis — `vertical`, `horizontal` or `both` — and `maxHeight` takes a CSS length. The scrollable content goes in `children`.

## `swatch`

One design token, drawn. A colour token is painted as a chip with its name beneath it; `variant: curve` plots an easing token instead.

Give it the token by **name** — a `--sv-*` custom property, or a step from a design ramp such as `neutral-500`. A literal colour would stop being true the moment the ramp is retuned, and staying true is the whole point of drawing a token rather than describing it.

<!-- sovrium:options type:swatch -->

`label` defaults to the token name itself. Neither `showHex` nor `showOklch` prints unless you ask for it, and each key belonging to one variant is inert under the other rather than refused. `contrastAgainst` names a token this colour is meant to sit against, and adds the contrast ratio with its WCAG grade to the swatch.

```yaml
components:
  - type: swatch
    token: '--sv-color-primary'
    label: 'Primary'
    showHex: true
    contrastAgainst: '--sv-color-background'
  - { type: swatch, variant: curve, token: enter, showValue: true, size: 96 }
```

### `source` — resolved once, or read from the cascade

`literal`, the default, resolves the token once when the page is rendered. It is also the only thing that works for a ramp step: a ramp entry is not emitted as a CSS custom property, so there is nothing in the cascade to read and `cascade` would paint a transparent chip.

`cascade` paints from the custom property itself, so the swatch follows a colour-scheme switch instead of showing the light value frozen under a dark page. Use it for a role token, which is redeclared per scheme.

Which kind a name is cannot be decided from the string — a ramp is an open map — so you say which you meant, and a name with no custom property behind it is reported when the page renders rather than refused at startup.

**The easing plot is a square, and that is deliberate.** `size` is one number rather than a width and a height. Both of a bezier's ordinates are normalised progress — time across, output up — so plotting one in a non-square box scales the two axes differently and draws a curve steeper or flatter than the one your app actually runs. The distortion is invisible, because the drawing still looks like a plausible easing, so the shape refuses to express it rather than carrying a warning about it.

## `avatar`

A person or a record as a small round mark: a picture, initials, or a stack of them.

<!-- sovrium:options type:avatar -->

`size` is `md` (32px) by default, with `sm` at 24px and `lg` at 40px; `shape` is `circle` for people and `square` for a record or an organisation. `alt` defaults to `label`; set it empty for a decorative avatar. Omit `status` to draw no presence dot at all.

```yaml
components:
  - { type: avatar, label: Ada Lovelace, src: /uploads/ada.avif, size: lg, status: online }
  - type: avatar
    label: Maintainers
    max: 3
    items:
      - { label: Ada Lovelace }
      - { label: Grace Hopper }
      - { label: Alan Turing }
      - { label: Katherine Johnson }
```

### The fallback chain is ordered

`src` → `initials` → initials derived from `label` → an empty disc. Each rung exists because the one above it can be absent at **render** time rather than at decode time: a record's photo column is null for most rows, and its name column is not. Binding `src: $record.photo` therefore draws a readable initial rather than a broken image, with no fallback written by hand. Deriving from `label` takes the first letter of each of the first two words — `Ada Lovelace` → `AL`.

### `items` makes it a group

Declaring `items` draws the stack. `src`, `initials`, `alt` and `status` are then read from each item instead of from the component, and the top-level ones are ignored rather than refused — nothing you wrote is lost, it is simply not what a group draws. `label` is the exception: on a group it names the stack for a screen reader, because four overlapping discs are one thing to a reader and four to the DOM.

`max` counts the members that are **hidden**, not the total: six members with `max: 3` reads `A G T +3`.

## `description-list`

Pairs of a term and its detail, as a real `<dl>`.

<!-- sovrium:options type:description-list -->

`layout: rows` is the default and puts the term left of the detail; `stacked` puts it above. `dividers` draws a rule under each row, on by default under `rows` and unread under `stacked`. Each entry of `items` takes `term`, `detail`, and an optional `action` of `{ label, href }` drawn as a link in a third column. `detail` is ordinary text, so `$record.<field>` and `$t:<key>` both resolve in it; an empty `detail` is legal and draws the empty-value placeholder rather than collapsing the row, so a panel of facts keeps its shape when one is missing.

Both layouts emit the same `<dl>` of `<dt>`/`<dd>` pairs, so a screen reader announces each term with its detail either way. That is what a `grid` of `text` components cannot do at any amount of styling, and it is why the reading direction is a property here rather than two separate types.

## `record-field`

One column of a bound record, drawn with that field's own type-aware formatting.

<!-- sovrium:options type:record-field depth=3 -->

It answers a different question from `description-list`: "render this field as the field it is" rather than "lay out these facts as a list". Reach for it inside a record-bound region when the value should carry its field type's formatting — a currency as currency, a relation as a link, a status as its coloured chip.

## `marquee`

A band of children on a continuously scrolling track. Use it to show more items than fit on screen — a row of screenshots, a set of logos — as a demonstration rather than a static grid. The children are duplicated internally so the loop has no visible seam; the duplicate is hidden from assistive technology, so each item is announced once.

<!-- sovrium:options type:marquee -->

`marqueeDirection` defaults to `left`, `marqueeSpeed` is seconds for one full loop (larger is slower), and `marqueeGap` takes a CSS length.

**Give the reader a way to stop it.** Content that moves for more than a few seconds needs to be stoppable. Set `pauseOnHover`, `pauseControl`, or both. `pauseOnHover` covers a pointer **and** keyboard focus — hover alone leaves a keyboard user chasing a link that scrolls out from under them; `pauseControl` covers the visitor who has neither. Visitors who ask their system for reduced motion get no loop at all, and nothing is hidden from them: every item stays reachable and the band stays scrollable by hand.

## `timeline`

A vertical rail of events, in one of two shapes — the `dataSource` decides which.

<!-- sovrium:options type:timeline depth=3 -->

**Without a `dataSource`** it is the structural rail: a marker per authored child, arranged top to bottom. It takes no data and mounts nothing.

```yaml
- type: timeline
  children:
    - { type: text, element: h3, content: Kickoff }
    - { type: text, element: h3, content: Beta }
    - { type: text, element: h3, content: Launch }
```

**With a `dataSource`** it is the record-bound Gantt — bars on a time axis, grouped into swimlanes, zoomable — described with the other record views.

**`children` and `dataSource` are mutually exclusive.** A timeline declaring both is refused at validation. Elsewhere a key belonging to the other shape is simply ignored; here the binding would win and your authored children would vanish from the page with nothing to explain why. Drop `dataSource` to keep the rail, or drop `children` to keep the records.

## `accordion`

Collapsible content sections, each with a summary trigger and a detail panel.

<!-- sovrium:options type:accordion -->

`single` collapses other sections when one opens; `multiple` allows several at once. `defaultOpen` names the item IDs rendered expanded on load, and the items themselves go in `children`.

## `tabs`

A tabbed container. `panels` declares the tab strip and `children` holds the panel bodies, index-aligned with it.

<!-- sovrium:options type:tabs depth=3 -->

Each entry of `panels` takes `label`, plus optional `id`, `description`, `disabled` and `body`. `id` defaults to a slug of the label — supply it explicitly when the label is a `$t:` reference, whose slug comes from the translation key and so does not move with the locale. `description` is associated with the trigger by `aria-describedby` and is never part of its accessible name.

A tab set whose panels all carry a `body` string needs no `children` at all. When a panel's body is a component rather than a string, it goes in `children` at the same index.

**`panels` and `children` must be the same length** when both are present; a different number of each is refused at startup by name. The alignment is positional, so an off-by-one puts the wrong body under every tab after the mistake, and nothing on the page says so. That carries a known limitation, stated rather than designed around: once any panel has a component body, every panel needs a slot, including those whose body would have been a string. An explicit `childIndex` per panel would put the correlation back in the author's hands, which is the thing the refusal exists to take away.

**`tab-panel` is no longer a component type** and there is no alias — a config declaring it is refused at startup with a message naming `tabs.panels[]`. Move each panel's `props.id`, `props.label`, `props.description`, `props.disabled` and `content.body` into an entry of `panels`, and leave its own children in the parent's `children`, in the same order.

### Tabs as an address

`defaultTab` also accepts a `$query.<name>` binding over a query property the page declares. Each tab then has an address of its own:

```yaml
pages:
  - name: Organisation
    path: /organisation
    query:
      tab: { default: summary, enum: [summary, people, activity] }
    components:
      - type: tabs
        defaultTab: $query.tab
        panels:
          - { id: summary, label: Summary, body: 'Headline figures.' }
          - { id: people, label: People, body: 'Who is on the account.' }
```

`/organisation` opens Summary; `/organisation?tab=people` renders the People panel server-side. The URL then follows whichever tab is open, so Back and Forward walk the tabs the reader visited, and a link to one tab opens on that tab. Each trigger is a real link, so a reader without JavaScript — and a search engine — reaches every panel instead of only the default one.

**Only the addressed panel travels in the first response.** The others are fetched when the reader opens them, once each; a fetch that fails falls back to following the link. On a three-panel page that took the served HTML from 384,633 to 151,251 bytes, and the tab strip's own script payload from 233,845 to 427.

The trade is a round trip the first time a reader opens a panel, in exchange for an address and a page that carries only what it shows. **A `defaultTab` naming a tab `id` literally is unchanged**: every panel ships with the page, switching is instant, and it keeps working offline. Bind the address when the panels are substantial and worth linking to on their own; leave the literal when they are small and switching should never wait.

### `layout: fill` — a grid inside a panel

`flow`, the default, gives the tab set its natural height and lets the page scroll. `fill` makes it claim the remaining height of a bounded parent and passes that bound through to the active panel, so a `table` declaring `layout: fill` inside a panel owns its own scroll.

Both keys are needed, and neither substitutes for the other. A table's own `layout: fill` needs an unbroken chain of bounded parents above it, and a tab set is a link in that chain it cannot reach on its own — so a grid in a tab panel stays at its natural height however carefully the page around it is authored, until the tab set says it is part of the chain.

Like the table's own key, this is a contract about behaviour _inside_ a bounded parent and does not create the bound: the tab set still needs an ancestor with a resolved height. It is harmless where it is pointless — a tab set in an ordinary flowing document has no height to claim and degrades to its natural one.

## `list-item`

A single list-item element, used as a building block inside lists and menus. It declares no schema option of its own: `content` and `children` carry what it shows, and `props` the HTML attributes.
