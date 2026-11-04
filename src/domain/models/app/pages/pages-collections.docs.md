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

The generated record is exposed as `$record.*` to the whole tree, including `meta`, so per-record SEO comes for free. Code in `meta` is the exception: an analytics `initScript` and the body of a `customElements` script or style are sent as you wrote them, with any reference left unfilled, so a record value never becomes code. A URL matching no record returns `404`, and so does the URL of a deleted record. The record follows the visitor's own read permissions: a field they may not read resolves to nothing, in the components and in `meta` alike, so its value never reaches the page. A visitor the table's `read` refuses gets `404` for every record, as does a visitor who is not signed in when the table's row-level `read` rule names the signed-in person; a rule naming no one, such as `status = published`, applies to them as to anyone else. A record the row-level `read` rule hides from its visitor, signed in or not, answers exactly as a record that does not exist: the same `404` and the same page, so the answer never tells her the record is there. The `$collection.previous.*` and `$collection.next.*` neighbours follow the same permissions: their unreadable fields resolve to nothing, and a record the visitor may not see is skipped for the nearest one they may. They are filled inside a translated value too, so a `$t:` key can carry `Previous: $collection.previous.title`. Their values are shown as text, even inside content written as HTML: `<p>Up next: <strong>$collection.next.title</strong></p>` prints a title that holds markup as those characters, never as elements.

## A slug per language

When each language has its own slug, give `slugField` one field per language and write `path` per language, each language's segment named after its field:

```yaml
pages:
  - name: case-study
    path: { fr: /cas/:slug_fr, en: /cases/:slug_en }
    collection:
      table: cases
      slugField: { fr: slug_fr, en: slug_en }
```

`/fr/cas/<slug_fr>` reads the record by `slug_fr`, `/en/cases/<slug_en>` by `slug_en`. Both addresses of one record list each other as `hreflang` alternates, the language switcher moves between them, and the sitemap pairs them. A record whose slug is empty in a language has no page in that language: nothing links there, and its other pages list only themselves. Make each slug field `unique`; `sovrium validate` warns when one is not, and refuses a map naming an undeclared language, a missing or non-text field, a plain `path`, or a path whose segment does not name its language's field. A plain string `slugField` keeps one slug for every language.

A translatable `single-line-text` field already holds one slug per language, so name it once, beside a path per language that each carry its segment:

```yaml
pages:
  - name: case-study
    path: { fr: /cas/:slug, en: /cases/:slug }
    collection:
      table: cases
      slugField: slug
```

`/fr/cas/<slug>` reads the record by its French value and `/en/cases/<slug>` by its English one, and the alternates, the language switcher and the sitemap pair the two addresses as they do for a field per language. The read fallback that shows a missing translation in another language never applies to a slug: a record with no value in a language has no page there. Make the field `unique`, which holds it unique within each language; `sovrium validate` warns when it is not, and refuses a per-language map naming a translatable field.

## `markdown`

<!-- sovrium:options MarkdownSchema depth=2 -->

Render the page body from markdown instead of components. `content` and `file` are mutually exclusive; `file` resolves from the project root. A `file` that does not exist does not stop the app: `sovrium validate` and `sovrium bundle` print a warning naming the page and the path and still succeed, and `sovrium start` serves the page without its body and logs the missing file once, not on every request.

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

YAML frontmatter between `---` delimiters is parsed and exposed as `$frontmatter.*`, usable in `meta` and in the page's components, with or without `markdown.layout`; a template placed on the page receives it through its `vars` (`vars: { heading: $frontmatter.title }`). A reference can stand alone or sit inside a longer value: `title: $frontmatter.title · Docs` gives every article its own document title. A key the article does not declare resolves to nothing, never to the token itself. When `meta.title` is absent, or resolves to nothing for a file, the page takes the article's frontmatter `title`, so no article ships without a document title. Rendered markdown HTML is sanitized, consistently with the `text` and `alert` content components. An HTML comment (`<!-- … -->`) leaves nothing on the page: not in the article, not in its table of contents, not in a heading's anchor. Any other raw HTML written in the markdown is dropped or sanitized, never printed as text with its angle brackets and never run, so a `<script>` or an `onerror` attribute does nothing.

