/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `record-picker` — the SSR half of the unbound picker.
 *
 * In its own module beside the other form controls rather than inline in
 * `island-form-components.tsx`, which is at its `max-lines` ceiling.
 *
 * Source: src/domain/models/app/pages/components/component-types/form-controls/record-picker.ts
 * Specs: [internal ref]
 */

import { asRecord, baseProps, pickFromComponent } from './island-form-props'
import type { ComponentRenderer } from './component-dispatch-config'
import type { ElemProps, RawProps } from './island-form-props'

/**
 * The `record-picker` island props.
 *
 * `dataSource` and the four behaviour flags are SCHEMA top-level fields
 * (siblings of `props`), so they go through the `pickFromComponent` lookup
 * contract documented above; `label` / `placeholder` are `props` entries, as on
 * every other form control.
 *
 * The `dataSource` travels WHOLE, `filter` included. That is the security
 * judgement `record-picker.ts` states rather than implies: a picker's whole
 * mechanism is a live query, so the table it names is visible in the browser —
 * and the filter is enforced by the ordinary records route on every candidate
 * read, not by the island, so a caller who edits the request cannot widen the
 * candidate set past it.
 */
function buildRecordPickerProps(rawProps: RawProps, elementProps: ElemProps, component?: unknown) {
  const c = asRecord(component)
  return {
    dataSource: pickFromComponent(c, rawProps, 'dataSource'),
    allowCreate: pickFromComponent(c, rawProps, 'allowCreate'),
    multiple: pickFromComponent(c, rawProps, 'multiple'),
    maxLinked: pickFromComponent(c, rawProps, 'maxLinked'),
    placeholder: pickFromComponent(c, rawProps, 'placeholder') ?? rawProps?.placeholder,
    readOnly: pickFromComponent(c, rawProps, 'readOnly'),
    label: rawProps?.label,
    ...baseProps(elementProps),
  }
}

export const recordPickerComponent: ComponentRenderer = ({ rawProps, elementProps, component }) => {
  const pickerProps = buildRecordPickerProps(rawProps, elementProps, component)
  return (
    <div
      id={elementProps.id as string | undefined}
      data-island="record-picker"
      data-island-props={JSON.stringify(pickerProps)}
      data-testid={elementProps['data-testid'] as string | undefined}
    >
      {/* The pre-hydration skeleton is deliberately INERT and carries no
          candidates. A picker inlines nothing — every row it can offer comes
          back from a search — so there is nothing honest to draw here but the
          shape of the control. */}
      <input
        type="text"
        disabled
        aria-label={(rawProps?.label as string | undefined) ?? 'Search records'}
        placeholder={pickerProps.placeholder as string | undefined}
        className="border-border bg-background text-foreground text-md w-full rounded-md border px-3 py-2"
      />
    </div>
  )
}
