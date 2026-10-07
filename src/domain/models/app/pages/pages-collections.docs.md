# Collection & Markdown Pages

> Generate one route per table record with `collection`, render a page body from markdown, and fan a whole directory of markdown files into a navigable section.

Three page properties turn one page definition into many routes, or replace the component tree with prose: `collection` fans out over table records, `markdown` renders a body from a file, and `contentDir` fans out over a directory of files.

## `collection`

A `collection` block generates one route per record. The page's `path` must carry a dynamic segment, and `slugField` names the field whose value fills it. `table` and `slugField` are both required; `filter` limits which records generate a page.

```yaml
name: my-blog
tables:
  - name: posts
    fields:
      - { name: title, type: single-line-text }
      - { name: slug, type: single-line-text }
      - { name: body, type: long-text }
      - { name: published, type: checkbox }
pages:
  - name: Blog Post
    path: /blog/:slug
    collection:
      table: posts
      slugField: slug
      filter:
        - { field: published, operator: eq, value: true }
    rss: { limit: 20 }
    components:
      - { type: text, element: h1, content: '$record.title' }
      - { type: text, content: '$record.body', props: { format: markdown } }
```

The generated record is exposed as `$record.*` to the whole tree, including `meta` — so per-record SEO comes for free. A URL matching no record returns `404`, and so does the URL of a deleted record. The record follows the visitor's own read permissions: a field they may not read resolves to nothing, in the components and in `meta` alike, so its value never reaches the page. A visitor the table's `read` refuses gets `404` for every record, as does a visitor who is not signed in when the table's row-level `read` rule names the signed-in person; a rule naming no one, such as `status = published`, applies to them as to anyone else. A record the row-level `read` rule hides from its visitor — signed in or not — answers exactly as a record that does not exist: the same `404` and the same page, so the answer never tells her the record is there. The `$collection.previous.*` and `$collection.next.*` neighbours follow the same permissions: their unreadable fields resolve to nothing, and a record the visitor may not see is skipped for the nearest one they may.

## `markdown`

<!-- sovrium:options MarkdownSchema depth=2 -->

Render the page body from markdown instead of components. `content` and `file` are mutually exclusive; `file` resolves from the project root.

```yaml
name: my-docs
pages:
  - name: Docs Home
    path: /docs
    markdown:
      file: content/docs/home.md
      layout: docs
      toc: { maxDepth: 3, position: sidebar }
    components:
      - { type: container, element: main }
```

YAML frontmatter between `---` delimiters is parsed and exposed as `$frontmatter.*`, usable in `meta` and sibling properties. Rendered markdown HTML is sanitized, consistently with the `text` and `alert` content components.

`layout` picks the wrapper: `prose` (the default — a centred reading column), `docs`, `full`, or `none` for raw HTML. `prose` and `docs` share the same typography, so headings, lists, code and quotes read the same in both.

The `docs` layout's frame is measured with `frame`: `sidebarWidth` and `tocWidth` (from the `lg` breakpoint up), `contentMaxWidth` (the article column's reading measure — its header, its text and its closing lines alike, so the title never overhangs the paragraph under it), and `stickyOffset` (the height of a sticky header the sidebar and the outline stick below), each in `px` or `rem`. `menuButton: header` lifts the phone's sections button into the page's first component, so a sticky header carries it; `articleActions: false` drops the copy and view-as-markdown actions beside the title. `toc.minDepth: 2` starts the outline at the `h2`s, so it does not repeat the page title.

