/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { renderToString } from 'react-dom/server'
import { answeredNatively } from '@/domain/models/app/forms/submission-ledger-service'
import { SCOPED_VAR_CHAIN_SOURCE } from '@/domain/models/app/pages/substitute-record-vars'
import { resolveOnSuccessText } from './form-runtime-i18n'
import type { App } from '@/domain/models/app'
import type { Form } from '@/domain/models/app/forms'

/**
 * A success-page text drawn on the server, where no submission answer is at
 * hand: each submit-time token (`$record.*`, `$form.*`, `$submission.*`)
 * collapses to nothing, as an unresolved one does in the browser, and an
 * escaped token prints itself.
 */
const withoutSubmitTokens = (text: string): string =>
  text.replace(
    // eslint-disable-next-line sovrium/no-dynamic-regexp -- the engine's own token grammar, exported as source for the browser runtime; no outside text reaches it
    new RegExp(SCOPED_VAR_CHAIN_SOURCE, 'g'),
    (match, escaped: string | undefined) => (escaped === undefined ? '' : match.slice(1))
  )

/**
 * The success page a form posted without JavaScript is answered with, drawn
 * in place of the form when its page is requested back with
 * `?submitted=<form name>` — or `undefined`, and the form is drawn as usual.
 *
 * The same block the browser runtime draws: a status message whose title can
 * take the focus, the title and message resolved for the page language.
 */
export function renderNativeSuccessPage(
  app: Readonly<App>,
  form: Readonly<Form>,
  context: {
    readonly query?: Readonly<Record<string, string>> | undefined
    readonly activeLang?: string | undefined
    readonly titleAs: 'h1' | 'h2' | 'h3'
  }
): string | undefined {
  if (form.onSuccess === undefined || !answeredNatively(form, context.query)) return undefined
  const success = resolveOnSuccessText(form.onSuccess, app.languages, context.activeLang) as {
    readonly title?: string
    readonly message?: string
  }
  const Title = context.titleAs
  return renderToString(
    <section
      data-form-success={form.name}
      role="status"
      className="form-success-page"
    >
      {success.title === undefined ? undefined : (
        <Title tabIndex={-1}>{withoutSubmitTokens(success.title)}</Title>
      )}
      {success.message === undefined ? undefined : <p>{withoutSubmitTokens(success.message)}</p>}
    </section>
  )
}
