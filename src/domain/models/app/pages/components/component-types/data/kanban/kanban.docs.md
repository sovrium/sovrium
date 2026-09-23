# Kanban Boards

> The `kanban` component — records grouped into columns by a field value, with drag-and-drop between them — and the colour rules the record views share.

A board places each record in the column its grouping field names, and lets a reader drag it into another.

<!-- sovrium:options type:kanban depth=3 -->

`kanbanGroupBy: { field }` names the field whose values become the columns. `drag` is `{ enabled, persistAction }` — whether cards move, and what saves the move. `persistAction` must be a `crud` action, `{ type: crud, operation: update, table }`: it is the only type a drop runs.

```yaml
tables:
  - name: tasks
    fields:
      - { name: title, type: single-line-text }
      - { name: status, type: single-select, options: [todo, doing, done] }
      - { name: assignee, type: single-line-text }
      - { name: due_date, type: date }
pages:
  - name: Board
    path: /board
    components:
      - type: kanban
        dataSource: { table: tasks }
        kanbanGroupBy: { field: status }
        drag: { enabled: true }
        card:
          children: [{ type: text, content: '$record.title' }]
          footer: [{ field: assignee, format: avatar }, { field: due_date, format: short-date }]
```

The card takes `children` for its body, `coverImage`, `colorField`, `footer` entries of `{ field, format }` — where `format` is `relative-date`, `short-date`, `avatar`, `badge` or `text` — and `onClick`.

**A top-level `colorField` has no effect on a kanban.** It is accepted and then ignored; the board reads `card.colorField`. This is the one place the three record views do not spell the key the same way.

## Swimlanes — the second axis

`kanbanGroupBy` places a card horizontally; `swimlanes` places it vertically. Declaring both turns the board into a grid, with each card at the intersection of its two field values — `status` across, `team` down.

`swimlanes.field` is required. `showEmpty` draws a declared lane option that holds no records, and is `true` by default, matching the column axis. `collapsed` names the lane values that open closed — collapsing is always available, so this is a starting state rather than a capability.

Lanes behave exactly as columns do: one lane per declared option of the field, in the field's own option order; a value present in the data but not declared on the field is appended; records whose lane field is empty collect in one `Uncategorized` lane. The lane field is checked against the bound table, so a typo is refused by `sovrium validate` rather than drawing one lane per record.

**Not yet drawn.** The key validates today and the field check runs, but the board still renders a flat column list — the lane axis is unimplemented. A config declaring `swimlanes` is accepted and forward-compatible; it simply does not change the render yet.

## Colouring records by a field

`kanban`, `calendar` and `timeline` each accept a `colorField` naming the field whose value colours the card, event or bar. The three spell it differently, because the key sits wherever each component already keeps its display config: `card.colorField` on a kanban, `colorField` on a calendar, `props.colorField` on a timeline.

**On a kanban it is `card.colorField` and nothing else.** The option table above also lists a top-level `colorField`, which the board decodes and never reads — the resolver looks only inside `card`. Write it there.

The colour comes from the **option colours declared on that field**. Only `single-select`, `multi-select` and `status` carry option declarations, so only those three can supply one:

```yaml
tables:
  - name: tasks
    fields:
      - name: priority
        type: single-select
        options:
          - { value: urgent, color: '#DC2626' }
          - { value: normal, color: '#2563EB' }
```

Text is not left to chance: each surface derives a foreground from the fill — whichever of black or white contrasts more — so a label stays legible against any hue an author picks. A `multi-select` resolves only while a record holds exactly one option; a cell holding two or more matches no single declaration and takes the no-colour path below.

**Declared colours win, and that changed the appearance of existing boards.** `colorField` used to ignore what the field declared and assign a colour from a built-in palette instead. It now reads the declarations, so an app already pointing `colorField` at a field with declared option colours renders those colours in place of the palette hues it showed before.

### When a value declares no colour

The fallback differs per surface, and the difference is deliberate. A `calendar` or a `timeline` takes a hue from a built-in palette, because both surfaces already painted a hue per value and they keep doing so. A `kanban` takes **nothing** — the card stays monochrome, because a kanban card has never invented a hue and colour stays something you opt into.

Where a palette hue is used it is derived from **the value itself**, so a given value always draws the same hue. A timeline previously assigned palette hues in order of first appearance, which meant a bar changed colour as you paged or filtered the records around it.

The fallback applies per _value_, not per field: a field that declares colours on some options and leaves others bare sends only the bare ones down this path.

**`colorField` is not validated.** A misspelled field name, or a field type that has no options, is not an error: the surface takes its no-colour path and nothing reports the typo. The grid's `rowColorField` is the exception — `sovrium validate` checks that one.
