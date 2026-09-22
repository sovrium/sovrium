/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * SSR placeholders for the four island types added with the kit additions:
 * `rich-text-editor`, `code-editor`, `date-range-picker` and `filter-bar`.
 *
 * ─── WHY A FOURTH MODULE RATHER THAN A FEW MORE CASES NEXT DOOR ────────────
 *
 * `island-form-components.tsx` is already 955 lines and three of these four are
 * form controls, so that is where they would naturally have gone. It is also
 * the file every form-control island already shares, and four more entries put
 * it within reach of the per-file line cap for no gain: nothing here reads its
 * helpers, and nothing there reads these. The aggregator spreads all four
 * modules into one map either way.
 *
 * ─── THE CONTRACT EVERY PLACEHOLDER HERE MEETS ─────────────────────────────
 *
 * Three coordinated edits make an island type real, and this file is one of
 * them (see `src/presentation/utils/island-component-types.ts`, which states
 * the other two). The markup below must carry:
 *
 *  - `data-island="<type>"` — the marker the client script discovers. It has to
 *    be a LITERAL at the emitting JSX, which is why each renderer below writes
 *    its own `<div>` rather than sharing one wrapper component. Factoring the
 *    marker out and passing the name as a prop was tried first and is exactly
 *    what `check-island-drift.ts` refuses: it resolves these statically and
 *    fails on a name it cannot read, because an emitter the walk cannot see is
 *    an island name it can never flag — and worse, it turns a live island into
 *    a false "orphaned key" finding that reads as an invitation to delete
 *    working code.
 *  - `data-island-props` — the props, JSON-encoded. Read off `component`, never
 *    off `rawProps`: a component's schema fields are siblings of `props`, not
 *    members of it, so a renderer reading `rawProps` alone hands the island an
 *    empty bag and the surface hydrates looking broken rather than failing.
 *
 * ─── AND WHAT THE SKELETON IS FOR ──────────────────────────────────────────
 *
 * Each renderer closes on `IslandSkeleton`, which reserves the box its island
 * will claim so the page settles once instead of twice. It is a COMPONENT and
 * therefore lives in its own module: this file exports a renderer map, and a
 * component declared beside it would make the module a mixed export.
 */

import { buildFilterExpression } from '@/presentation/design/filter-expression'
import {
  isOpenSpecimen,
  renderOpenDateRangePanel,
} from '@/presentation/render/resolve/open-specimen-markup'
import { IslandSkeleton } from './island-kit-skeleton'
import type { ComponentRenderer, DispatchableComponentType } from './component-dispatch-config'
import type { FilterBarCondition, FilterBarField } from '@/presentation/design/filter-expression'

/** The element props every placeholder threads onto its marker. */
interface MarkerProps {
  readonly id?: string
  readonly className?: string
  readonly testId?: string
}

/** Coerce `component` to the record shape the field lookups below expect. */
const asRecord = (component?: unknown): Record<string, unknown> =>
  (component ?? {}) as Record<string, unknown>

/** Read a component-level field, falling back to the author's `props` bag. */
const pick = (c: Record<string, unknown>, rawProps: unknown, key: string): unknown =>
  c[key] ?? (rawProps as Record<string, unknown> | undefined)?.[key]

/** Drop the keys the island has no use for, so the serialised bag stays small. */
const defined = (entries: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(entries).filter(([, value]) => value !== undefined))

/** Marker props, read once per renderer. */
const markerOf = (elementProps: Record<string, unknown>): MarkerProps =>
  defined({
    id: elementProps['id'],
    className: elementProps['className'],
    testId: elementProps['data-testid'],
  }) as MarkerProps

const richTextEditorComponent: ComponentRenderer = ({ component, rawProps, elementProps }) => {
  const c = asRecord(component)
  const props = defined({
    label: pick(c, rawProps, 'label'),
    name: pick(c, rawProps, 'name'),
    value: pick(c, rawProps, 'value'),
    toolbar: pick(c, rawProps, 'toolbar'),
    placeholder: pick(c, rawProps, 'placeholder'),
    maxLength: pick(c, rawProps, 'maxLength'),
    imageBucket: pick(c, rawProps, 'imageBucket'),
  })
  const marker = markerOf(elementProps)
  return (
    <div
      id={marker.id}
      className={marker.className}
      data-testid={marker.testId}
      data-island="rich-text-editor"
      data-island-props={JSON.stringify(props)}
    >
      <IslandSkeleton
        label={props['label'] as string | undefined}
        minHeight="6em"
      />
    </div>
  )
}

const codeEditorComponent: ComponentRenderer = ({ component, rawProps, elementProps }) => {
  const c = asRecord(component)
  const props = defined({
    label: pick(c, rawProps, 'label'),
    name: pick(c, rawProps, 'name'),
    value: pick(c, rawProps, 'value'),
    language: pick(c, rawProps, 'language'),
    lineNumbers: pick(c, rawProps, 'lineNumbers'),
    readOnly: pick(c, rawProps, 'readOnly'),
    tabSize: pick(c, rawProps, 'tabSize'),
    minLines: pick(c, rawProps, 'minLines'),
    maxLines: pick(c, rawProps, 'maxLines'),
  })
  // The box the loaded editor will claim, so a form carrying one settles once.
  // `minLines` is the author's own floor; 6em is what the editor defaults to.
  const { minLines } = props
  const marker = markerOf(elementProps)
  return (
    <div
      id={marker.id}
      className={marker.className}
      data-testid={marker.testId}
      data-island="code-editor"
      data-island-props={JSON.stringify(props)}
    >
      <IslandSkeleton
        label={props['label'] as string | undefined}
        minHeight={typeof minLines === 'number' ? `${String(minLines * 1.5)}em` : '6em'}
        mono
      />
    </div>
  )
}

