/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Toast helper for the data-table island.
 *
 * Mirrors the structure used by `src/presentation/client.ts#showToast` so
 * automation/CRUD success messages share the same DOM contract:
 * `<div data-sonner-toaster role=status><div data-toast data-variant>...</div></div>`.
 * Test assertions like `getByText('Order Shipped')` find the inner div.
 */

function ensureToasterContainer(): Element {
  const existing = document.querySelector('[data-sonner-toaster]')
  if (existing) return existing
  const container = document.createElement('div')
  container.setAttribute('data-sonner-toaster', '')
  container.setAttribute('role', 'status')
  container.setAttribute('aria-live', 'polite')
  /* eslint-disable functional/immutable-data -- DOM style mutation required for runtime toast injection */
  const el = container as HTMLElement
  el.style.position = 'fixed'
  el.style.bottom = '16px'
  el.style.right = '16px'
  el.style.zIndex = '9999'
  el.style.display = 'flex'
  el.style.flexDirection = 'column'
  el.style.gap = '8px'
  /* eslint-enable functional/immutable-data */
  document.body.appendChild(container)
  return container
}

export function renderToast(message: string, variant?: string): void {
  if (typeof document === 'undefined') return
  const container = ensureToasterContainer()
  const toast = document.createElement('div')
  toast.setAttribute('data-toast', '')
  if (variant) toast.setAttribute('data-variant', variant)
  /* eslint-disable-next-line functional/immutable-data -- textContent mutation required to render toast text */
  toast.textContent = message
  container.appendChild(toast)
}
