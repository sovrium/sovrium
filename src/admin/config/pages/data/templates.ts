/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// Templates — the template assets the app ships, each previewed with its
// sample data. Read-only, like every surface here: a template
// changes in the config, never in the console.
//
// TWO pages:
//
//   `/templates`         every template asset, in declaration order.
//   `/templates/:path*`  one of them rendered with its `sampleData`.
//
// `:path*` and not `:path`: an asset path has slashes in it
// (`templates/invoice.html`), and a named wildcard is the one route segment
// that captures them. The directory is listed FIRST because route matching
// takes the first pattern that matches — `/templates` does not match
// `:path*` (the wildcard is non-empty), but every other multi-page surface
// keeps the literal first and this one is not the place to re-derive why.
//
// ─── THE PREVIEW IS A RENDER IN A FRAME THAT GRANTS NOTHING ────────────────
//
// The detail page binds its record to `GET /api/admin/templates/preview`,
// resolved on the render path with the caller's session, so the rendered
// markup is in the first response and a path naming no template is the page's
// own 404. The markup goes into an `iframe` as `srcdoc`, with `sandbox` EMPTY:
// no scripts, no same-origin, no forms, no navigation of the console. A
// template is the app author's markup filled with data, and the console must
// never run either.
//
// `sandbox` does not stop a frame loading pictures, and a frame written with
// `srcdoc` inherits the console's policy, which says nothing about images. So
// the frame opens with its own policy, `default-src 'none'`, before the
// template's first byte: an `<img src="https://…">` in a template is refused
// by the browser rather than fetched — no tracking pixel ever learns that an
// operator opened the preview. `data:` pictures (an inlined logo) and inline
// styles are what a filled template legitimately carries, and stay allowed.
//
// ─── THE PAPER IS WHITE ON PURPOSE ─────────────────────────────────────────
//
// The frame's ground is white in both schemes. It is not a colour choice of
// the console's: it is the ground the template will be read on — a PDF page,
// a mail client, a printed label — and a template drawn on the console's dark
// ground would preview black text on near-black, which is a preview of
// nothing. Everything around the frame follows the scheme.
//
// ─── THREE STATES, EACH A GATE ON ONE FIELD OF THE PREVIEW ─────────────────
//
//   `rendersAs: none`        Word, Excel, PowerPoint — they render to a FILE,
//                            so the page names the `sovrium render` command
//                            instead of drawing a frame.
//   `usedSampleData: false`  the asset declares no `sampleData`: the preview
//                            is drawn with empty values, and the page says so
//                            and says how to fix it.
//   `rendersAs: email`       the HTML exactly as `email/send` delivers it, and
//                            the page says that too — inlined styles look like
//                            a rendering quirk unless someone tells you why.
//
// `visibility.record` takes ONE field, so a gate needing two (an Office kind
// AND its extension) is two nested nodes, the outer on `rendersAs`.

import { emptyState, pageHeading } from '../../components/data-page'
import { withShell } from '../../components/shell'
import { TEMPLATES_ENDPOINT, TEMPLATE_PREVIEW_ENDPOINT } from '../../system-sources'
import type { Page as PageConfig } from '@/domain/models/app'

/** One node of a page's component tree, as the config type expresses it. */
type PageComponent = NonNullable<PageConfig['components']>[number]

/** The crumb label both pages share. */
const BREADCRUMB = { templates: '$t:admin.crumb.templates' } as const

/** A plain text node. */
const text = (element: string, className: string, content: string): PageComponent =>
  ({ type: 'text', element, props: { className }, content }) as PageComponent

/** A text node drawn only on records whose `field` satisfies the operators. */
const gatedText = (
  element: string,
  className: string,
  content: string,
  record: Readonly<Record<string, unknown>>
): PageComponent =>
  ({
    type: 'text',
    element,
    props: { className },
    content,
    visibility: { record },
  }) as PageComponent

/** A wrapper drawn only on records whose `field` satisfies the operators. */
const gated = (
  record: Readonly<Record<string, unknown>>,
  children: readonly PageComponent[],
  props: Readonly<Record<string, unknown>> = {}
): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props,
    visibility: { record },
    children: [...children],
  }) as PageComponent

// ─── THE DIRECTORY ─────────────────────────────────────────────────────────

/**
 * One template row, the whole row a link to its preview.
 *
 * `data-testid="template-row-{path}"` is minted from `$record.path`, so a spec
 * can speak about one template rather than about the page's text. It lives on
 * the link, the outermost node the template owns: the `<li>` around it is
 * synthesized by the list expansion and takes no props.
 *
 * The kind is printed as the asset spells it (`html`, `docx`) in the mono
 * face, because it is a file type, not a label to be translated. The
 * description renders ungated: an absent field substitutes to the empty
 * string, so an undescribed template yields an empty line and nothing else.
 *
 * Sample data has two states and both are said, by weight. Readers are said
 * only when there are some: "not read by any automation" on most rows of a
 * fresh app was a line repeated down the list that told the reader nothing
 * the absence of "Read by" does not already say ([internal ref] D4).
 */
