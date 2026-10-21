/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The request id a failure toast names, on the console: a toast leaves the
 * screen, so it carries the one thing an operator must quote — the request the
 * server error was answered under — with a control that copies it. Appended
 * after the message node, so the message keeps its own text
 * (`toast-accessibility.ts`), and before the Retry.
 *
 * Only a console grid's row action reaches it (`failureNote`), so the islands
 * that share the toast runtime do not pay for it.
 */

import { consoleRequestIdOf } from './console-request-id'

/** Append "<label> <id>" and the control that copies the id. */
function appendRequestId(toast: Element, id: string, label: string, copyLabel: string): void {
  const line = document.createElement('span')
  line.setAttribute('data-toast-request-id', '')
  const code = document.createElement('code')
  code.textContent = id
  line.append(`${label} `, code)
  const copy = document.createElement('button')
  copy.setAttribute('type', 'button')
  copy.setAttribute('data-toast-copy', '')
  copy.textContent = copyLabel
  copy.addEventListener('click', () => {
    void navigator.clipboard
      ?.writeText(id)
      .then(() => copy.setAttribute('data-copied', 'true'))
      .catch(() => undefined)
  })
  toast.append(line, copy)
}

/**
 * The note a failed write's toast carries on the console: the request id its
 * 5xx envelope names, in the page's `report.*` words (English where absent).
 */
export const consoleRequestNote =
  (words: Readonly<Record<string, string>> | undefined) =>
  (status: number, body: unknown): ((toast: Element) => void) | undefined => {
    const id = consoleRequestIdOf(status, body)
    if (id === undefined) return undefined
    const label = words?.['report.requestId'] ?? 'Request ID'
    const copyLabel = words?.['report.copyRequestId'] ?? 'Copy request ID'
    return (toast) => appendRequestId(toast, id, label, copyLabel)
  }
