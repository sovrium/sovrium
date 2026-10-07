/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The layout-intent keys a data component's island reads, per type: how big a
 * KPI's value is drawn and in which tone, whether a gallery leads with a
 * featured card, whether a donut writes its slice labels, how tall a month
 * view's day is at the least.
 *
 * Lifted as one group at the builder's single exit rather than one line per
 * entry: the builder sits at its size cap, and these keys are forwarded
 * verbatim — a key the type does not declare is simply absent.
 */
const LAYOUT_INTENT_KEYS: Readonly<Record<string, readonly string[]>> = {
  gallery: ['featured'],
  kpi: ['size', 'tone'],
  chart: ['dataLabels'],
  calendar: ['dayMinHeight'],
}

/**
 * The declared layout-intent keys of one component, ready to spread onto its
 * element props.
 *
 * @param type - The component type.
 * @param component - The (substituted) component node.
 */
export const layoutIntentProps = (
  type: string,
  component: object
): Readonly<Record<string, unknown>> =>
  Object.fromEntries(
    (LAYOUT_INTENT_KEYS[type] ?? []).flatMap((key) => {
      const value = (component as Readonly<Record<string, unknown>>)[key]
      return value === undefined ? [] : [[key, value]]
    })
  )