const templateRow = (): PageComponent =>
  ({
    type: 'link',
    props: {
      href: '/templates/$record.path',
      'data-testid': 'template-row-$record.path',
      className:
        'hover:bg-background-hover flex flex-col gap-1 px-4 py-3 no-underline md:flex-row md:items-baseline md:justify-between md:gap-6',
    },
    children: [
      {
        type: 'container',
        element: 'div',
        props: { className: 'flex min-w-0 flex-col gap-0.5' },
        children: [
          text('span', 'text-foreground font-mono text-sm break-all', '$record.path'),
          text('span', 'text-foreground-subtle text-sm empty:hidden', '$record.description'),
          // The label and the step names are two nodes: a `$t:` token is the
          // WHOLE content of a node and cannot interpolate a record value.
          gated(
            { field: 'usedBy', isNotEmpty: true },
            [
              text('span', '', '$t:admin.templates.row.readBy'),
              text('span', 'font-mono', '$record.usedBy'),
            ],
            { className: 'text-foreground-subtle flex flex-wrap gap-1 text-sm' }
          ),
        ],
      } as PageComponent,
      {
        type: 'container',
        element: 'div',
        props: { className: 'flex shrink-0 items-baseline gap-3' },
        children: [
          // Weight, not colour: a template WITH sample data reads as settled,
          // one without recedes (BRAND.md §3 — colour is for consequence).
          gatedText('span', 'text-foreground text-sm', '$t:admin.templates.row.sample', {
            field: 'hasSampleData',
            eq: true,
          }),
          gatedText('span', 'text-foreground-subtle text-sm', '$t:admin.templates.row.noSample', {
            field: 'hasSampleData',
            eq: false,
          }),
          text('span', 'text-foreground-subtle font-mono text-sm', '$record.kind'),
        ],
      } as PageComponent,
    ],
  }) as PageComponent

/**
 * The template list, in declaration order — the author's order is information,
 * and the endpoint keeps it.
 */
const templateList = (): PageComponent =>
  ({
    type: 'list',
    props: {
      'aria-label': '$t:admin.templates.list.region',
      'data-testid': 'templates-list',
      className:
        'border-border divide-border bg-background-raised divide-y overflow-hidden rounded-lg border',
    },
    dataSource: { system: { endpoint: TEMPLATES_ENDPOINT, rowsKey: 'templates', idKey: 'path' } },
    children: [templateRow()],
  }) as PageComponent

/**
 * The directory body: the list, or — on an app shipping no template — what a
 * template is and where one is declared.
 *
 * Gated on the PAGE record (the whole list body, read once: the list's rows
 * binding is the same endpoint string, so the two are one request). Presence is
 * the engine's one empty rule, so `isEmpty` / `isNotEmpty` on `templates` are
 * mutually exclusive by construction, and an app with no template gets the
 * sentence instead of an empty bordered box.
 */
const directoryBody = (): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: { className: 'flex max-w-4xl flex-col gap-4 pt-2' },
    children: [
      gated({ field: 'templates', isNotEmpty: true }, [templateList()]),
      gated({ field: 'templates', isEmpty: true }, [
        emptyState(
          '$t:admin.templates.empty.title',
          '$t:admin.templates.empty.body',
          '$t:admin.templates.empty.hint'
        ),
      ]),
    ],
  }) as PageComponent

const directory = withShell(
  {
    id: 'dashboard-data-templates',
    name: 'dashboard-data-templates',
    path: '/templates',
    meta: { title: '$t:admin.meta.templates', lang: 'en-US' },
    dataSource: { system: { endpoint: TEMPLATES_ENDPOINT } },
    components: [
      // The blurb is painted: it is the only place an operator learns that
      // what they are about to open is a RENDER with sample data, and that the
      // template itself changes in the config — the two facts that make the
      // read-only posture an explanation rather than a missing button.
      pageHeading('$t:admin.templates.heading', '$t:admin.templates.blurb', { showBlurb: true }),
      directoryBody(),
    ],
  } as PageConfig,
  { breadcrumb: BREADCRUMB }
) satisfies PageConfig

// ─── THE PREVIEW ───────────────────────────────────────────────────────────

/**
 * The frame's own policy, written ahead of the rendered template.
 *
 * `default-src 'none'` refuses every fetch — script, frame, font, connection,
 * remote picture — and the two exceptions are what a filled template is made
 * of: inline styles (an email's inlined `style` attributes, a document's
 * `<style>` block) and `data:` pictures (a logo or a QR code the renderer
 * inlined). No `unsafe-inline` for scripts: the sandbox already refuses them,
 * and the policy says it twice so that neither alone is load-bearing.
 */
const FRAME_POLICY =
  '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; ' +
  "style-src 'unsafe-inline'; img-src data:; font-src data:\">"

/**
 * The preview frame.
 *
 * The frame's ground is forced white (see the file header) — the one place
 * the console names a literal colour, because it is the PAPER, not the UI.
 *
 * `sandbox: ''` is the attribute present and EMPTY — every restriction on,
 * none lifted. `title` gives the embedded document an accessible name.
 * The height is fixed rather than measured: a document that could measure
 * itself and resize its frame would need scripts, which is exactly what the
 * frame refuses. 70vh shows a letter's first page at a laptop height and
 * leaves the frame scrollable for the rest.
 */
