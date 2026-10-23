# Display Components

> The eleven types that present content rather than list it — empty states, scroll areas, design-token swatches, avatars, term-and-detail lists, marquees, accordions, tabs, list items, a single record field, and the timeline.

Display components present content that is mostly authored rather than fetched: nine of the eleven take no `dataSource` at all. The two that do take one read a single thing rather than a page of rows — `record-field` draws one column of one record, and `timeline` binds only in its Gantt shape. All eleven accept the shared `props` bag plus the `visibility` and `responsive` modules.

```yaml
components:
  - type: empty
    emptyTitle: 'No invoices yet'
    emptyDescription: 'Invoices you create will appear here.'
    children:
      - { type: button, content: 'New invoice' }
```

## `empty`

A placeholder shown when there is nothing to display. Reference: shadcn/ui Empty. It was named `empty-state`; a config still writing `type: empty-state` is refused with a message naming `empty`, and renaming the `type` is the whole migration.

<!-- sovrium:options type:empty -->

The `empty` prefixes are the spelling, not a shorthand for one: write `emptyTitle`, not `title`. An unknown key on a component is dropped rather than refused, so a misspelled one costs you a silently empty box instead of an error. `children` holds optional calls to action below the two, in the empty's content area. `emptyIcon` names a Lucide icon drawn above the title, hidden from assistive technology; `emptyMedia: icon`, the default here, frames it in a small tile, and `emptyMedia: default` draws it bare. The title is plain text, not a heading, as in shadcn/ui: an empty state sits anywhere in a page, so it never breaks the outline of the headings around it.

## `scroll-area`

A scrollable region with custom scrollbars. Reference: shadcn/ui Scroll Area.

<!-- sovrium:options type:scroll-area -->

`scrollOrientation` picks the axis — `vertical`, the default, `horizontal` or `both` — and `scrollAreaHeight` takes a CSS length, `400px` when it is left out. The scrollable content goes in `children`.

## `swatch`

One design token, drawn. A colour token is painted as a chip with its name beneath it; `variant: curve` plots an easing token instead.

Give it the token by **name** — a custom property under the name your stylesheet reads it by, such as `--primary`, `--background`, `--muted-foreground`, `--chart-1` or `--sidebar-primary`, or a step from a design ramp such as `neutral-500`. A custom property resolves to the value your `design.colors` gives that role, and to the default palette's value when you give it none. A literal colour would stop being true the moment the ramp is retuned, and staying true is the whole point of drawing a token rather than describing it.

<!-- sovrium:options type:swatch -->

`label` defaults to the token name itself. Neither `showHex` nor `showOklch` prints unless you ask for it, and each key belonging to one variant is inert under the other rather than refused. `contrastAgainst` names a token this colour is meant to sit against, and adds the contrast ratio with its WCAG grade to the swatch.

```yaml
components:
  - type: swatch
    token: '--primary'
    label: 'Primary'
    showHex: true
    contrastAgainst: '--background'
  - { type: swatch, variant: curve, token: enter, showValue: true, size: 96 }
```

### `source` — resolved once, or read from the cascade

`literal`, the default, resolves the token once when the page is rendered. It is also the only thing that works for a ramp step: a ramp entry is not emitted as a CSS custom property, so there is nothing in the cascade to read and `cascade` would paint a transparent chip.

`cascade` paints from the custom property itself, so the swatch follows a colour-scheme switch instead of showing the light value frozen under a dark page. Use it for a role token, which is redeclared per scheme.

Which kind a name is cannot be decided from the string — a ramp is an open map — so you say which you meant, and a name with no custom property behind it is reported when the page renders rather than refused at startup.

**The easing plot is a square, and that is deliberate.** `size` is one number rather than a width and a height. Both of a bezier's ordinates are normalised progress — time across, output up — so plotting one in a non-square box scales the two axes differently and draws a curve steeper or flatter than the one your app actually runs. The distortion is invisible, because the drawing still looks like a plausible easing, so the shape refuses to express it rather than carrying a warning about it.

## `avatar`

