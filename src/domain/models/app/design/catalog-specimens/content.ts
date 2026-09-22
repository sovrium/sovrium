/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The two kit categories a page SHOWS: content and display.
 *
 * Twenty-one types between them, and the largest half of the completion pass.
 * Split out from `catalog-specimens/state.ts` for size rather than for
 * principle — but the line the split falls on is real: everything here presents
 * something already decided, where `interactive` and `feedback` report a state
 * that is changing.
 *
 * ─── TWO PROP SHAPES THAT WERE THE SECOND ATTEMPT ──────────────────────────
 *
 *   - `tabs` derives its tabs from children of type `tab-panel` carrying
 *     `content.label` / `content.body`. Any other child shape yields
 *     `items: []` and a permanent skeleton.
 *   - `qr-code` takes a top-level `value`. Inside `props` it encodes nothing
 *     and emits zero bytes.
 *
 * Each renders EMPTY rather than failing, which is why every one of them was
 * rendered through the real pipeline before being written down.
 *
 * `empty-state` was a third of these, and is no longer: its `emptyTitle` /
 * `emptyDescription` are declared top-level, the renderer read them off
 * `elementProps`, and nothing carried them across — so the specimen below had to
 * spell them inside `props` to draw anything. `empty-state-copy-builder.ts`
 * lifts them now, and the specimen is written where the schema declares them.
 */

import type { CatalogSpecimen } from '.'
import type { Component } from '@/domain/models/app/pages/components'

const component = (value: unknown): Component => value as Component