const previewFrame = (): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: { className: 'border-border overflow-hidden rounded-lg border' },
    children: [
      {
        type: 'iframe',
        props: {
          'data-testid': 'template-preview',
          sandbox: '',
          srcDoc: `${FRAME_POLICY}$record.content`,
          title: 'Preview of $record.path',
          // `bg-white!`: the platform's iframe recipe paints a subtle ground,
          // and a document whose own canvas is transparent would sit on it.
          className: 'block h-[70vh] min-h-80 w-full border-0 bg-white!',
        },
      },
    ],
  }) as PageComponent

/** What the frame shows, in one quiet line above it. */
const previewCaption = (): PageComponent =>
  ({
    type: 'container',
    element: 'div',
    props: { className: 'flex flex-col gap-0.5' },
    children: [
      gatedText('p', 'text-foreground-subtle text-sm', '$t:admin.templates.preview.email', {
        field: 'rendersAs',
        eq: 'email',
      }),
      // Two nested gates — one field each — because "filled with its sample
      // data" is true only of a document that HAS some; the unfilled case
      // has its own notice above, and saying both would contradict it.
      gated({ field: 'usedSampleData', eq: true }, [
        gatedText('p', 'text-foreground-subtle text-sm', '$t:admin.templates.preview.document', {
          field: 'rendersAs',
          in: ['html', 'svg', 'text'],
        }),
      ]),
    ],
  }) as PageComponent

/**
 * The no-sample notice.
 *
 * It says what the operator is looking at (a template with its fields empty),
 * why, and the one thing that fixes it — in the config, because that is the
 * only place a template changes. A neutral bordered note, not a warning: the
 * preview is correct, it is just not filled.
 */
const noSampleNotice = (): PageComponent =>
  gated(
    { field: 'usedSampleData', eq: false },
    [
      text('p', 'text-foreground text-sm font-medium', '$t:admin.templates.noSample.title'),
      text('p', 'text-foreground-subtle max-w-2xl text-sm', '$t:admin.templates.noSample.body'),
    ],
    {
      'data-testid': 'template-no-sample',
      role: 'note',
      className: 'border-border bg-background-raised flex flex-col gap-1 rounded-lg border p-4',
    }
  )

/**
 * The `sovrium render` command for one Office kind, drawn only when the path
 * ends in its extension. The output name is a fixed `preview.<ext>` rather
 * than the template's own name, so the command a reader copies can never
 * overwrite the template it renders.
 */
const renderCommand = (extension: string): PageComponent =>
  gated({ field: 'path', contains: `.${extension}` }, [
    {
      type: 'code',
      props: { language: 'bash', 'data-testid': 'template-render-command' },
      content: `sovrium render $record.path --out preview.${extension}`,
    } as PageComponent,
  ])

/**
 * A Word, Excel or PowerPoint template renders to a FILE, so there is nothing
 * for the browser to draw. Instead of an empty frame, the page names the
 * command that produces the file from a terminal in the project folder — with
 * the same sample data, the same engine.
 */
const fileTemplatePanel = (): PageComponent =>
  gated(
    { field: 'rendersAs', eq: 'none' },
    [
      text('p', 'text-foreground text-sm font-medium', '$t:admin.templates.file.title'),
      text('p', 'text-foreground-subtle max-w-2xl text-sm', '$t:admin.templates.file.body'),
      renderCommand('docx'),
      renderCommand('xlsx'),
      renderCommand('pptx'),
    ],
    {
      'data-testid': 'template-file-panel',
      className: 'border-border bg-background-raised flex flex-col gap-2 rounded-lg border p-4',
    }
  )

const preview = withShell(
  {
    id: 'dashboard-data-template-preview',
    name: 'dashboard-data-template-preview',
    path: '/templates/:path*',
    // The list page's key: `meta.title` is resolved before the record is
    // fetched, so a `$record.` token here would ship verbatim.
    meta: { title: '$t:admin.meta.templates', lang: 'en-US' },
    dataSource: { system: { endpoint: TEMPLATE_PREVIEW_ENDPOINT, param: 'path' } },
    components: [
      pageHeading('$record.path', '$t:admin.templates.preview.blurb'),
      {
        type: 'container',
        element: 'div',
        props: { className: 'flex max-w-5xl flex-col gap-4 pt-2' },
        children: [
          text('p', 'text-foreground font-mono text-sm break-all', '$record.path'),
          noSampleNotice(),
          gated({ field: 'rendersAs', neq: 'none' }, [previewCaption(), previewFrame()], {
            className: 'flex flex-col gap-2',
          }),
          fileTemplatePanel(),
        ],
      } as PageComponent,
    ],
  } as PageConfig,
  { breadcrumb: BREADCRUMB }
) satisfies PageConfig

/** Both pages, directory first. */
export default [directory, preview] as readonly PageConfig[]