A person or a record as a small round mark: a picture, initials, or a stack of them. Reference: shadcn/ui Avatar.

<!-- sovrium:options type:avatar -->

`size` is `default` (32px) by default, with `sm` at 24px and `lg` at 40px — `md` is refused with a message naming `default`; `shape` is `circle` for people and `square` for a record or an organisation. `alt` defaults to `label`; set it empty for a decorative avatar. Omit `status` to draw no presence dot at all. `src: $session.image` draws the signed-in visitor's own profile picture, and their initials when they have none; **Profile Avatars** shows how a page lets them change it.

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

Declaring `items` draws the stack. `src`, `initials`, `alt` and `status` are then read from each item instead of from the component, and the top-level ones are ignored rather than refused — nothing you wrote is lost, it is simply not what a group draws. `label` is the exception: on a group it names the stack for a screen reader, because four overlapping discs are one thing to a reader and four to the DOM. A group can also be read from records: `dataSource` with `userField` draws one person per row (an event's attendances, filtered by the page's record: `dataSource: { table: attendances, filter: [{ field: event, operator: eq, value: $record.id }] }, userField: attendee`), and `users: $record.speakers` draws the people a multi-person `user` field of a collection page's record names. Each person is drawn once, by her name and its initials, with `max` and `+N` as for `items`; a row the reader may not read is neither drawn nor counted, and no name of it reaches the page. Each disc of such a group takes the keyboard focus and names its person in a tooltip on hover and on focus. `items`, `dataSource` and `users` are one choice: two of them, or a `dataSource` without `userField`, are refused when the config loads.

`max` counts the members that are **hidden**, not the total: six members with `max: 3` reads `A G T +3`.

## `description-list`

Pairs of a term and its detail, as a real `<dl>`.

<!-- sovrium:options type:description-list -->

`layout: rows` is the default and puts the term left of the detail; `stacked` puts it above. `dividers` draws a rule under each row, on by default under `rows` and unread under `stacked`. Each entry of `items` takes `term`, `detail`, and an optional `action` of `{ label, href }` drawn as a link beside the detail, inside the row. `detail` is ordinary text, so `$record.<field>` and `$t:<key>` both resolve in it; an empty `detail` is legal and draws the empty-value placeholder rather than collapsing the row, so a panel of facts keeps its shape when one is missing. A text entry may also name a `format` from the vocabulary a grid column takes (`day-relative-time`, `duration`, `short-date`, `bytes`, …): a detail that is one `$record.<field>` reference then reads as the grid cell for that value reads, which is how a value with no field type to format by, such as one read from an endpoint, matches the history beside it.

On a record page, an entry may name a `field` of the bound record instead of a `detail`: the detail is then drawn by the field's type rather than as the stored value — a date in the page language (`3 Nov 2026`), a select or status as its option's label on its chip, a checkbox as Yes or No, a `user` field as the person's name, a `relationship` field as the linked record's display field, a currency field or a formula declaring `format: currency` as an amount in the page language, an empty value as a muted em dash with its row kept, in whatever language the page is in. An entry takes one or the other.

Both layouts emit the same `<dl>` of `<dt>`/`<dd>` pairs, so a screen reader announces each term with its detail either way. That is what a `grid` of `text` components cannot do at any amount of styling, and it is why the reading direction is a property here rather than two separate types. Terms read in small muted text and details in small medium-weight text, with a rule under every row but the last; a missing detail is a muted dash. Reference: no shadcn counterpart; the row action is shadcn/ui Button at its link variant.

## `record-field`

One column of a bound record, drawn with that field's own type-aware formatting.

<!-- sovrium:options type:record-field depth=3 -->

