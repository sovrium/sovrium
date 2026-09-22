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
import { isBadgeEnabled } from '@/domain/models/app/badge'
import { DemoNotice } from '@/presentation/render/page/demo-notice'
import { SovriumBadge } from '@/presentation/render/page/sovrium-badge'
import type { App } from '@/domain/models/app'
import type { Form } from '@/domain/models/app/forms'

/**
 * Reason a form is closed, surfaced to the closed-page renderer so the
 * default copy can distinguish "not yet open" from "closed/expired".
 */
export type ClosedReason = 'not-yet-open' | 'closed'

/**
 * Custom closed-page configuration (`availability.closedPage`). Optional —
 * when absent the renderer falls back to the form title + default copy.
 *
 * NOTE: `availability.closedPage` is not yet part of `FormAvailabilitySchema`;
 * this shape is read defensively off the form so the renderer is ready once
 * the schema field lands. Until then `closedPage` is always
 * undefined and only the default copy renders.
 */
interface ClosedPageConfig {
  readonly title?: string
  readonly message?: string
  readonly cta?: { readonly label?: string; readonly href?: string }
}

const resolveTitle = (title: Form['title']): string => (typeof title === 'string' ? title : 'Form')

const defaultCopy = (reason: ClosedReason, opensAt: string | undefined): string => {
  if (reason === 'not-yet-open') {
    return opensAt
      ? `This form is not yet open. It opens at ${opensAt}.`
      : 'This form is not yet open.'
  }
  return 'This form is closed and no longer accepting submissions.'
}

function ClosedFormPage(props: {
  readonly form: Readonly<Form>
  readonly reason: ClosedReason
  readonly opensAt: string | undefined
  readonly closedPage: ClosedPageConfig | undefined
  readonly badgeEnabled: boolean
}): React.JSX.Element {
  const { form, reason, opensAt, closedPage, badgeEnabled } = props
  const title = closedPage?.title ?? resolveTitle(form.title)
  const message = closedPage?.message ?? defaultCopy(reason, opensAt)
  return (
    <html lang="en">
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
          {closedPage?.cta?.label && closedPage.cta.href && (
            <a href={closedPage.cta.href}>{closedPage.cta.label}</a>
          )}
        </main>
        {/* Closed-form documents are hardcoded lang="en"; the badge follows
            with its English label (graceful fallback). */}
        {badgeEnabled && <SovriumBadge />}
        {/* Closed-form documents are hardcoded lang="en"; the notice follows
            with its English copy (graceful fallback), same as the badge. */}
        <DemoNotice />
      </body>
    </html>
  )
}

/**
 * Render the closed-form HTML document. Shows a custom `closedPage` block
 * when configured, otherwise the form title + default "not yet open" /
 * "closed" copy. Backs the GET `/forms/:name` response when the form's
 * availability window has not yet opened or has already closed.
 */
export function renderClosedFormPage(
  app: Readonly<App>,
  form: Readonly<Form>,
  reason: ClosedReason,
  opensAt?: string
): string {
  const closedPage = (form.availability as { readonly closedPage?: ClosedPageConfig } | undefined)
    ?.closedPage
  const html = renderToString(
    <ClosedFormPage
      form={form}
      reason={reason}
      opensAt={opensAt}
      closedPage={closedPage}
      badgeEnabled={isBadgeEnabled(app.badge)}
    />
  )
  return `<!DOCTYPE html>\n${html}`
}
