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
 * Compose the wrapper `<div>`'s `className`: `embedded-form`, an optional
 * `embedded-form--<variant>` token, then the host component's `props.className`.
 *
 * The wrapper is the element that names the component and holds the form's
 * title, so the author's className lands here, once: a column width or padding
 * frames the title and the form together, and an author selector reaches the
 * title. The inner `<form>` is laid out through `classes.parts.body` instead.
 *
 * The base `embedded-form` class is always present so application stylesheets
 * can target the wrapper unconditionally; the per-variant suffix lets authors
 * style `props.variant: 'compact'` differently from `props.variant: 'wide'`.
 */
function composeWrapperClass(variant: unknown, className: unknown): string {
  return [
    'embedded-form',
    typeof variant === 'string' ? `embedded-form--${variant}` : undefined,
    typeof className === 'string' && className.trim() !== '' ? className.trim() : undefined,
  ]
    .filter((token) => token !== undefined)
    .join(' ')
}

/**
 * Build the synthesized prop bag for the `customHTML` wrapper. Carries
 * pass-through cosmetic attributes (`id`, `className`, `data-testid`) and synthesised
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
    className: composeWrapperClass(variant, originalProps?.['className']),
    'data-form-ref': formRef,
    ...(typeof variant === 'string' ? { 'data-variant': variant } : {}),
    ...(typeof testId === 'string' ? { 'data-testid': testId } : {}),
  }
}