It answers a different question from `description-list`: "render this field as the field it is" rather than "lay out these facts as a list". Reach for it inside a record-bound region when the value should carry its field type's formatting — a currency as currency, a relation as a link, a status as its coloured chip. A rich-text field is drawn as prose, and its elements take classes by part through `classes`, with the names a markdown text takes: `heading1`, `heading2`, `heading3`, `paragraph`, `list`, `listItem`, `table`, `link`, `inlineCode`, `codeBlock`, `quote` and `image`. The record's own timestamps are fields too: a `record-field` naming `createdAt` or `updatedAt` prints when the record was created or last changed, and takes the same `format` a declared date field takes — `short-date`, `long-date`, `datetime` or a relative format. Without a `format` it reads as a date and time, as a declared `created-at` or `updated-at` field does. A `user` field reads as the person's name and a `relationship` field as the linked record's display field, never as the stored id. A `button` field draws its button: only on a record its `visibleWhen` admits, only for a reader the field's read permission admits, and pressing it runs its automation on the page's record, under the same write check as the grid's button.

A value is written in the foreground. An empty one is an em dash in the muted foreground, so a value the record does not hold reads as absent rather than as a gap in the page.

## `marquee`

A band of children on a continuously scrolling track. Use it to show more items than fit on screen — a row of screenshots, a set of logos — as a demonstration rather than a static grid. The children are duplicated internally so the loop has no visible seam; the duplicate is hidden from assistive technology, so each item is announced once.

<!-- sovrium:options type:marquee -->

`marqueeDirection` defaults to `left`, `marqueeSpeed` is seconds for one full loop (larger is slower), and `marqueeGap` takes a CSS length.

**Give the reader a way to stop it.** Content that moves for more than a few seconds needs to be stoppable. Set `pauseOnHover`, `pauseControl`, or both. `pauseOnHover` covers a pointer **and** keyboard focus — hover alone leaves a keyboard user chasing a link that scrolls out from under them; `pauseControl` covers the visitor who has neither; its button reads Pause, then Resume, in the page language (`sovrium.marquee.pause`, `sovrium.marquee.resume`). Visitors who ask their system for reduced motion get no loop at all, and nothing is hidden from them: every item stays reachable and the band stays scrollable by hand.

## `timeline`

A vertical rail of events, in one of two shapes — the `dataSource` decides which.

<!-- sovrium:options type:timeline depth=3 -->

**Without a `dataSource`** it is the structural rail: an ordered list of the authored children, top to bottom, each marked by a dot in the primary colour on a hairline in the border colour. It takes no data and mounts nothing.

```yaml
- type: timeline
  children:
    - { type: text, element: h3, content: Kickoff }
    - { type: text, element: h3, content: Beta }
    - { type: text, element: h3, content: Launch }
```

**With a `dataSource`** it is the record-bound Gantt — bars on a time axis ruled at its `defaultZoom`, grouped into swimlanes — described with the other record views. With `resizable: true` in its `props`, a bar carries a handle at each end for a reader the table lets update and whose field rules let her write that date — no one else gets a handle, and a timeline over a `system` source never has one. Releasing a handle saves the nearest whole day to where it was dropped (a `datetime` keeps its time of day), and an end never crosses its start, so the shortest bar is one day. The change is one ordinary record update, so the table's field rules, automations and webhooks apply; the bar moves at once and goes back if the update is refused. The Gantt sits on the card surface. A bar whose record has no `colorField` is drawn in the primary colour with its label in the primary foreground; a bar coloured by its field keeps that colour, with a label colour chosen to read against it. The today rule is a line in the primary colour with a "Today" badge in the axis row, and the axis dates are written in the muted foreground. There is no shadcn/ui counterpart for either shape: both are drawn in shadcn/ui's colour roles and part names — `timeline`, `timeline-item`, `timeline-marker` and `timeline-connector` on the rail; `timeline`, `timeline-row`, `timeline-bar`, `timeline-axis`, `timeline-today` and `timeline-handle` on the Gantt. A timeline laned by a `user` or a labelled relationship heads each lane with the label, not the stored key.

A reader who may read the table but not a field the timeline names sees the timeline without that field, and the page carries neither its name nor its options: a hidden `colorField` draws every bar uncoloured, a hidden `groupBy` draws the bars without lanes, and a hidden `endField`, `labelField` or `dependencyField` is left out. A timeline whose `startField` she may not read has nothing to place on its axis and is left out of her page, as over a table she may not read.

