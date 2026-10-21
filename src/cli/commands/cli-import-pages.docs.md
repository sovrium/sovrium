# Migrating Pages From Another Tool

> Turn the pages of a Notion export, a Webflow site export or a Retool classic app into new Sovrium pages, offline: every block mapped to a kit component, every node with a fresh key, and everything that could not be carried listed for you to finish.

The pages of a Notion workspace or page export become pages of your app. The import reads the ZIP you downloaded from Notion and nothing else: no Notion API is called, no image or link is fetched, and nothing in the export is run. It follows the two stages of [Migrating From Another Tool](/en/docs/cli-import); the data side of Notion (its databases) is on [Migrating From Airtable and Notion](/en/docs/cli-import-airtable-notion).

```bash
sovrium import ./notion-export.zip --config app.yaml          # preview: prints the report, writes nothing
sovrium import ./notion-export.zip --config app.yaml --json   # the report as one JSON document
sovrium import ./notion-export.zip --config app.yaml --write  # write the pages
```

Text from another tool always arrives as text, whatever the source. Words in it that read like a page token (`$app.name`, `$query.q`, `$t:greeting`) are written with a backslash before the `$`, so the page prints them exactly as their author wrote them and never fills them, and the report's `pages.literalTokens` lists each one with the page and node it sits on.

In Notion, choose **Export**, then **HTML**, and keep **Include subpages** on. A **Markdown & CSV** export is read too, when the ZIP holds no HTML page, but Markdown loses some blocks (see below). Pass the ZIP as Notion gives it (`Export-<id>-Part-1.zip`), or the download that wraps it: a ZIP that only wraps other ZIPs is opened one level down. The export's `index.html`, a list of the workspace's pages, is not a page and is skipped.

## What becomes what

| In Notion                         | In Sovrium                                                                                                        |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| a page                            | a new page, named after its title (`Team Handbook` is `team-handbook`)                                            |
| a sub-page                        | a page of its own under its parent's path, and a `link` where it sat (after the list, when it sat in a list item) |
| heading 1, 2, 3, paragraph, quote | a `text` node at `h1`, `h2`, `h3`, `p`, `blockquote`                                                              |
| callout                           | an `alert`; its icon is not carried                                                                               |
| toggle                            | a `collapsible`, its summary as the trigger label                                                                 |
| divider, code, table of contents  | a `separator`, a `code` block shown as text, a `toc`                                                              |
| columns                           | a `grid` of equal columns, each column a `container`                                                              |
| image                             | an `image`, its caption as the alternative text                                                                   |

Pages are written each before its sub-pages, and sibling pages in the order of their file names in the export, whichever system or tool packed the ZIP. A page title with accents or symbols is folded into a kebab-case name. Two pages with the same title keep distinct names: the second in that order takes the start of its Notion id. Every node gets a `key` such as `text-3`, unique on its page and the same on every run of the same export, so the migrated pages can then round-trip through the design tools.

## What is reported instead

Nothing is approximated. The report's `pages` section lists, item by item, what is still yours to finish:

- **Unmapped blocks.** Bulleted, numbered and to-do list items (Notion writes each item as a list of its own), simple tables, equations, bookmarks, embeds, videos, attached files and any block the import does not recognise are reported where they sat, and nothing is drawn for them. A toggle with an empty summary is reported too, rather than given an invented label.
- **Unbound mentions.** A mention of a person, a date or another page keeps its visible text, and the mention itself is listed exactly as the export wrote it, for you to wire. An inline equation is written as its TeX source between dollars, and listed the same way.
- **Left behind.** An inline database is data, not page: it is named with the CSV that holds its rows (the one with every property, `…_all.csv`, when the export has it), for a data migration. A linked view of a database exports as a link and a title-only page with no data: it is named as a linked view, and its stub page is not written. A full-page database is named under its own name, and its row pages are counted rather than turned into pages. Attached files are named with their path in the export. Image files are referenced at the same path inside your app's public folder and listed, because a page migration does not copy files: put them under `public/` at that path.
- **Off the scale.** Columns of unequal widths, or more than twelve of them, are reported with the widths Notion wrote; the grid is written without a column count.
- **Structure.** The node count, depth and component types of each created page.

## Refusals

- A page whose name or path your config already holds is refused, and the page already there is never touched: a migration writes new pages only. Under `--write`, any refusal stops the whole write.
- An export that holds no page, more than 2,000 pages, a page nested too deep to read, or an entry whose path would leave the archive is refused before anything is written. So is a ZIP that expands past 512 MB or holds more than 20,000 files: export the workspace in parts.
- Notion cannot export a form view, so a Notion export brings no form; an HTML form inside a page is reported as unmapped.

Notion does not document its export's markup; the import is held to real HTML and Markdown exports. If a block of your export is reported that should have been carried, the report's `unmapped` list names it and where it sat.

## From Webflow

The pages of a Webflow site come from its code export: in the Designer, open **Export code** (a paid Workspace plan feature) and download the ZIP. It holds one HTML file per page beside `css/`, `js/` and `images/` folders, and that is all the import reads: nothing is fetched from Webflow, and no script of the export, inline or from Webflow's CDN, reaches your config.

```bash
sovrium import ./my-site.webflow.zip --config app.yaml          # preview
sovrium import ./my-site.webflow.zip --config app.yaml --write  # write the pages and their forms
```

