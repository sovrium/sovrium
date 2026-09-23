# The Matrix Grid

> The `matrix` component — two sets of graph nodes crossed into a grid whose cells are glyphs.

The one data component that draws no records. A `matrix` crosses two sets of **graph nodes** into a grid whose cells are glyphs rather than words — a mark that says "create and read, not update, not delete" in one shape you can scan a whole column of. It binds a read endpoint, never a table: where `chart` and `kpi` aggregate records, a matrix reads a graph's nodes and edges and draws the relationships between them.

Reach for it when the question is _which of these reach which of those, and how strongly_ — permissions across roles, features across plans, coverage across teams. Reach for a `table` instead when the cells are values a reader needs to read word by word.

<!-- sovrium:options type:matrix depth=3 -->

Every property is optional. A matrix missing its axes renders its empty state; it does not stop your app booting.

## Binding a graph

A matrix reads two collections that address each other by id, so its binding names both — unlike the single `rowsKey` of an ordinary system source. `endpoint` is required; `nodesKey` and `edgesKey` default to `nodes` and `edges`, and `query` merges static parameters into every request.

Nodes become the axes; edges become the cells. Because the read runs as the visitor, they only ever see the part of the graph they could have read themselves — and a matrix on a page they may not read draws nothing rather than someone else's data.

## The two axes

`rows` and `columns` take the same four keys, so learning one teaches you the other. `kinds` admits node kinds onto the axis, as the endpoint spells them — omit it and every node is admitted. `groupBy` bands the axis into labelled groups, drawn on both axes. `sortBy` orders it, with nodes lacking the field keeping their source order after those that have it, and `sortDirection` is `asc` by default.

Neither axis is the special one. A band wraps the rows or columns it holds rather than captioning them from a distance, so the grouping survives a re-order and reads correctly to a screen reader.

Two details follow, on either axis. Ordering _within_ a band is the axis's own order, so `sortBy` keeps working inside each group rather than being overridden by it, and the bands themselves come in the order their values first appear along the axis. And a node that does not carry the field lands in an **unnamed** band, which draws no caption — so declaring `groupBy` never hides a node, it only leaves one ungrouped.

`kinds`, `groupBy` and `sortBy` name things in **your endpoint's** vocabulary, not Sovrium's. Nothing here is an enum: point a matrix at a different graph and its own node kinds and fields work unchanged.

## Filling a cell

`cell.from` is the collection the cells are read from, defaulting to `edgesKey`. `kind` admits one edge kind; omit it and every edge between an axis pair fills its cell. `glyph` is `quadrant`, `filled` or `ops-label`. `opsField` names the edge field carrying the operation letters the glyph reads — omit it and every filled cell is `filled`. `flag` is `{ field, label }`, one boolean edge field marked on the cell, and both keys are required together.

An intersection with no matching edge still renders as a cell — empty, holding the grid's shape. A row whose cells are all empty is information: it is a thing nothing reaches.

### When the glyph cannot express the cell

`glyph` is one value and a real grid usually needs more than one, because the right mark depends on the **shape of the operations**, not on the row. So `glyph` names the cell's _primary_ rendering, and a cell it cannot express steps down rather than losing what it knows:

1. a cell whose operations the declared glyph can express is drawn in it;
2. a cell it cannot falls back to `ops-label` — the letters are printed rather than dropped, because dropping them would make two different grants look identical;
3. a matching edge carrying **no** operations renders `filled` — connected, with nothing further claimed.

One grid declaring `glyph: quadrant` therefore draws quadrants where the operations have four parts, letters where they do not, and solid marks where there are none. You do not configure that per row; it follows the data.

## Accessibility

A grid of glyphs is not readable by itself, so a matrix always renders an **accessible twin**: a real table beneath the grid with one row per filled cell, naming both ends, the operations and the flag. Nothing switches it off. It is the primary artifact, not a fallback.

`label` decides how the _drawing_ is announced. Set, the grid is one named figure with `role="img"`; omitted, the grid is hidden from assistive technology. The twin renders either way. An unnamed figure announced as a figure is noise, so a matrix with no `label` stays silent and lets the table speak.

`flag.label` is the word the twin uses for a marked cell, and the marked cell's hover text. That is why it is required alongside `flag.field`: the table is where a mark is actually read, and an unnamed mark leaves nothing there to read.

## Rendering

A matrix is drawn on the server. The grid and its twin are in the first response — no hydration, nothing added to the browser bundle, and readable with scripting off. A page can carry one without paying for a chart library.

```yaml
pages:
  - name: Access
    path: /access
    components:
      - type: matrix
        dataSource:
          system: { endpoint: /api/admin/organisation/graph }
        rows:
          kinds: [table, page, form, bucket, agent-resource]
          groupBy: family
        columns:
          kinds: [role, team, open]
          sortBy: level
          sortDirection: desc
        cell:
          kind: grant
          glyph: quadrant
          opsField: ops
          flag: { field: viaOpenRung, label: granted to everyone }
        label: Who can do what to what
        emptyMessage: No grants declared.
```
