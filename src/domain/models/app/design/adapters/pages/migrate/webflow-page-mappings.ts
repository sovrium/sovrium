/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { MigratedPageMappings } from './migrated-page-mapping'

/**
 * Webflow → kit types, read from a site-export ZIP (`webflow/2.2.2`): one
 * `.html` per page plus the site stylesheet (fact c2).
 *
 * Keyed by the element types Webflow's own Designer typings declare
 * (`Section`, `Block`, `Heading`, `FormForm`, `DynamoWrapper` …), which are
 * pinned byte for byte. An exported page carries them as tags and `w-`
 * classes (fact c6) — `w-container`, `w-layout-grid`, `w-form`, `w-richtext`,
 * `w-tabs` are observed in Webflow's published stylesheet — and the converter
 * reads the real export to recognise each one; a recognition that turns out
 * wrong is fixed in the converter, never by changing a target here.
 *
 * A `Block` (a Div Block) has no kit type of its own: its LAYOUT decides it.
 * `display: flex` makes it `flex`, `display: grid` makes it `grid`, anything
 * else makes it a `container`. The `layout` table below lists the CSS
 * properties read, each onto the spacing scale or reported.
 *
 * A Collection list is a CMS binding: it arrives as an unbound `container`
 * showing nothing, and the binding is reported (the export holds no CMS
 * content, fact c3). A form becomes a `form` node naming its `ExtractedForm`;
 * its inputs, labels and messages are that form's fields and messages.
 * Custom code (`HtmlEmbed`, `CustomCode`) is never carried and is reported.
 *
 * @public Read by the page migration converter.
 */
export const WEBFLOW_PAGE_MAPPINGS: MigratedPageMappings = {
  source: 'webflow',
  components: {
    Section: {
      outcome: 'node',
      type: 'container',
      holds: 'children',
      note: 'A full-width band of the page',
    },
    Container: {
      outcome: 'node',
      type: 'container',
      holds: 'children',
      note: 'A centred, width-limited box',
    },
    Block: {
      outcome: 'node',
      type: 'container',
      holds: 'children',
      note: 'A Div Block: `flex` or `grid` when its class sets that display, `container` otherwise; a Text Block, which holds text only, is a `text` paragraph',
    },
    Grid: {
      outcome: 'node',
      type: 'grid',
      holds: 'children',
      note: 'Webflow’s grid element',
    },
    HFlex: {
      outcome: 'node',
      type: 'flex',
      holds: 'children',
      note: 'A horizontal flex box',
    },
    VFlex: {
      outcome: 'node',
      type: 'flex',
      holds: 'children',
      note: 'A vertical flex box, its direction a column',
    },
    Heading: {
      outcome: 'node',
      type: 'text',
      element: 'source-tag',
      holds: 'content',
      note: 'A text node at the level its own `h1`…`h6` tag states',
    },
    Paragraph: {
      outcome: 'node',
      type: 'text',
      element: 'p',
      holds: 'content',
      note: 'A paragraph of literal text',
    },
    Blockquote: {
      outcome: 'node',
      type: 'text',
      element: 'blockquote',
      holds: 'content',
      note: 'A quotation',
    },
    RichText: {
      outcome: 'transparent',
      note: 'A rich-text block holds headings, paragraphs and quotes, each mapped by its own element',
    },
    Link: {
      outcome: 'node',
      type: 'link',
      holds: 'content',
      note: 'Its label and a literal target carry across',
    },
    Image: {
      outcome: 'node',
      type: 'image',
      holds: 'nothing',
      note: 'Its source in the export’s images folder and its alternative text',
    },
    CodeBlock: {
      outcome: 'node',
      type: 'code',
      holds: 'content',
      note: 'A block of code shown as text, never run',
    },
    FormWrapper: {
      outcome: 'node',
      type: 'form',
      holds: 'nothing',
      note: 'A form node naming the `ExtractedForm` built from the form it wraps',
    },
    FormForm: {
      outcome: 'absorbed',
      into: 'form',
      note: 'The form element: its action and method',
    },
    FormBlockLabel: { outcome: 'absorbed', into: 'form', note: 'A field label' },
    FormTextInput: { outcome: 'absorbed', into: 'form', note: 'A text-like field' },
    FormTextarea: { outcome: 'absorbed', into: 'form', note: 'A multi-line field' },
    FormSelect: { outcome: 'absorbed', into: 'form', note: 'A choice field and its options' },
    FormCheckboxInput: { outcome: 'absorbed', into: 'form', note: 'A checkbox field' },
    FormRadioInput: { outcome: 'absorbed', into: 'form', note: 'A radio field' },
    FormButton: { outcome: 'absorbed', into: 'form', note: 'The submit label' },
    FormSuccessMessage: { outcome: 'absorbed', into: 'form', note: 'The message after a submit' },
    FormErrorMessage: { outcome: 'absorbed', into: 'form', note: 'The message when it fails' },
    TabsWrapper: {
      outcome: 'node',
      type: 'tabs',
      holds: 'nothing',
      note: 'A tab set; its links name the panels, its panes hold them',
    },
    TabsMenu: { outcome: 'absorbed', into: 'tabs', note: 'The strip of tab links' },
    TabsLink: { outcome: 'absorbed', into: 'tabs', note: 'One panel’s label' },
    TabsContent: { outcome: 'absorbed', into: 'tabs', note: 'The panes' },
    TabsPane: { outcome: 'absorbed', into: 'tabs', note: 'One panel’s content' },
    DynamoWrapper: {
      outcome: 'node',
      type: 'container',
      holds: 'nothing',
      note: 'A Collection list: an unbound container, its CMS binding reported',
    },
  },
  layout: {
    'flex-direction': {
      property: 'direction',
      note: 'row or column, and their reverses',
    },
    gap: { property: 'gap', note: 'On the spacing scale, or reported with the nearest step' },
    'row-gap': { property: 'gap', note: 'The gap along a column: a column flex box’s gap' },
    'column-gap': { property: 'gap', note: 'The gap along a row: a row flex box’s gap' },
    'grid-row-gap': {
      property: 'gap',
      note: 'The spelling Webflow’s exported CSS writes for `row-gap`',
    },
    'grid-column-gap': {
      property: 'gap',
      note: 'The spelling Webflow’s exported CSS writes for `column-gap`',
    },
    'flex-flow': { property: 'direction', note: 'Its direction half only' },
    'align-items': { property: 'align', note: 'start, center, end, stretch or baseline' },
    'justify-content': {
      property: 'justify',
      note: 'start, center, end or space-between',
    },
    padding: {
      property: 'padding',
      note: 'On the spacing scale, or reported with the nearest step',
    },
    'max-width': { property: 'width', note: 'A container’s width limit' },
    'grid-template-columns': {
      property: 'columns',
      note: 'Only `repeat(<n>, 1fr)` or `repeat(<n>, minmax(0, 1fr))` with n up to 12; any other track list is reported',
    },
  },
}
