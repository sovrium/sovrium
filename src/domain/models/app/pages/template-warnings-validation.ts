/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The warnings `app.components` earns without being refused.
 *
 * Two, each a config that is valid and still almost certainly not what its
 * author meant:
 *
 * 1. A template named with the `console-` prefix. The operator console names
 *    its own templates that way, and where both are drawn — the Design System's
 *    Components pages, with the console mounted — the console's chrome always
 *    keeps its own, so the name buys the operator nothing but a confusing pair.
 * 2. `guidance` on a transparent template. A transparent template is never
 *    listed on the Design System pages, so its guidance is drawn nowhere.
 *
 * Warnings, not refusals: both configs keep validating and booting.
 */

/** One warning, worded for the person who wrote the config. */
export interface TemplateWarning {
  readonly message: string
}

/** The prefix the operator console's own templates are named with. */
export const RESERVED_TEMPLATE_PREFIX = 'console-'

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** The warnings one template earns. */
const warningsOf = (template: Readonly<Record<string, unknown>>): readonly TemplateWarning[] => {
  const { name } = template
  if (typeof name !== 'string') return []
  const reserved = name.startsWith(RESERVED_TEMPLATE_PREFIX)
    ? [
        {
          message: `components: template '${name}' is named with the prefix '${RESERVED_TEMPLATE_PREFIX}', which is reserved for the operator console's own templates. It still validates; rename it so it is never confused with a piece of the console.`,
        },
      ]
    : []
  const silentGuidance =
    template['render'] === 'transparent' && template['guidance'] !== undefined
      ? [
          {
            message: `components: template '${name}' is transparent and declares guidance, which is drawn nowhere: a transparent template is not listed on the Design System pages. Remove the guidance, or drop render: transparent.`,
          },
        ]
      : []
  return [...reserved, ...silentGuidance]
}

/**
 * Every template warning a raw config earns, in declaration order.
 *
 * @param config - The config as parsed, before it is decoded
 * @returns One warning per finding; empty when there is none
 */
export const collectTemplateWarnings = (config: unknown): readonly TemplateWarning[] => {
  if (!isRecord(config) || !Array.isArray(config['components'])) return []
  return (config['components'] as readonly unknown[]).flatMap((template) =>
    isRecord(template) ? warningsOf(template) : []
  )
}