`layout` picks the wrapper: `prose` (the default: a centred reading column), `docs`, `full`, or `none` for raw HTML. `prose` and `docs` set the body with [Typeset](https://ui.shadcn.com/docs/typeset), shadcn/ui's prose stylesheet, so headings, lists, code and quotes read the same in both. It sizes everything from the text: `prose` keeps the size the page inherits, with a 1.75 line height and 1.25em above each block; `docs` reads at 15px with 1.5em between blocks. On a screen narrower than 48rem the text is set 1.125 times larger. Each block carries its space above it and none below, a section heading is 1.25 times the text, and inline code is set at 0.85em on the theme's muted background. A component the markdown draws (a code block, a callout) keeps its own styles and opens the same space above it as a paragraph. `full` and `none` set no prose styles. A table wider than the column scrolls sideways inside it rather than squeezing its cells or widening the page; while it overflows it becomes a keyboard stop the arrow keys scroll, named after its columns ("Table: Variable, Default, Purpose"), with a fade over the edge it continues past. A table that fits is drawn as it is, with no extra stop.

The `docs` layout's frame is measured with `frame`: `sidebarWidth` and `tocWidth` (from the `lg` breakpoint up), `contentMaxWidth` (the article column's reading measure: its header, its text and its closing lines alike, so the title never overhangs the paragraph under it), and `stickyOffset` (the height of a sticky header the sidebar and the outline stick below), each in `px` or `rem`. `menuButton: header` lifts the phone's sections button into the page's first component, so a sticky header carries it. The button reads "Menu" and names the drawer it opens the same way; rename both per language with the `sovrium.docs.menu` interface string (see Languages). The button can be pressed as soon as the page shows, before its scripts have run. `articleActions: false` drops the copy and view-as-markdown actions beside the title. `toc.minDepth: 2` starts the outline at the `h2`s, so it does not repeat the page title.

`classes` restyles the parts the layout draws, with the same `parts` and `states` shape a component's `classes` takes: the frame's `frame` (the row holding the sidebar, the article and the outline), `sidebar`, `navGroup` (one section of the sidebar), `navGroupLabel`, `navGroupChevron` (the disclosure icon of a folding group, which points down when the group is open and right when it is closed), `navLink`, `menuButton` (the phone's button that opens the sections), `drawer` (the phone's panel the sections open in), `toc`, `article`, `articleHeader`, `articleActions` (the page actions beside the title), `articleLinks` (the view-as-markdown links among them) and `lastUpdated`; a page action is hidden by part, `articleLinks: hidden` keeping the copy action alone and `articleActions: max-lg:hidden` dropping them on a phone; a `callout`, and one part per kind (`calloutInfo`, `calloutNote`, `calloutTip`, `calloutWarning`, `calloutDanger`); and the article's prose: `heading1`, `heading2`, `heading3`, `lead` (the paragraph right under the title), `paragraph`, `list` (a bulleted or numbered list), `listItem`, `table`, `link`, `inlineCode`, `codeFrame`, `codeCaption`, `codeCopy` (the copy button of a fenced block), `codeBlock`, `quote` and `image`. `states: { current: { navLink: … } }` styles the sidebar's current page. `tocLinkActive` styles the outline's link to the section being read, over the layout's own active look. A class on a prose part wins over Typeset, which only ever fills in what a part leaves unset: `paragraph: my-6` spaces every paragraph, and `heading2: text-2xl` resizes the section headings.

A `::: callout` block renders an alert inside the article. Name its kind with `type`: `::: callout type="warning"`. The kinds are `info` (the default), `note`, `tip`, `warning` and `danger`; an unknown type renders as `info`. A callout keeps its own look (a panel with a rule down its left edge, coloured by its kind) and does not take the look of the `alert` component.

## `contentDir`

<!-- sovrium:options ContentDirSchema depth=2 -->

`contentDir` is a **page-level** property. It fans one page definition out over every markdown file in a directory and derives a navigation sidebar from their frontmatter, the way this manual's published twin is built.

A `directory` that does not exist answers like a directory with no such article: every address under the page, its `index` address included, gets the app's 404 page, never an empty article. `sovrium validate` and `sovrium bundle` print one warning naming the page by its position and the directory (`pages[1].contentDir.directory content/notes/fr does not exist`), and still succeed. A directory that exists but holds no file yet is not warned about: a translation not written yet is legitimate.

