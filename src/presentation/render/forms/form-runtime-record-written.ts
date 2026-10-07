/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A successful submit to a form that writes a record (`submitTo.table`) tells
 * the page so: it dispatches the same `sovrium:crud-success` event a record
 * form does, bubbling from the form, so a grid reading that table re-reads and
 * a dialog holding the form closes. Assumes the surrounding IIFE provides
 * `form` and `config`.
 */
export const FORM_RUNTIME_RECORD_WRITTEN_SCRIPT = `
  function announceRecordWritten(body) {
    if (!config.table) return
    var written = { table: config.table, operation: 'create' }
    if (body.linkedRecordId) written.recordId = String(body.linkedRecordId)
    form.dispatchEvent(new CustomEvent('sovrium:crud-success', { bubbles: true, detail: written }))
  }
`