`classes` restyles the parts the layout draws, with the same `parts` and `states` shape a component's `classes` takes: the frame's `frame` (the row holding the sidebar, the article and the outline), `sidebar`, `navGroup` (one section of the sidebar), `navGroupLabel`, `navLink`, `menuButton` (the phone's button that opens the sections), `toc`, `article`, `articleHeader`, `articleActions` (the page actions beside the title), `articleLinks` (the view-as-markdown links among them) and `lastUpdated`; a page action is hidden by part, `articleLinks: hidden` keeping the copy action alone and `articleActions: max-lg:hidden` dropping them on a phone; a `callout`, and one part per kind (`calloutInfo`, `calloutNote`, `calloutTip`, `calloutWarning`, `calloutDanger`); and the article's prose — `heading1`, `heading2`, `heading3`, `lead` (the paragraph right under the title), `paragraph`, `list` (a bulleted or numbered list), `listItem`, `table`, `link`, `inlineCode`, `codeFrame`, `codeCaption`, `codeBlock`, `quote` and `image`. `states: { current: { navLink: … } }` styles the sidebar's current page. Space a prose part with `mt-*` and `mb-*` rather than `my-*`: the article's typography sets each element's vertical margins and wins over the shorthand, so `paragraph: my-6` paints nothing while `paragraph: mt-6 mb-6` does. `sovrium validate` points out a `my-*` token on a prose part with a notice, never a refusal.

A `::: callout` block renders an alert inside the article. Name its kind with `type`: `::: callout type="warning"`. The kinds are `info` (the default), `note`, `tip`, `warning` and `danger`; an unknown type renders as `info`. A callout keeps its own look — a panel with a rule down its left edge, coloured by its kind — and does not take the look of the `alert` component.

## `contentDir`

<!-- sovrium:options ContentDirSchema depth=2 -->

`contentDir` is a **page-level** property. It fans one page definition out over every markdown file in a directory and derives a navigation sidebar from their frontmatter — the way this manual's published twin is built.

`nav` accepts `enabled`, `groupBy` — the frontmatter key that buckets articles into sidebar groups — and `labelFrom`, the frontmatter key supplying each link's label, plus `groupLabels`, `groupIcons`, `collapsed` and `tabs` for presentation.

The previous and next links at the foot of each article follow the sidebar: they walk its groups in the order it lists them, so the last article of one group leads to the first article of the next. Articles the sidebar leaves out, such as drafts excluded by `filter`, are skipped.

An article may say who reads it in its own front matter: `access: authenticated`, or a list of roles such as `access: [admin]` — the page `access` grammar. The collection page's `access` still applies first; a reader outside the article's gets the same 404 as for any page they may not open, and the article leaves their sidebar, their previous and next links and their session search. Gate a folder by gating its articles, so one handbook keeps one sidebar while its managers' folder stays with the managers. An article gated this way is never published outside a signed-in page: the static search index, `llms.txt` and the markdown files `sovrium build` writes carry only the articles that declare no access, while the live `<article>.md` address answers exactly the readers the article does. A present `access` the front matter cannot read — an empty value, `[]`, or a YAML block list — keeps the article from everyone but an unrestricted admin, rather than publishing it.

Under `markdown.layout: docs` the four parts around an article carry their component types, like any drawn component: `sidebar` on the navigation, `toc` on the outline, `breadcrumb` on the breadcrumb and `pagination` on the previous and next links. On a phone the navigation folds behind a Menu button, in a bar across the column; the bar is a `container`, the button a `button`.

```yaml
name: my-docs
pages:
  - name: docs
    path: /docs/:slug
    contentDir:
      directory: content/docs
      slugFrom: filename
      include: '*.md'
      index: introduction
      sort: { field: order, order: asc }
      nav: { enabled: true, groupBy: section, labelFrom: sidebarLabel }
    markdown:
      layout: docs
      toc: { maxDepth: 3, position: sidebar }
    components:
      - { type: container, element: header }
```

**`contentDir` is not a component source.** It sits beside `components` on the page, not inside one. The page's own `markdown` block then styles every generated article — one `layout` and `toc` decision covers the whole directory.

## Related reading

- **Pages Overview** — the full page property table.
- **Routing & Paths** — the dynamic segment a collection fills.
- **SEO & Metadata** — per-record and per-article metadata.
- **Content Components** — inline markdown fragments.
- **llms.txt** — the machine-readable index derived from content directories.
