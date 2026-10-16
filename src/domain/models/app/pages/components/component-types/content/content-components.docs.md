# Content Components

> Text and prose blocks — text and markdown, highlighted code with frames and composed content, keycaps, an auto-generated table of contents, and the search box.

Content components render text. Five of the eleven types in this category carry prose; the other six carry media and have their own page. All of them substitute references in their `content` (`$record.*`, `$vars.*`, `$t:key`) and accept the shared `props` bag plus the `visibility`, `responsive` and `i18n` modules.

```yaml
components:
  - type: text
    element: h1
    content: Getting Started
  - type: text
    content: '$record.body'
    props: { format: markdown }
  - type: kbd
    keys: ['⌘', 'K']
```

## `text`

The primary content component: inline text, a semantic element, or a whole markdown fragment. Headings, paragraphs and quotations are all `text` with a different `element`. Reference: shadcn/ui Typography, which is a page of styles rather than a component: `element` covers the elements it styles.

<!-- sovrium:options type:text -->

`props.format: markdown` renders `content` as sanitised HTML — headings, bold, italic, links, images, nested lists. The sanitiser strips `<script>` tags and event-handler attributes, so record-supplied markdown cannot execute.

Two of the `element` values look like they overlap with a type of their own, and do not:

- `element: code` renders a plain inline `<code>`. It does **not** highlight. For a highlighted block with a language, a frame and a copy button, use the `code` type.
- `element: kbd` renders a single inline `<kbd>` for one key named inside a sentence. For a shortcut written as a sequence of keys, each with its own cap, use the `kbd` type.
- `element: blockquote` renders the quotation tag. There is no separate blockquote type.

## `code`

A standalone, syntax-highlighted block with chrome, a copy button and optional line numbers.

When the **whole** `content` is exactly one token and its value is an object or an array — `$record.fare` on a page bound to one record, or `$leg.stops` inside a named `repeat` — the block prints that value as JSON indented by two spaces, keys in alphabetical order. The value is always text, never markup. A token mixed with any other text keeps the usual rule: an object-valued token is left as its literal `$record.<key>`.

<!-- sovrium:options type:code -->

A framed block takes classes by part through `classes`: `frame` is the frame around the code and its bar, `caption` is the bar naming the file or the command. Painting both in the code theme's own ground makes bar and code read as one panel.

The frame is drawn on the card surface, with rounded corners and a faint ring for its edge. Its bar holds the filename or the terminal marker in small muted monospace, and the copy button, a ghost icon button. A block with no filename, no terminal marker and no copy button draws no bar at all.