/** The eleven content types. */
const CONTENT_SPECIMENS: readonly CatalogSpecimen[] = [
  {
    type: 'text',
    component: component({
      type: 'container',
      element: 'div',
      props: { className: 'flex flex-col gap-1' },
      children: [
        {
          type: 'text',
          element: 'p',
          props: { className: 'text-sm' },
          content: 'Body prose at reading measure.',
        },
        {
          type: 'text',
          element: 'span',
          props: { className: 'text-foreground-subtle font-mono text-xs' },
          content: 'inline span',
        },
      ],
    }),
  },
  {
    type: 'code',
    component: component({
      type: 'code',
      content: 'tables:\n  - name: invoices\n    fields: [client, amount]',
      props: { language: 'yaml' },
    }),
  },
  {
    type: 'icon',
    component: component({
      type: 'container',
      element: 'div',
      props: { className: 'flex flex-wrap items-center gap-3' },
      children: [
        { type: 'icon', props: { name: 'check-circle', 'aria-label': 'Success' } },
        { type: 'icon', props: { name: 'alert-triangle', 'aria-label': 'Warning' } },
        { type: 'icon', props: { name: 'info', 'aria-label': 'Information' } },
        { type: 'icon', props: { name: 'arrow-right', 'aria-label': 'Next' } },
      ],
    }),
  },
  {
    type: 'toc',
    component: component({
      type: 'toc',
      props: { className: 'text-xs' },
    }),
  },
  {
    // A REAL CLIP, and the earlier decision reversed on purpose. This specimen
    // used to carry no `src` at all, on the argument that a native `<audio
    // controls>` paints its whole transport with nothing behind it and that a
    // sample would add an unrelated question to a page about controls. What
    // the empty transport actually showed a reader was a finished-looking
    // control that does nothing: no length, no scrub range, nothing to press
    // play on. The three samples below are synthesised from the Sovrium mark's
    // own geometry precisely so they answer no question but "does this work".
    //
    // `preload: 'metadata'` is the load-bearing half. Under `'none'` the
    // element holds a URL and shows an empty transport, which is the state
    // being fixed; `'metadata'` is what makes the length appear before anyone
    // presses anything.
    type: 'audio',
    component: component({
      type: 'audio',
      props: {
        src: '/assets/design-system/sample-chime.mp3',
        controls: true,
        preload: 'metadata',
        'aria-label': 'Audio transport',
        className: 'w-full',
      },
    }),
  },
  {
    // `preload: 'metadata'` for the same reason as the audio specimen above,
    // with one more consequence here: metadata is what paints the first frame,
    // so the difference is between a black box and a picture.
    type: 'video',
    component: component({
      type: 'video',
      props: {
        src: '/assets/design-system/sample-motion.webm',
        controls: true,
        preload: 'metadata',
        width: 200,
        height: 112,
        'aria-label': 'Video transport',
        className: 'border-border rounded-md border',
      },
    }),
  },
  {
    type: 'image',
    component: component({
      type: 'image',
      props: {
        // A served file rather than the inline SVG this used to draw. The old
        // comment argued an inline `data:` URI kept the kit page's network
        // sweep free of an unrelated asset; what
        // it drew was a flat grey rectangle, which tells a reader nothing
        // about how an image renders. The sweep is unaffected either way — it
        // forbids non-GET and cross-origin requests, and this is a same-origin
        // GET for an asset the console itself ships.
        src: '/assets/design-system/sample-still.avif',
        alt: 'Image swatch',
        // The sample is 960×540; these keep the drawn box at the same 16:9
        // footprint the specimen had before, reserving its space before the
        // file decodes.
        width: 192,
        height: 108,
        className: 'border-border rounded-md border',
      },
    }),
  },
  {
    type: 'qr-code',
    // `value` is a TOP-LEVEL field. Inside `props` the component emits nothing
    // whatsoever — measured, and the reason this specimen is written out here
    // rather than derived.
    component: component({ type: 'qr-code', value: 'https://sovrium.com', size: 72 }),
  },
  {
    // ONE specimen for the merged type. The subscriber scope is the one drawn
    // because it is the shape a preview can honestly show: a page-scoped input
    // needs a prebuilt index this console has none of, so drawing it would
    // present an empty result list as if it were the component working.
    type: 'search-input',
    component: component({
      type: 'search-input',
      scope: 'subscribers',
      props: { id: 'design-system-kit-search', placeholder: 'Search…' },
    }),
  },
  {
    // A two-key chord with no `separator`, which is the resting form: the caps
    // sit adjacent under the chord's own gap, as they do on the keyboard being
    // described. A `+` here would document the separator rather than the keycap.
    type: 'kbd',
    component: component({ type: 'kbd', keys: ['⌘', 'K'] }),
  },
  {
    type: 'iframe',
    refusal: {
      state: 'not-previewable',
      note:
        'Not drawn here, and this is a refusal rather than a gap: this console renders every ' +
        'specimen flat, in one document, because a design system inside a nested scrolling ' +
        'document is not one a reader can read. Drawing an iframe specimen would put the frame ' +
        'back. Look at the page you embedded it on.',
    },
  },
]

