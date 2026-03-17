/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Client-Side Runtime Entry Point
 *
 * This is the main entry point for client-side JavaScript, bundled via Bun.build()
 * and served at /assets/client.js. It provides the interactive runtime that
 * enables forms, modals, CRUD operations, and other dynamic page features.
 *
 * Architecture:
 * - Server renders static HTML via renderToString() (DynamicPage.tsx)
 * - This script enhances the static HTML with interactivity
 * - Uses progressive enhancement: pages work without JS, JS adds rich interactions
 *
 * Features enabled:
 * - Form submission (auth login/signup, CRUD create/update/delete)
 * - Modal open/close lifecycle
 * - Toast notifications
 * - Conditional visibility (show/hide based on auth state)
 * - Debounced search inputs
 * - Dropdown menus
 */

// NOTE: CRUD routes (POST, PATCH, DELETE) don't have zValidator middleware yet,
// so Hono RPC doesn't type their request bodies. Using fetch() until validators are added.
// When zValidator('json', ...) is added to record-routes.ts, migrate to createRecordsClient().

/**
 * Read page configuration from the server-rendered data attribute
 */
function getPageConfig(): Record<string, unknown> | undefined {
  const configEl = document.querySelector('[data-page-config]')
  if (!configEl) return undefined
  try {
    return JSON.parse(configEl.getAttribute('data-page-config') || '{}')
  } catch {
    return undefined
  }
}

/**
 * Initialize the client-side runtime
 *
 * Sets up event delegation for interactive elements and
 * dispatches actions based on data attributes.
 */
function initClientRuntime(): void {
  const config = getPageConfig()

  // Set up form submission handlers
  document.querySelectorAll('form[data-action-type]').forEach((form) => {
    form.addEventListener('submit', (event) => {
      event.preventDefault()
      const formEl = event.currentTarget as HTMLFormElement
      const actionType = formEl.getAttribute('data-action-type')
      const actionMethod = formEl.getAttribute('data-action-method')
      const formData = new FormData(formEl)

      dispatchAction({
        type: actionType || 'unknown',
        method: actionMethod || 'submit',
        data: Object.fromEntries(formData),
        element: formEl,
        config,
      })
    })
  })

  // Set up modal triggers
  document.querySelectorAll('[data-modal-trigger]').forEach((trigger) => {
    trigger.addEventListener('click', () => {
      const modalId = trigger.getAttribute('data-modal-trigger')
      if (modalId) openModal(modalId)
    })
  })

  // Set up modal close handlers (backdrop + escape)
  document.querySelectorAll('[role="dialog"]').forEach((dialog) => {
    const backdrop = dialog.parentElement?.querySelector('[data-backdrop]')
    if (backdrop) {
      backdrop.addEventListener('click', () => {
        closeModal(dialog as HTMLElement)
      })
    }
  })

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      const openDialog = document.querySelector('[role="dialog"]:not([hidden])')
      if (openDialog) closeModal(openDialog as HTMLElement)
    }
  })
}

/**
 * Open a modal by ID
 */
function openModal(modalId: string): void {
  const modal = document.getElementById(modalId)
  if (!modal) return
  const dialog = modal.querySelector('[role="dialog"]') || modal
  dialog.removeAttribute('hidden')
  dialog.setAttribute('aria-hidden', 'false')
  // Focus the first focusable element inside the dialog
  const focusable = dialog.querySelector<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  )
  focusable?.focus()
}

/**
 * Close a modal element
 */
function closeModal(dialog: HTMLElement): void {
  dialog.setAttribute('hidden', '')
  dialog.setAttribute('aria-hidden', 'true')
}

/**
 * Show a toast notification
 */
function showToast(message: string, variant: 'success' | 'error' | 'info' = 'info'): void {
  const toast = document.createElement('div')
  toast.setAttribute('role', 'alert')
  toast.setAttribute('data-toast', variant)
  toast.className = `toast toast-${variant}`
  toast.textContent = message

  const container = document.querySelector('[data-toast-container]') || document.body
  container.appendChild(toast)

  // Auto-dismiss after 5 seconds
  setTimeout(() => {
    toast.remove()
  }, 5000)
}

type ActionPayload = {
  readonly type: string
  readonly method: string
  readonly data: Record<string, FormDataEntryValue>
  readonly element: HTMLElement
  readonly config: Record<string, unknown> | undefined
}

/**
 * Dispatch an action based on form data-action-type
 *
 * Routes to the appropriate handler based on action type:
 * - 'auth': Login, signup, password reset → calls Better Auth API
 * - 'crud': Create, update, delete → calls table API
 * - 'filter': Search, sort, filter → updates query params
 */