| In Webflow                             | In Sovrium                                                                                       |
| -------------------------------------- | ------------------------------------------------------------------------------------------------ |
| a page (`about.html`)                  | a new page (`about` at `/about`); `index.html` is `home` at `/`, `blog/index.html` is at `/blog` |
| a section, a container                 | a `container`                                                                                    |
| a Div Block                            | a `flex` or a `grid` when its class sets that display, a `container` otherwise                   |
| a horizontal or vertical stack, a grid | a `flex` (a column for a vertical one), a `grid`                                                 |
| a Text Block                           | a `text` paragraph: a class such as `h3` styles it, it does not make it a heading                |
| a heading, a paragraph, a quote        | a `text` node at the heading's own level, `p`, `blockquote`                                      |
| a button, a link                       | a `button`, a `link`; a link to another page of the site points at its new path                  |
| an image                               | an `image`, its alternative text kept                                                            |
| a rich text block                      | its headings, paragraphs and quotes, each mapped on its own                                      |
| a tab set                              | `tabs`, its tab links naming the panels                                                          |
| a form                                 | a form of your app, and a `form` node on the page naming it                                      |

**Layout** is read from the classes in the site's own stylesheet (`css/<site>.webflow.css`; Webflow's `normalize.css` and `webflow.css` are its defaults and are not read): a flex box's direction and its gap along that direction, a grid's equal columns, alignment, padding and a container's maximum width. Each length is written as a step of your `design.spacing` only when a step holds exactly that length (`16px` is a `1rem` step); any other is listed under `offScale` with the nearest step, for you to choose. Breakpoint styles (`@media`) and the site's look (colours, fonts, margins) are not carried.

**Forms.** Each form becomes an entry of `forms`, with its inputs, labels, choices, required flags and the success and failure messages Webflow shows, and the page holds a `form` node whose `formRef` names it. A Webflow export holds no submissions, so the form starts empty. Importing the pages alone (`--only pages`) leaves that reference pointing at nothing, so the page is refused: import the forms with the pages.

**Variables.** A site that uses Webflow Variables writes them as CSS custom properties on `:root` in its stylesheet. The migration does not write your `design`; the report's `pages.tokens` names that stylesheet and the command that reads it, once you have unzipped the export:

```bash
sovrium design-system import ./my-site/css/my-site.webflow.css --from css --config app.yaml
```

A site with no Variables names no stylesheet.

**Reported instead.** Dropdowns, navbars, sliders, lightboxes, embeds and custom code, lists, and any element the table does not hold are listed under `unmapped` where they sat, and nothing is drawn for them, nor for anything inside them. A link with no text (an image-only link block) or with no target the app can hold is listed too. A Collection list arrives as an empty container, because the export holds no CMS content, and is listed under `unbound`; the collection itself imports from its CSV (see [Migrating From Another Tool](/en/docs/cli-import)). An image's path is read from the page's own place in the export, so `../images/x.png` written by `blog/post.html` is the export's `images/x.png`, written in the page as `/images/x.png`; its file is listed under `leftBehind` with that path, for you to put under `public/` at that path. A path that climbs out of the export names no file of it: the image keeps no source, and is listed under `leftBehind` as outside the export. An image served from a URL keeps its address as written, since the migration fetches nothing; an image written into the page as a `data:` URL is listed, and not carried.

## Retool classic apps

The screens of a Retool classic app become pages of your app, read from its ToolScript ZIP: in the app's editor, open the **App actions** menu and choose **Export to Toolscript ZIP**. Retool Cloud offers it, and so does a self-hosted Retool from 3.6.0. Name the tool, since a ToolScript ZIP carries no signature to detect:

```bash
sovrium import ./inventory.zip --from retool-classic --config app.yaml          # preview
sovrium import ./inventory.zip --from retool-classic --config app.yaml --write  # write the pages
```

Only the ToolScript ZIP is read. The ZIP must hold a `main.rsx` and a `metadata.json` whose ToolScript version is one the import knows (`1.0.0`); an export from before ToolScript, a JSON app export, or a ToolScript version the import does not know is refused before anything is written. No Retool API is called and nothing in the app is run: its markup is read as text, and its expressions are never evaluated.

| In Retool                                                | In Sovrium                                                                                 |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| a screen                                                 | a new page named after the screen's id in kebab-case (`addInventory` is `add-inventory`)   |
| the screen's URL slug                                    | the page's path; with no slug, `/<name>`. The app's start screen is not moved to `/`       |
| the shared header                                        | written at the top of every page, since a migration creates no template                    |
| a container with one view; a stack                       | a `container`; a `flex`                                                                    |
| a container with several views                           | a `tabs`, one panel per view, labelled by the view's label                                 |
| text, button, table, divider, alert                      | `text`, `button`, `table` (with no data source), `separator`, `alert`                      |
| a link, an image                                         | a `link` with its label, an `image`; a link's target and an image's source are not carried |
| a form and its text, number, select and text-area fields | an unbound `form` node holding the fields and its submit button                            |

A form arrives unbound: a Retool form posts to a query, so no form entry is created for it. The grid positions Retool saves beside the app order each container's components by row, then by column. Components that share a row become a 12-column `grid`, each on its own columns, and a component alone at the right end of its row is aligned to the end. Row heights are never carried: Retool publishes no pixel height for a grid row.

The report lists what is yours to finish:

- **Unbound expressions.** Every `{{ }}` expression a component carried, such as a table's `{{ getInventory.data }}`, is listed exactly as written, with the node it sat on. None is translated, and none reaches your config. A braced setting such as `{{ showStepper: true }}` is a setting, not an expression, and is not listed.
- **Unmapped components.** Charts, the header's navigation, list and grid views, custom components, HTML, IFrame and integrations are reported where they sat, and nothing is drawn for them. So is a key-value list whose pairs come from an expression, rather than an empty list.
- **Left behind.** Each query of a screen is named, with the SQL file its body is kept in, for the data side of the migration.