`nav` accepts `enabled`, `groupBy` (the frontmatter key that buckets articles into sidebar groups) and `labelFrom`, the frontmatter key supplying each link's label, plus `groupLabels`, `groupIcons`, `collapsed`, `tabs`, `tabsPlacement` and `search` for presentation. `collapsed` and `tabs` compose: with both set, the sidebar lists only the active tab's sections, each one folded except the current article's, and the previous and next links still walk the articles tab by tab.

Two keys move the docs navigation into the sidebar. `tabsPlacement: sidebar` draws the tabs at the top of the sidebar: every tab is a link to its landing page (its `href`, else its first article), and only the current article's tab is expanded with its groups. The default, `header`, draws no tab list and leaves the tabs to the app's own header, which reads the active tab from `data-docs-active-zone`. `tabsPlacement: sidebar` needs `tabs`; without them the app is refused at load. `search: sidebar` puts the docs search field at the top of the sidebar. It searches the collection's own articles as the reader may see them, so an article whose front matter limits its readers is found only by them, and it never lists another collection's articles (another language's, say) nor a plain page. The field is driven by the keyboard: the arrow keys highlight a result, Enter opens it, Escape closes the panel, and a status announces how many results are listed. Both fold into the Menu drawer on a phone, and the previous and next links still walk the articles tab by tab.

The previous and next links at the foot of each article follow the sidebar: they walk its groups in the order it lists them, so the last article of one group leads to the first article of the next. Articles the sidebar leaves out, such as drafts excluded by `filter`, are skipped.

`include` decides which files the page has, everywhere at once: the articles it serves, the sidebar, the previous and next links, and what `sovrium bundle` carries. With `include: '*.md'` a file in a subdirectory gets no route and no sidebar entry, so the sidebar never links to an article that answers 404, and a bundled app shows the sidebar its source shows. With no `include`, every `.md` file under `directory` is listed, recursively. A pattern never reaches outside `directory`: a file behind a `..` segment is left out.

An article may say who reads it in its own front matter: `access: authenticated`, or a list of roles such as `access: [admin]`, in the page `access` grammar. The collection page's `access` still applies first; a reader outside the article's gets the same 404 as for any page they may not open, and the article leaves their sidebar, their previous and next links and their session search. Gate a folder by gating its articles, so one handbook keeps one sidebar while its managers' folder stays with the managers. An article gated this way is never published outside a signed-in page: the static search index, `llms.txt` and the markdown files `sovrium build` writes carry only the articles that declare no access, while the live `<article>.md` address answers exactly the readers the article does. A present `access` the front matter cannot read (an empty value, `[]`, or a YAML block list) keeps the article from everyone but an unrestricted admin, rather than publishing it.

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

**`contentDir` is not a component source.** It sits beside `components` on the page, not inside one. The page's own `markdown` block then styles every generated article: one `layout` and `toc` decision covers the whole directory.

Each article of a `contentDir` page gets a canonical link to its own address, `hreflang` alternates when the app declares several languages, and an Open Graph card built from its frontmatter (`title`, `description`, `image`) whose `og:url` is that canonical address and whose `og:locale`, in an app that declares its languages, is the language it is served in. A value the page declares in `openGraph` wins over the derived one, so a declared `url` or `locale` replaces it.

## Related reading

- **Pages Overview**: the full page property table.
- **Routing & Paths**: the dynamic segment a collection fills.
- **SEO & Metadata**: per-record and per-article metadata.
- **Content Components**: inline markdown fragments.
- **llms.txt**: the machine-readable index derived from content directories.

## Staying inside a parent, and resuming

`$collection.previous` and `$collection.next` follow the collection's whole order. On a lesson page that crosses courses: Next on the last lesson of one course opens the first lesson of the next. `collection.scope: <field>` keeps them among the records sharing the current record's value of that field, so the last lesson of a course has no Next.

`collection.resume: { table, link, user }` exposes `$collection.resume`: the first record of the scope, in the collection's order, for which the reader has no row of `table`: a row whose `link` points at the record and whose `user` names the reader. On a course, that is the first lesson she has not completed. It is empty once she has a row for every record of the scope, and a link built on it is then not drawn. A record the reader may not read is skipped by all three, and nothing of it reaches the page.

```yaml
pages:
  - name: lesson
    path: /lessons/:slug
    collection:
      table: lessons
      slugField: slug
      scope: course
      resume: { table: completions, link: lesson, user: member }
    components:
      - type: link
        props: { href: '/lessons/$collection.resume.slug' }
        content: 'Resume: $collection.resume.title'
```
