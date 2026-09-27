/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/* eslint-disable react-refresh/only-export-components -- SSR-only closed-form
   page component co-located with its `renderClosedFormPage` serialisation
   helper; never participates in client-side HMR. Mirrors form-renderer.tsx. */

import { renderToString } from 'react-dom/server'
import { findDeclaredDirection } from '@/domain/models/app/languages/language-detection'
import { resolveBadge, type BadgePlacement } from '@/presentation/render/page/badge-placement'
import { DemoNotice } from '@/presentation/render/page/demo-notice'
import { SovriumBadge } from '@/presentation/render/page/sovrium-badge'
import { getFormClosedLabels } from './form-closed-labels'
import { resolveDocumentLang, resolveFormDensityStep, resolveText } from './form-field-resolver'
import type { App } from '@/domain/models/app'
import type { DensityStepName } from '@/domain/models/app/design'
import type { Form } from '@/domain/models/app/forms'
import type { Languages } from '@/domain/models/app/languages'

/**
 * Reason a form is closed, surfaced to the closed-page renderer so the
 * default copy can distinguish "not yet open" from "closed/expired".
 */
export type ClosedReason = 'not-yet-open' | 'closed'

/**
 * Custom closed-page configuration (`availability.closedPage`). Optional —
 * when absent the renderer falls back to the form title + default copy. Its
 * title, message and link label may be `$t:` keys; the link target is not.
 */
interface ClosedPageConfig {
  readonly title?: string
  readonly message?: string
  readonly cta?: { readonly label?: string; readonly href?: string }
}

/**
 * The engine's own sentence, in the document language (English and French
 * ship; any other language reads English).
 */
const defaultCopy = (
  reason: ClosedReason,
  opensAt: string | undefined,
  documentLang: string
): string => {
  const labels = getFormClosedLabels(documentLang)
  if (reason === 'not-yet-open') {
    return opensAt ? labels.notYetOpenAt(opensAt) : labels.notYetOpen
  }
  return labels.closed
}

/**
 * Where the closed page is asked for from: the requested `?lang=` (honoured
 * exactly as the open form honours it) and, for a form not yet open, the
 * instant it opens.
 */
export interface ClosedFormRequest {
  readonly activeLang?: string
  readonly opensAt?: string
}

/** A request that names neither a language nor an opening instant. */
const NO_REQUEST: ClosedFormRequest = {}

interface ClosedCopy {
  readonly title: string
  readonly message: string
  readonly ctaLabel: string
}

/**
 * The page's text in the document language: an authored `closedPage` wins,
 * each piece resolving a `$t:` key; otherwise the form's own title and the
 * engine's sentence. The link target is never translated.
 */
const resolveClosedCopy = (
  form: Readonly<Form>,
  reason: ClosedReason,
  closedPage: ClosedPageConfig | undefined,
  context: {
    readonly languages: Languages | undefined
    readonly request: ClosedFormRequest
    readonly documentLang: string
  }
): ClosedCopy => {
  const { languages, request, documentLang } = context
  const text = (value: string | undefined, fallback: string): string =>
    resolveText(value, languages, fallback, request.activeLang)
  const formTitle = typeof form.title === 'string' ? form.title : undefined
  return {
    title: text(closedPage?.title ?? formTitle, 'Form'),
    message: text(closedPage?.message, defaultCopy(reason, request.opensAt, documentLang)),
    ctaLabel: text(closedPage?.cta?.label, ''),
  }
}

function ClosedFormPage(props: {
  readonly form: Readonly<Form>
  readonly reason: ClosedReason
  readonly request: ClosedFormRequest
  readonly closedPage: ClosedPageConfig | undefined
  /** Where the badge sits; undefined when `badge: false` removes it. */
  readonly badgePlacement: BadgePlacement | undefined
  readonly languages: Languages | undefined
  /** The density step the document runs at — see `resolveFormDensityStep`. */
  readonly densityStep: DensityStepName
}): React.JSX.Element {
  const { form, reason, request, closedPage, badgePlacement, languages } = props
  // The language the visitor asked for (`?lang=`) when the app supports it,
  // else the app's default — the same choice the open form makes — and the
  // direction that language declares.
  const documentLang = resolveDocumentLang(languages, request.activeLang)
  const { title, message, ctaLabel } = resolveClosedCopy(form, reason, closedPage, {
    languages,
    request,
    documentLang,
  })
  const ctaHref = closedPage?.cta?.href
  return (
    <html
      lang={documentLang}
      dir={findDeclaredDirection(languages, documentLang)}
      data-density={props.densityStep}
    >
      <head>
        <meta charSet="UTF-8" />
        <title>{title}</title>
      </head>
      <body>
        <main
          className="form-closed"
          data-form-closed={reason}
        >
          <h1>{title}</h1>
          <p>{message}</p>
          {ctaLabel && ctaHref && <a href={ctaHref}>{ctaLabel}</a>}
        </main>
        {/* The badge and the notice follow the document's language; one with
            no copy of its own for it falls back to English. */}
        {badgePlacement !== undefined && (
          <SovriumBadge
            lang={documentLang}
            placement={badgePlacement}
          />
        )}
        <DemoNotice lang={documentLang} />
      </body>
    </html>
  )
}

/**
 * Render the closed-form HTML document. Shows a custom `closedPage` block
 * when configured, otherwise the form title + default "not yet open" /
 * "closed" copy. Backs the GET `/forms/:name` response when the form's
 * availability window has not yet opened or has already closed, in the
 * language of the request.
 */
export function renderClosedFormPage(
  app: Readonly<App>,
  form: Readonly<Form>,
  reason: ClosedReason,
  request: ClosedFormRequest = NO_REQUEST
): string {
  const closedPage = (form.availability as { readonly closedPage?: ClosedPageConfig } | undefined)
    ?.closedPage
  const html = renderToString(
    <ClosedFormPage
      form={form}
      reason={reason}
      request={request}
      closedPage={closedPage}
      badgePlacement={resolveBadge(app.badge)}
      languages={app.languages}
      densityStep={resolveFormDensityStep(app, form)}
    />
  )
  return `<!DOCTYPE html>\n${html}`
}
