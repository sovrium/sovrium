/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { carryToast } from '@/presentation/design/carried-toast'

/**
 * The composable head of a form's success, run before its primary `type`
 * (`applyOnSuccess`), in the order every page action follows: the toast, then
 * the dialog the form sits in.
 *
 * - `onSuccess.toast`, beside any `type`, is shown first — and when the type
 *   is a redirect to another page of this site, it is carried there and shown
 *   once as that page loads (`design/carried-toast.ts`, inlined below by
 *   `String(carryToast)` and bound with `var`, as the pending fragment binds
 *   `beginPending`).
 * - A form that writes a record (`submitTo.table`) tells the page so: it
 *   dispatches the same `sovrium:crud-success` event a record form does, so a
 *   grid reading that table re-reads. Dispatched from the form, it bubbles
 *   through the dialog holding it, which closes — unless `onSuccess.close` is
 *   `false`, when it is dispatched from the document instead, carrying
 *   `close: false`: the grids still hear it, the dialog stays open for the next
 *   entry, and so does a quick-edit drawer that closes itself on a write.
 * - `onSuccess.close: true` closes the dialog even when no table is written,
 *   by the bubbling `sovrium:close-dialog` request every overlay matches
 *   against its own panel.
 *
 * Assumes the surrounding IIFE provides `form`, `config`, `onSuccess`,
 * `interpolate`, `renderToast` and `leavesPage`.
 */
export const FORM_RUNTIME_RECORD_WRITTEN_SCRIPT = `
  var carryToast = ${String(carryToast)}
  function redirectsOnThisSite(response) {
    if (onSuccess.type !== 'redirect') return false
    var url = interpolate(onSuccess.url || '/', response, true)
    return new URL(url, window.location.href).origin === window.location.origin && leavesPage(url)
  }
  function announceRecordWritten(body, response) {
    var toast = onSuccess.toast
    if (toast && toast.message) {
      var said = interpolate(toast.message, response)
      renderToast(said, toast.variant)
      if (redirectsOnThisSite(response)) {
        carryToast({ message: said, variant: toast.variant || 'success', duration: toast.duration })
      }
    }
    if (config.table) {
      var written = { table: config.table, operation: 'create' }
      if (body.linkedRecordId) written.recordId = String(body.linkedRecordId)
      if (onSuccess.close === false) written.close = false
      var from = onSuccess.close === false ? document : form
      from.dispatchEvent(new CustomEvent('sovrium:crud-success', { bubbles: true, detail: written }))
    } else if (onSuccess.close === true) {
      form.dispatchEvent(new CustomEvent('sovrium:close-dialog', { bubbles: true }))
    }
  }
`