async function dispatchAction(payload: ActionPayload): Promise<void> {
  const { type, method, data, element } = payload
  const submitButton = element.querySelector('button[type="submit"]') as HTMLButtonElement | null

  // Disable form during submission
  if (submitButton) submitButton.disabled = true

  try {
    switch (type) {
      case 'auth':
        await handleAuthAction(method, data, element)
        break
      case 'crud':
        await handleCrudAction(method, data, element)
        break
      case 'filter':
        handleFilterAction(method, data)
        break
      default:
        console.warn(`[sovrium] Unknown action type: ${type}`)
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'An error occurred'
    showToast(message, 'error')

    // Display error on form
    const errorEl = element.querySelector('[data-error]')
    if (errorEl) errorEl.textContent = message
  } finally {
    if (submitButton) submitButton.disabled = false
  }
}

/**
 * Validate auth form fields before submission.
 * Throws an Error with a user-facing message if validation fails.
 *
 * @param method - Auth method (login, signup, password-reset)
 * @param data - Form data entries
 */
function validateAuthFields(
  method: string,
  data: Readonly<Record<string, FormDataEntryValue>>
): void {
  const email = (data.email as string) ?? ''
  const password = (data.password as string) ?? ''

  if (!email || !email.includes('@')) {
    throw new Error('Please enter a valid email address')
  }
  if (!password) {
    throw new Error('Password is required')
  }
  if (method === 'signup' && password.length < 8) {
    throw new Error('Password must be at least 8 characters')
  }
}

/**
 * Handle auth actions (login, signup, password-reset)
 */
async function handleAuthAction(
  method: string,
  data: Record<string, FormDataEntryValue>,
  element: HTMLElement
): Promise<void> {
  validateAuthFields(method, data)

  // For signup, derive name from email if not provided
  const payload =
    method === 'signup' && !data.name
      ? { ...data, name: (data.email as string).split('@')[0] }
      : data

  const endpointMap: Record<string, string> = {
    login: '/api/auth/sign-in/email',
    signup: '/api/auth/sign-up/email',
    'password-reset': '/api/auth/request-password-reset',
  }

  const endpoint = endpointMap[method]
  if (!endpoint) throw new Error(`Unknown auth method: ${method}`)

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.message || `Authentication failed`)
  }

  // Handle onSuccess
  const redirectPath = element.getAttribute('data-on-success-redirect')
  const toastMessage = element.getAttribute('data-on-success-toast')

  // Safe: showToast uses element.textContent (not innerHTML), so DOM text is never parsed as HTML.
  if (toastMessage) showToast(toastMessage, 'success') // lgtm[js/xss-through-dom]
  if (redirectPath && redirectPath.startsWith('/')) window.location.href = redirectPath
}

/**
 * Handle CRUD actions (create, update, delete)
 *
 * Uses raw fetch() because record mutation routes (POST, PATCH, DELETE) don't have
 * zValidator('json', ...) middleware yet. Once typed validators are added to
 * record-routes.ts, these can migrate to the Hono RPC client pattern.
 */
async function handleCrudAction(
  method: string,
  data: Record<string, FormDataEntryValue>,
  element: HTMLElement
): Promise<void> {
  const table = element.getAttribute('data-action-table')
  if (!table) throw new Error('CRUD action requires data-action-table')

  const httpMethodMap: Record<string, string> = {
    create: 'POST',
    update: 'PATCH',
    delete: 'DELETE',
  }

  const httpMethod = httpMethodMap[method] || 'POST'
  const recordId = element.getAttribute('data-action-record-id')
  const basePath = `/api/tables/${table}/records`
  const url = recordId ? `${basePath}/${recordId}` : basePath

  const response = await fetch(url, {
    method: httpMethod,
    headers: { 'Content-Type': 'application/json' },
    body: httpMethod !== 'DELETE' ? JSON.stringify(data) : undefined,
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new Error(body.message || `${method} operation failed`)
  }

  // Handle onSuccess
  const redirectPath = element.getAttribute('data-on-success-redirect')
  const toastMessage = element.getAttribute('data-on-success-toast')

  // Safe: showToast uses element.textContent (not innerHTML), so DOM text is never parsed as HTML.
  if (toastMessage) showToast(toastMessage, 'success') // lgtm[js/xss-through-dom]
  if (redirectPath && redirectPath.startsWith('/')) window.location.href = redirectPath
}

/**
 * Apply search filter parameters to URL
 */
function applySearchFilter(url: URL, data: Record<string, FormDataEntryValue>): void {
  const query = String(data.q || data.query || '')
  if (query) {
    url.searchParams.set('q', query)
  } else {
    url.searchParams.delete('q')
  }
  url.searchParams.set('page', '1')
}

/**
 * Apply sort filter parameters to URL
 */
function applySortFilter(url: URL, data: Record<string, FormDataEntryValue>): void {
  const sortBy = String(data.sortBy || '')
  const sortOrder = String(data.sortOrder || 'asc')
  if (sortBy) {
    url.searchParams.set('sortBy', sortBy)
    url.searchParams.set('sortOrder', sortOrder)
  }
}

/**
 * Handle filter actions (search, sort, paginate)
 */
function handleFilterAction(method: string, data: Record<string, FormDataEntryValue>): void {
  const url = new URL(window.location.href)

  switch (method) {
    case 'search':
      applySearchFilter(url, data)
      break
    case 'sort':
      applySortFilter(url, data)
      break
    case 'paginate':
      url.searchParams.set('page', String(data.page || '1'))
      break
    default:
      console.warn(`[sovrium] Unknown filter method: ${method}`)
      return
  }

  window.location.href = url.toString()
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initClientRuntime)
} else {
  initClientRuntime()
}
