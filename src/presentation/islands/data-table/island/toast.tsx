/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


function ensureToasterContainer(): Element {
  const existing = document.querySelector('[data-sonner-toaster]')
  if (existing) return existing
  const container = document.createElement('div')
  container.setAttribute('data-sonner-toaster', '')
  container.setAttribute('role', 'status')
  container.setAttribute('aria-live', 'polite')
  const el = container as HTMLElement
  el.style.position = 'fixed'
  el.style.bottom = '16px'
  el.style.right = '16px'
  el.style.zIndex = '9999'
  el.style.display = 'flex'
  el.style.flexDirection = 'column'
  el.style.gap = '8px'
  document.body.appendChild(container)
  return container
}

export function renderToast(message: string, variant?: string): void {
  if (typeof document === 'undefined') return
  const container = ensureToasterContainer()
  const toast = document.createElement('div')
  toast.setAttribute('data-toast', '')
  if (variant) toast.setAttribute('data-variant', variant)
  toast.textContent = message
  container.appendChild(toast)
}
