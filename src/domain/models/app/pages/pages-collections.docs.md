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

The generated record is exposed as `$record.*` to the whole tree, including `meta` — so per-record SEO comes for free. A URL matching no record returns `404`.

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

## `contentDir`

<!-- sovrium:options ContentDirSchema depth=2 -->

`contentDir` is a **page-level** property. It fans one page definition out over every markdown file in a directory and derives a navigation sidebar from their frontmatter — the way this manual's published twin is built.

`nav` accepts `enabled`, `groupBy` — the frontmatter key that buckets articles into sidebar groups — and `labelFrom`, the frontmatter key supplying each link's label, plus `groupLabels`, `groupIcons`, `collapsed` and `tabs` for presentation.

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