/** The ten display types. */
const DISPLAY_SPECIMENS: readonly CatalogSpecimen[] = [
  {
    // A GROUP OF THREE, and the count is load-bearing rather than decorative.
    // It is the shape that shows every decision the type makes at once: the
    // stack overlap, initials DERIVED from a name the config never spells out,
    // and enough members that a `max` has something to hide — which is what
    // `[internal ref]` draws a preview of, capping this
    // specimen at two and reading the overflow as `+1`. A single avatar would
    // document a disc; this documents the component.
    type: 'avatar',
    component: component({
      type: 'avatar',
      label: 'Reviewers',
      items: [{ label: 'Ada Lovelace' }, { label: 'Grace Hopper' }, { label: 'Alan Turing' }],
    }),
  },
  {
    // Three facts, one of them EMPTY, and one carrying an action. The empty row
    // is the half of this type a reader cannot see any other way: a declared and
    // empty detail keeps its row rather than collapsing, so a summary panel over
    // a null column does not silently lose a line.
    type: 'description-list',
    component: component({
      type: 'description-list',
      items: [
        { term: 'Client', detail: 'Atelier Verne', action: { label: 'Open', href: '#' } },
        { term: 'Amount', detail: '4 250,00 €' },
        { term: 'Reference', detail: '' },
      ],
    }),
  },
  {
    type: 'accordion',
    component: component({
      type: 'accordion',
      accordionType: 'single',
      children: [
        {
          type: 'container',
          props: { id: 'zone' },
          content: { title: 'What is a zone?', body: 'A route family with its own budget.' },
        },
        {
          type: 'container',
          props: { id: 'voice' },
          content: { title: 'Can I override voice?', body: 'Per zone, yes — see Voice.' },
        },
      ],
    }),
  },
  {
    type: 'empty-state',
    component: component({
      type: 'empty-state',
      emptyTitle: 'No records yet.',
      emptyDescription: 'Create the first one to see it here.',
    }),
  },
  {
    type: 'list-item',
    component: component({
      type: 'container',
      element: 'div',
      props: { className: 'flex flex-col gap-1' },
      children: [
        { type: 'list-item', content: 'Invoice inv_0292 — Atelier Verne' },
        { type: 'list-item', content: 'Invoice inv_0291 — Maison Delcourt' },
      ],
    }),
  },
  {
    type: 'scroll-area',
    component: component({
      type: 'scroll-area',
      scrollAreaHeight: '76px',
      scrollOrientation: 'vertical',
      props: { className: 'text-xs' },
      children: [
        { type: 'text', element: 'p', content: 'Row one' },
        { type: 'text', element: 'p', content: 'Row two' },
        { type: 'text', element: 'p', content: 'Row three' },
        { type: 'text', element: 'p', content: 'Row four' },
        { type: 'text', element: 'p', content: 'Row five' },
        { type: 'text', element: 'p', content: 'Row six' },
      ],
    }),
  },
  {
    type: 'swatch',
    component: component({
      type: 'swatch',
      // `--sv-primary`, not `--sv-color-primary`. The latter is the schema's own
      // EXAMPLE string and resolves to nothing: `DEFAULT_SV_LIGHT_VALUES` is
      // keyed on the role name (`primary`), so a swatch naming it printed a
      // transparent chip and no hex at all — the notation flags going inert on
      // the one card that documents them.
      token: '--sv-primary',
      label: 'Primary',
      showHex: true,
    }),
  },
  {
    type: 'marquee',
    component: component({
      type: 'marquee',
      children: [{ type: 'text', element: 'span', content: 'One file, one app · ' }],
    }),
  },
  {
    type: 'tabs',
    // `panels[]`, not `tab-panel` children: the strip is data on the parent now.
    // Both panels carry their own `body`, so the specimen needs no `children`
    // at all — which is the shape that keeps `panels.length` and
    // `children.length` from having to agree.
    component: component({
      type: 'tabs',
      defaultTab: 'overview',
      panels: [
        { id: 'overview', label: 'Overview', body: 'Overview panel' },
        { id: 'activity', label: 'Activity', body: 'Activity panel' },
      ],
    }),
  },
  {
    type: 'timeline',
    component: component({
      type: 'timeline',
      props: { className: 'flex flex-col gap-1 text-xs' },
      children: [
        { type: 'text', element: 'p', content: 'Invoice sent · 14:02' },
        { type: 'text', element: 'p', content: 'Record created · 13:40' },
      ],
    }),
  },
  {
    type: 'record-field',
    refusal: {
      state: 'needs-data-source',
      note:
        'Draws ONE field of the record the page it sits on is bound to. This page is bound to no ' +
        'record — and binding it to one of yours is what the confidentiality bound forbids — so ' +
        'there is nothing for it to read. The field CONTROLS it draws from are in the composed ' +
        'form below.',
    },
  },
]

/** The two categories this module owns. */
export const SHOWN_SPECIMENS_BY_CATEGORY = {
  content: CONTENT_SPECIMENS,
  display: DISPLAY_SPECIMENS,
} as const satisfies Readonly<Record<string, readonly CatalogSpecimen[]>>