const dateRangePickerComponent: ComponentRenderer = ({ component, rawProps, elementProps }) => {
  const c = asRecord(component)
  const props = defined({
    label: pick(c, rawProps, 'label'),
    name: pick(c, rawProps, 'name'),
    value: pick(c, rawProps, 'value'),
    placeholder: pick(c, rawProps, 'placeholder'),
    dateFormat: pick(c, rawProps, 'dateFormat'),
    minDate: pick(c, rawProps, 'minDate'),
    maxDate: pick(c, rawProps, 'maxDate'),
    months: pick(c, rawProps, 'months'),
    presets: pick(c, rawProps, 'presets'),
  })
  const marker = markerOf(elementProps)
  // The design-system console's `open` state cell. Route A, like
  // `date-picker`: the panel is already an inline subtree, so the drawing is
  // the island's own `RangePanel` with the dialog role and the floating
  // position withheld. The island marker goes with it — a hydrated picker
  // would swap this subtree for a CLOSED trigger under a cell labelled `open`.
  const openPanelHtml = isOpenSpecimen(rawProps)
    ? renderOpenDateRangePanel({
        label: props['label'] as string | undefined,
        value: props['value'] as string | undefined,
        minDate: props['minDate'] as string | undefined,
        maxDate: props['maxDate'] as string | undefined,
        months: props['months'] === 1 ? 1 : 2,
        presets: Array.isArray(props['presets']) ? (props['presets'] as string[]) : undefined,
      })
    : undefined
  return (
    <div
      id={marker.id}
      className={marker.className}
      data-testid={marker.testId}
      data-island={openPanelHtml === undefined ? 'date-range-picker' : undefined}
      data-island-props={openPanelHtml === undefined ? JSON.stringify(props) : undefined}
      data-specimen-open={openPanelHtml === undefined ? undefined : 'true'}
    >
      <IslandSkeleton
        label={props['label'] as string | undefined}
        minHeight="2.25em"
      />
      {openPanelHtml !== undefined && (
        // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- one-time SSR markup emission
        <div dangerouslySetInnerHTML={{ __html: openPanelHtml }} />
      )}
    </div>
  )
}

/**
 * The expression a bar OPENS on, in the exact JSON the mounted island will
 * publish.
 *
 * Through the same builder the island uses, never a second encoder: a
 * subscriber that reads this element and one that catches the island's event
 * must arrive at the same filter, and two encoders agreeing today is not a
 * property either of them holds.
 *
 * `''` for a bar that opens on nothing — the value the DOM reader already skips,
 * so an unfiltered bar contributes nothing rather than an empty filter.
 */
const openingExpression = (conditions: unknown, fields: unknown, combinator: unknown): string =>
  buildFilterExpression(
    Array.isArray(conditions) ? (conditions as readonly FilterBarCondition[]) : [],
    Array.isArray(fields) ? (fields as readonly FilterBarField[]) : [],
    combinator === 'or' ? 'or' : 'and'
  )

/**
 * `filter-bar` — and its SSR placeholder publishes, which no other placeholder
 * here does.
 *
 * The island holds its current expression in a hidden input carrying
 * `data-publishes-bind-to` + `data-publishes-param`, and `useSharedFilter` reads
 * that element at MOUNT. That second channel exists for a race the event
 * channel cannot win: the bar's chunk is a few KB and a data-table's is several
 * hundred, so the bar publishes its opening conditions before the grid's
 * listener exists — essentially always, not occasionally. A grid that missed the
 * event then shows everything under a chip that says "Status is Paid".
 *
 * Which means the element has to be in the SERVED DOCUMENT, not only in the
 * hydrated island: a subscriber mounting before the bar hydrates finds nothing
 * to read otherwise, and that is the exact moment the channel was written for.
 * Rendering it here costs one hidden input and closes the window completely.
 */
const filterBarComponent: ComponentRenderer = ({ component, rawProps, elementProps }) => {
  const c = asRecord(component)
  const publishes = asRecord(pick(c, rawProps, 'publishes'))
  const props = defined({
    // Flattened: the island takes the channel, not the declaration that wraps
    // it. `publishes` exists in the schema so a reader can see WHAT the key is
    // for; the island only ever needs the string.
    bindTo: publishes['bindTo'],
    fields: pick(c, rawProps, 'fields'),
    conditions: pick(c, rawProps, 'conditions'),
    combinator: pick(c, rawProps, 'combinator'),
    allowAdd: pick(c, rawProps, 'allowAdd'),
  })
  const marker = markerOf(elementProps)
  return (
    <div
      id={marker.id}
      className={marker.className}
      data-testid={marker.testId}
      data-island="filter-bar"
      data-island-props={JSON.stringify(props)}
    >
      <IslandSkeleton minHeight="2.25em" />
      {/* The late-join capture, in the SERVED document. See the note above
          `filterBarComponent` for why a skeleton alone is not enough. */}
      {typeof props['bindTo'] === 'string' && props['bindTo'] !== '' && (
        <input
          type="hidden"
          readOnly
          data-publishes-bind-to={props['bindTo']}
          data-publishes-param="filter"
          value={openingExpression(props['conditions'], props['fields'], props['combinator'])}
        />
      )}
    </div>
  )
}

/** The four kit-addition island placeholders, spread into `islandComponents`. */
export const islandKitComponents: Partial<Record<DispatchableComponentType, ComponentRenderer>> = {
  'rich-text-editor': richTextEditorComponent,
  'code-editor': codeEditorComponent,
  'date-range-picker': dateRangePickerComponent,
  'filter-bar': filterBarComponent,
}
