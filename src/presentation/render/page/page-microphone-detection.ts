/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { someComponentInTree } from '@/presentation/render/resolve/component-template-walker'
import type { App } from '@/domain/models/app'
import type { Form } from '@/domain/models/app/forms'
import type { Page } from '@/domain/models/app/pages'

/**
 * Microphone-capture detection, read from the author's CONFIG.
 *
 * A page records when it draws a `recordAudio` form field or a live
 * `voiceInput` chat. The Permissions-Policy grant that lets the browser open
 * the microphone (`presentation/api/runtime/microphone-permission.ts`) is
 * decided HERE, from the schema, and never by scanning the rendered HTML: a
 * record value, a rich-text body, or a query-string prefill echoed into an
 * input can put any string into the document, so a marker scan would let a
 * request-time value unlock the microphone on a page that never declared a
 * recorder.
 */

/** True when any field of the form declares an in-browser recorder. */
export const formRecordsAudio = (form: Readonly<Form>): boolean =>
  form.fields.some(
    (field) => (field as { readonly recordAudio?: unknown }).recordAudio !== undefined
  )

/**
 * True when one component node draws a recorder: a LIVE push-to-talk chat (a
 * design-system specimen never records), or a form/dialog embedding a
 * `formRef` form that declares `recordAudio`.
 */
const componentCapturesMicrophone = (
  node: Readonly<Record<string, unknown>>,
  forms: readonly Form[]
): boolean => {
  if (node['type'] === 'ai-chat') {
    const props = node['props'] as Readonly<Record<string, unknown>> | undefined
    return node['voiceInput'] !== undefined && props?.['specimen'] !== true
  }
  if (node['type'] !== 'form' && node['type'] !== 'dialog') return false
  const ref = node['formRef']
  if (typeof ref !== 'string') return false
  const form = forms.find((candidate) => candidate.name === ref)
  return form !== undefined && formRecordsAudio(form)
}

/**
 * True when the page that matched the request draws a recorder anywhere in its
 * tree, reference-expanded through `app.components` — the same walk the island
 * runtime detection uses, so a recorder that can hydrate is a recorder that is
 * granted. No matched page (the default homepage, a 404) never records.
 */
export const pageCapturesMicrophone = (
  page: Readonly<Page> | undefined,
  app: Readonly<App>
): boolean => {
  if (page === undefined) return false
  const forms = app.forms ?? []
  return someComponentInTree(page.components, app.components, (node) =>
    componentCapturesMicrophone(node, forms)
  )
}