**`children` and `dataSource` are mutually exclusive.** A timeline declaring both is refused at validation. Elsewhere a key belonging to the other shape is simply ignored; here the binding would win and your authored children would vanish from the page with nothing to explain why. Drop `dataSource` to keep the rail, or drop `children` to keep the records.

## `accordion`

Collapsible content sections, each with a summary trigger and a detail panel. Reference: shadcn/ui Accordion.

<!-- sovrium:options type:accordion -->

`single` collapses other sections when one opens; `multiple` allows several at once. `defaultOpen` names the item IDs rendered expanded on load, and the items themselves go in `children`.

## `tabs`

A tabbed container. Reference: shadcn/ui Tabs. `panels` declares the tab strip and `children` holds the panel bodies, index-aligned with it. `tabsVariant: line` names the list as shadcn/ui's line variant, the triggers underlined on no ground; `default` is what you get by declaring nothing, and both behave the same way under the keyboard.

<!-- sovrium:options type:tabs depth=3 -->

Each entry of `panels` takes `label`, plus optional `id`, `description`, `disabled` and `body`. `id` defaults to a slug of the label — supply it explicitly when the label is a `$t:` reference, whose slug comes from the translation key and so does not move with the locale. `description` is associated with the trigger by `aria-describedby` and is never part of its accessible name.

A tab set whose panels all carry a `body` string needs no `children` at all. When a panel's body is a component rather than a string, it goes in `children` at the same index. **`panels` and `children` must be the same length** when both are present; a different number of each is refused at startup by name. The alignment is positional, so an off-by-one puts the wrong body under every tab after the mistake, and nothing on the page says so. That carries a known limitation, stated rather than designed around: once any panel has a component body, every panel needs a slot, including those whose body would have been a string. An explicit `childIndex` per panel would put the correlation back in the author's hands, which is the thing the refusal exists to take away.

A form placed in a panel works there exactly as it does on the page — whether it embeds a top-level form with `formRef` or is declared in place. It keeps its validation, submits in the background without leaving the page, and runs its richer controls such as the audio recorder, in the panel open on arrival as in one opened later.

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

**Only the addressed panel travels in the first response.** The others are fetched when the reader opens them, once each; a fetch that fails falls back to following the link. On a three-panel page that took the served HTML from 384,633 to 151,251 bytes, and the tab strip's own script payload from 233,845 to 427. The trade is a round trip the first time a reader opens a panel, in exchange for an address and a page that carries only what it shows. **A `defaultTab` naming a tab `id` literally is unchanged**: every panel ships with the page, switching is instant, and it keeps working offline. Bind the address when the panels are substantial and worth linking to on their own; leave the literal when they are small and switching should never wait.

### `layout: fill` — a grid inside a panel

`flow`, the default, gives the tab set its natural height and lets the page scroll. `fill` makes it claim the remaining height of a bounded parent and passes that bound through to the active panel, so a `table` declaring `layout: fill` inside a panel owns its own scroll.

Both keys are needed, and neither substitutes for the other. A table's own `layout: fill` needs an unbroken chain of bounded parents above it, and a tab set is a link in that chain it cannot reach on its own — so a grid in a tab panel stays at its natural height however carefully the page around it is authored, until the tab set says it is part of the chain.

Like the table's own key, this is a contract about behaviour _inside_ a bounded parent and does not create the bound: the tab set still needs an ancestor with a resolved height. It is harmless where it is pointless — a tab set in an ordinary flowing document has no height to claim and degrades to its natural one.

## `item`

A single row element, used as a building block inside lists and menus. Reference: shadcn/ui Item. It was named `list-item`; a config still writing `type: list-item` is refused with a message naming `item`, and renaming the `type` is the whole migration. It follows shadcn/ui's Item anatomy: `media` holds one component drawn first (an `icon`, an `avatar`, an `image`), `title` and `description` fill the content column, `actions` holds the components at the end of the row, and `header` and `footer` hold full-width lines above and below it; `children` join the content column. `itemVariant` is `default`, `outline` (a border) or `muted` (a muted ground), and `itemSize: sm` draws a shorter row; both are named on the row. `props` carries the HTML attributes.
