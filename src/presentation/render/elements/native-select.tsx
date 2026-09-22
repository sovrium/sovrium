/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { renderSsrSelectOptions } from './select-ssr-options'
import type { ReactElement } from 'react'

/**
 * The `select.native` rendering — the browser's own control, server-rendered
 * once and never replaced.
 *
 * **This is not a new renderer.** `island-form-components.tsx` already emitted
 * a real `<select>` carrying the resolved choices, and marked it `disabled`
 * only because an island was about to take its place. `native: true` is that
 * element left ENABLED, with no `data-island` marker beside it — so the control
 * costs no component code, works with scripting off, and answers a test
 * driver's `selectOption()` and a password manager alike.
 *
 * ─── WHY THE LABEL WRAPS THE CONTROL ────────────────────────────────────────
 *
 * An implicit label needs no `id` to associate, and `props.id` is optional on
 * every form control. An explicit `htmlFor` would therefore have to invent an
 * id for the unnamed case, and an invented id is one more thing that can
 * collide across two controls on a page. Nesting associates unconditionally.
 * The author's own `id` still lands on the `<select>` itself — the element IS
 * the control here, unlike the themed path where the id marks the island root.
 *
 * ─── WHY `publishes` IS A DATA ATTRIBUTE ────────────────────────────────────
 *
 * The shared-filter channel is a `document`-level `island:system-query` event,
 * and the publisher half is one line of DOM work. Mounting an island to make
 * that dispatch would give back the hydration this key exists to remove, so the
 * declaration rides on the element and the GLOBAL vanilla runtime
 * (`client.ts` → `setupNativeSelectPublishers`) binds the `change` listener —
 * the same seam a standalone action `button` already uses. The SUBSCRIBER half
 * reads these same two attributes at mount (`use-shared-filter.ts`), because a
 * control live from first paint can be used before any island exists.
 */
export interface NativeSelectProps {
  readonly options?: unknown
  readonly placeholder?: unknown
  readonly defaultValue?: unknown
  readonly multiple?: unknown
  readonly disabled?: unknown
  readonly label?: unknown
  readonly id?: unknown
  readonly className?: unknown
  readonly 'data-testid'?: unknown
  readonly publishes?: unknown
}

/** Utility tokens matching the themed control's resting surface. */
const CONTROL_CLASSES =
  'border-border bg-background-raised text-foreground w-full rounded-md border px-3 py-2 text-md shadow-sm'

const LABEL_CLASSES = 'text-foreground mb-1 block text-md font-medium'

/** Narrow an unknown field to a string, or drop it. */
function str(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

/**
 * A `multiple` select is uncontrolled with an ARRAY default; a single one takes
 * a scalar. Passing the wrong shape makes React drop the default in silence —
 * exactly the class of failure the removed `valueField` pair was.
 */
function toDefaultValue(defaultValue: unknown, multiple: boolean): string | string[] | undefined {
  if (defaultValue === undefined || defaultValue === null) return undefined
  if (!multiple) return String(defaultValue)
  return Array.isArray(defaultValue) ? defaultValue.map(String) : [String(defaultValue)]
}

/** The `{ bindTo, param }` pair, when the author declared a publisher. */
function publisherAttributes(publishes: unknown): Record<string, string | undefined> {
  const declaration = (publishes ?? {}) as { bindTo?: unknown; param?: unknown }
  return {
    'data-publishes-bind-to': str(declaration.bindTo),
    'data-publishes-param': str(declaration.param),
  }
}

/**
 * The DISABLED pre-hydration skeleton the themed control still renders.
 *
 * Kept beside the native rendering because they are the same markup with one
 * attribute between them — which is precisely what [internal ref] observed, and what
 * makes it cheap for the two to drift apart if they live in different files.
 * The hydrated trigger lives in `plain-select.tsx` / `searchable-select.tsx`
 * and is styled via the [internal ref] var-fallback recipe in
 * `select-default-classes.ts`; this skeleton uses theme-layer-emitted utility
 * tokens instead, because the component layer cannot import the islands-layer
 * recipe under the layer boundary rules.
 */
export function renderSsrSelectPlaceholder(props: NativeSelectProps): ReactElement {
  return (
    <select
      className={CONTROL_CLASSES}
      // NOT `str()`: `defaultValue` is `string | number | boolean` in the
      // schema, and narrowing to a string here would silently DROP a numeric or
      // boolean default that the pre-extraction renderer passed through.
      defaultValue={toDefaultValue(props.defaultValue, false)}
      disabled
    >
      {renderSsrSelectOptions(props.options, str(props.placeholder))}
    </select>
  )
}

/** Server-render the platform control, enabled, with its resolved choices. */
export function renderNativeSelect(
  props: NativeSelectProps,
  name: string | undefined
): ReactElement {
  const multiple = props.multiple === true
  const label = str(props.label)
  const control = (
    <select
      className={CONTROL_CLASSES}
      defaultValue={toDefaultValue(props.defaultValue, multiple)}
      multiple={multiple}
      disabled={props.disabled === true ? true : undefined}
      id={str(props.id)}
      name={name}
      data-testid={str(props['data-testid'])}
      {...publisherAttributes(props.publishes)}
    >
      {renderSsrSelectOptions(props.options, str(props.placeholder))}
    </select>
  )

  if (label === undefined || label.length === 0) {
    return <div className={str(props.className)}>{control}</div>
  }
  return (
    <label className={str(props.className)}>
      <span className={LABEL_CLASSES}>{label}</span>
      {control}
    </label>
  )
}
