/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The `<div>` a `formRef` embed is drawn in: the host component's cosmetic
 * props carried over, plus the hooks an application stylesheet targets.
 */

/**
 * Compose the wrapper `<div>`'s `className`: `embedded-form` and an optional
 * `embedded-form--<variant>` token. The host component's `props.className`
 * is NOT here: it belongs to the `<form>` the wrapper holds, where it is merged
 * over the form's layout classes (`applyNodeFormParts`), as a page form's is.
 *
 * The base `embedded-form` class is always present so application stylesheets
 * can target the wrapper unconditionally; the per-variant suffix lets authors
 * style `props.variant: 'compact'` differently from `props.variant: 'wide'`.
 */
function composeWrapperClass(variant: unknown): string {
  const variantClass = typeof variant === 'string' ? `embedded-form--${variant}` : undefined
  return variantClass === undefined ? 'embedded-form' : `embedded-form ${variantClass}`
}

/**
 * Build the synthesized prop bag for the `customHTML` wrapper. Carries
 * pass-through cosmetic attributes (`id`, `data-testid`) and synthesised
 * data hooks (`data-form-ref`, optional `data-variant`).
 *
 * Returned as `Record<string, unknown>` and cast at the call site because
 * the `customHTML` schema does not declare `data-*` attributes — they pass
 * through React's `<div {...props}>` at render time without schema noise.
 */
export function buildWrapperProps(
  formRef: string,
  originalProps: Record<string, unknown> | undefined
): Record<string, unknown> {
  const variant = originalProps?.['variant']
  const id = originalProps?.['id']
  const testId = originalProps?.['data-testid']
  return {
    ...(typeof id === 'string' ? { id } : {}),
    className: composeWrapperClass(variant),
    'data-form-ref': formRef,
    ...(typeof variant === 'string' ? { 'data-variant': variant } : {}),
    ...(typeof testId === 'string' ? { 'data-testid': testId } : {}),
  }
}
