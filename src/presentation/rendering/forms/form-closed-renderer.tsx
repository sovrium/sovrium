/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { renderToString } from 'react-dom/server'
import { isBadgeEnabled } from '@/domain/models/app/badge'
import { SovriumBadge } from '@/presentation/ui/badge/sovrium-badge'
import { DemoNotice } from '@/presentation/ui/demo-notice/demo-notice'
import type { App } from '@/domain/models/app'
import type { Form } from '@/domain/models/app/forms'

export type ClosedReason = 'not-yet-open' | 'closed'

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
        {}
        {badgeEnabled && <SovriumBadge />}
        {}
        <DemoNotice />
      </body>
    </html>
  )
}

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
