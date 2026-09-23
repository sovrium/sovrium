# The Graph Drawing

> The `graph` component — nodes laid out in ordered columns or in lanes of chained steps, with the edges running between them.

The other way to read the same graph a `matrix` reads. Where a matrix crosses two sets and draws what sits at each intersection, a graph draws the **connections themselves**. A pair with no edge is a visible empty cell in a matrix; in a graph it is simply nothing.

Reach for it when the question is _how_ something is reached rather than _whether_ it is — a path a reader can follow with a finger, through whatever stands in the middle. Reach for a `matrix` when the answer is a lookup, and for a `chart` when the answer is a quantity: no `chartType` draws nodes and edges, because every one of them plots a value against an axis.

<!-- sovrium:options type:graph depth=3 -->

`layout` is `layered` by default — ordered columns — or `lanes`, one row per chain, and it picks which of `columns` and `lanes` is read. Every property is optional, including the one your `layout` calls for: a graph that declares `layered` and no `columns` renders its empty state rather than stopping your app booting.

Declaring **both** `columns` and `lanes` is the one combination refused outright, by name, when your app boots. Only one of them can be read, so the other would disappear without a trace: you would have written a full three-column partition, looked at a page that seems entirely correct, and had nothing anywhere point at why your columns were not on it.

## Binding a graph

The same binding a `matrix` takes, for the same reason: a graph is two collections that address each other by id. `endpoint` is required; `nodesKey` and `edgesKey` default to `nodes` and `edges`, and `query` merges static parameters into every request. Because the read runs as the visitor, they only ever see the part of the graph they could have read themselves.

## How a node is drawn

Two things about a node are legible before its name is: its **shape** and its **weight**. Neither is yours to configure, and both come from the endpoint — so this holds whichever layout placed the node.

Shape carries the **kind**. Shapes are assigned per drawing, in the order the kinds first appear, which is the whole reason `legend` exists: the built-in organisation graph alone emits twelve node kinds, and twelve shapes are not learnable from the figure on their own.

Weight carries the **state**. A node your endpoint reports as `paused` is drawn dashed, one reported `disabled` is drawn muted, and anything else is drawn at rest. Colour is part of neither — kind is shape, state is weight, and colour stays with your theme's own tokens. `paused` and `disabled` are your **endpoint's** words, exactly as the values in `kinds` are, and a state Sovrium does not recognise is drawn at rest rather than being an error.

**A node reporting no state is not a node reporting `active`.** An endpoint that can report state emits `active` explicitly, and omits the key entirely when the source it would have read was unavailable. A node drawn at rest therefore means _this read could not tell_, which is not the same as _this thing is running_.

## The columns

`columns` is an **ordered partition**. Each entry names the node kinds it admits, every node is placed into the first column that admits it, and the array's order is the drawing's order from left to right — which is why this is a list rather than a pair of named axes.

`kinds` and `label` are both required on a column: `kinds` admits node kinds as the endpoint spells them, and `label` is the heading and the group name in the accessible twin. `groupBy` bands the column into labelled groups, `sortBy` orders it, and `sortDirection` is `asc` by default.

The two are required **together** because they are the two halves of a named partition. A column with no `kinds` would admit everything and draw every node a second time, connected to itself; a column with no `label` would leave an unnamed group in the table beneath. Naming a column after the kinds it admits is the tempting alternative and it is worse: `person, agent` is your endpoint's vocabulary, where `Principals` is the word you meant.

**A label may be a translation key.** `$t:graph.principals` works in any label you author on a graph or a matrix — a column's, a lane's, one of its stations', or a matrix `flag.label` — and resolves in the page's active language. It is resolved on the server, before the drawing and its accessible twin are composed, so the two never disagree about which language they are in.

Declare `sortDirection` even when the endpoint already returns the order you want. A column drawn in whatever order the response happened to arrive in reads correctly right up until the endpoint changes, and nothing will tell you when that was.

**An edge is drawn if and only if both its endpoints are.** That single rule is the entire edge filter: point the columns at the node kinds you want and the edges follow, so a graph whose columns admit no automation node draws no automation step without your having said so. There is no separate edge list to keep in step with the columns, and therefore no way for the two to disagree.

## The lanes

Set `layout: lanes` and the drawing changes shape. Instead of partitioning every node across columns, you name **one kind of node that starts a chain** — an automation, a pipeline, a run — and each one gets a row of its own: the node on the left, then the steps leading out of it, running to the right.

`lanes.kinds` and `lanes.label` are required, as is `stations`, itself `{ kinds, label }` with both required — the chain drawn along each lane. `sortBy` orders the **lanes** top to bottom, and without it they arrive in the endpoint's order.

```yaml
- type: graph
  dataSource:
    system: { endpoint: /api/admin/organisation/graph }
  layout: lanes
  lanes:
    kinds: [automation]
    label: Mechanism
    sortBy: label
    stations:
      kinds: [step]
      label: Steps, in order
  selection: { mode: single, reach: downstream }
  label: What each automation does, in order
```

**There is deliberately no `sortBy` for the steps.** A lane's steps are already in order, because the edges say so: the endpoint runs an edge from the lane node to its first step and one from each step to the next, and walking that chain forward _is_ reading the order. A sort key for the steps would hand you a second, independent answer to a question the graph has already answered — and sooner or later the two would disagree, leaving a drawing that has to pick one and a configuration that looks correct either way.

The walk names no edge kind either, for the same reason the edge rule names none: the only edges that can arrive at a step are the ones running along a chain. Pointing `stations.kinds` at your endpoint's step nodes is the whole of the filtering.

## Selecting a node

`selection.mode` is required and takes `single` — one node at a time. `reach` is `downstream` by default, or `upstream`, or `both`.

With `selection` declared, every node is focusable in reading order and `Enter` or `Space` selects the focused one. Selecting lights the **reach set** — everything the selection reaches, walking the edges in the `reach` direction — and dims everything else. `downstream` answers _what does this reach_, `upstream` answers _what reaches this_, and `both` is the whole neighbourhood. Omit `selection` and the drawing is a static figure: nothing takes a tab stop and nothing is ever marked.

`publishes` takes the same `{ bindTo, param }` a `select` takes: the selected node's id is published on the named channel under `param`, and any data source bound to that channel merges it into its next request. Only the id crosses — the reach highlight is the drawing's own state, and a subscriber has no use for it.

## Accessibility and rendering

The same contract as a matrix, for the same reason. A graph always renders an **accessible twin** — a real table listing every node drawn, its kind, the column or lane it sits in, and the nodes it reaches. Nothing switches it off. Under `lanes` that last column earns its place twice over: because each step's edge runs to the next one, the nodes a step reaches **are** the rest of its chain, so the table states the running order in words without anyone having to see a line.

`label` set makes the drawing one named figure with `role="img"`; omitted, the drawing is hidden from assistive technology. The twin renders either way. `legend` draws the key **inside** the drawing, so it is hidden exactly when the drawing is — a key to a figure nobody is being shown is noise, and the twin names every kind in words anyway.

Here a graph and a matrix differ, and it is worth knowing which half you are paying for. A matrix is drawn entirely on the server. A graph's **drawing** is a lazy island, because selecting a node is something that happens after the page has arrived. Its **accessible twin, its empty state and its degraded notice are all server-rendered**, in the first response, exactly as a matrix's are. A reader with scripting off still receives the table and every fact in it; what they do not receive is the ability to select.