Reference: no shadcn counterpart (the code blocks of shadcn/ui's documentation); the copy control is shadcn/ui Button.

### Frames, output and the copy button

A bare block leaves the reader guessing whether it is a file to save or a command to run. The frame answers that, and it is resolved in this order, first match winning:

1. an explicit `codeFrame` — including `none`, which suppresses chrome that would otherwise be inferred;
2. else a `filename` is present, so the frame is `file`;
3. else an `output` is present, so the frame is `terminal` — only a command has output;
4. else the frame is derived from the block's language, so a `ts` block with no other chrome still gets a file bar captioned `app.ts`.

Every block is framed by default, because uniform chrome is the point and an unframed block has nowhere to put its copy button. `codeFrame: none` is the only way to get one. So the common cases need one property, not two:

```yaml
components:
  # A file. `filename` alone gives you the file frame.
  - type: code
    props: { language: yaml }
    filename: hello-world.yaml
    content: |
      name: hello-world
      pages:
        - name: home
          path: /

  # A command and what it prints. `output` alone gives you the terminal frame.
  - type: code
    props: { language: bash }
    content: sovrium init hello-world
    output: |
      Created hello-world.yaml
      Run sovrium start hello-world.yaml to boot it.
```

The copy button copies **the command only**. The printed `output` and the filename header are both excluded, so pasting into a shell runs one command and pasting a named config file yields valid config rather than config preceded by its own name. No prompt glyph is rendered inside the block for the same reason: a decorative `$` would end up on the clipboard. Line numbers are off by default and are never copied.

### Composing a block from an endpoint's rows

`contentFrom` renders one templated line per row of a read endpoint and joins them. The joined string becomes the block's content _before_ the highlight pass, so the result is highlighted and copyable exactly like a hand-written block.

```yaml
components:
  - type: code
    props: { language: http }
    contentFrom:
      endpoint: /api/admin/instance
      rowsKey: tables
      query: { limit: 4 }
      template: 'GET /api/tables/$record.name/records'
      empty: 'GET /api/tables/{table}/records'
```

`endpoint` and `template` are required; `rowsKey` defaults to `items` and `separator` to a newline — declare `", "` for an inline enumeration. The endpoint is fetched on the render path with the caller's own credentials, so a visitor who may not see it gets no rows.

**The template is never rendered on an empty result.** With no `empty` declared the block is simply empty: a leaked `$record` token in a block an operator pastes into a shell is worse than silence. A row value is always rendered as text, never as markup, whatever it begins with, so a template producing an XML or HTML example yields a code block rather than markup.

Four declarations are refused when the config is validated, each because it would mean nothing: `content` beside `contentFrom` (two answers to what the block holds); `children` beside `contentFrom` (children render only when there is no content, so they never would); a `template` with no `$record.` reference (every row would render the same constant); and a `contentFrom` nested inside a row template (the block would be cloned per row, each clone fetching its own binding).

## `kbd`

A key or a chord, drawn as keycaps. Reference: shadcn/ui Kbd.

<!-- sovrium:options type:kbd -->

```yaml
components:
  - { type: kbd, keys: ['⌘', 'K'] }
  - { type: kbd, keys: ['Ctrl', 'Shift', 'P'], separator: '+' }
  - { type: kbd, keys: ['g', 'i'], separator: 'then' }
```

`code` says "this is source"; a keycap says "press this". They are different claims to a reader and different elements to a screen reader — `<kbd>` is the one HTML has for input, and nothing else in the kit emits it. Documenting a shortcut with `code` also inherits the code frame's copy affordance, which offers to put `⌘` on the clipboard.

The chord is an array rather than a string because each cap is its own element — one muted chip per key, as shadcn/ui's `KbdGroup` holds one `Kbd` per key. A string would need a split rule, and every split rule is wrong for some shortcut: `+` is a separator in `Ctrl+C` and a key in `Ctrl++`. `separator` is therefore text **between** the caps, never a cap of its own; it gets no box, which is exactly the distinction a reader has to make at a glance. Omitted, the caps sit adjacent with the design's own gap.

## `toc`

A table of contents generated from the page's heading hierarchy. Clicking a link smooth-scrolls to the heading anchor.

`toc` declares no options of its own: it is configured entirely through the open `props` bag, which the renderer reads. Set `props.sticky: true` to keep it fixed to the viewport on scroll; every other key is passed through as an HTML attribute.

The links read in the muted foreground and turn to the foreground on hover, a deeper heading's link indented under the one above it, like the 'On this page' column of shadcn/ui's documentation. Reference: no shadcn counterpart.

## `search-input`

The search box. It either searches pages or narrows data, and says which: `scope: page` searches the content of your pages, and `publishes: { bindTo, param: q }` sends what the reader types on a shared-filter channel, so every data component subscribed to that channel narrows to the records the full-text search matches, together with the channel's other controls. `debounceMs` waits for the reader to pause before sending, `minQueryLength` sends nothing below that length, and clearing the box takes the search back out. A box declaring neither, or both, is refused at load. `scope: subscribers`, where a sibling named this box's id, was removed in 0.39 and is refused at load, naming `publishes`.

<!-- sovrium:options type:search-input -->

A key belonging to the other role is ignored rather than rejected. The full-text engine itself — indexing, weights, public search — is configured elsewhere; this is the UI building block. Reference: shadcn/ui Input Group, Popover. The box is one bordered group with a search glyph at its start, and under `scope: page` its results open in a list below it; Enter opens the first result and Escape clears the box.

## Markdown content is not a markdown page

A `text` component with `props.format: markdown` renders a _fragment_ inline. To render an entire page from a markdown file, with frontmatter, layout and a table of contents, use the page-level `markdown` property instead.
