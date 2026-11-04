/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveToastDismissName } from '@/presentation/render/page/page-toast-attributes'
import type { Languages } from '@/domain/models/app/languages'
import type { Page } from '@/domain/models/app/pages'
import type { ReactElement } from 'react'

/** Stable identity for the toast container's flex stack to satisfy react-perf. */
const TOAST_CONTAINER_STYLE = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  minHeight: '1px',
} as const

/**
 * Renders the toast container element when page.toasts is configured.
 *
 * The container is the page's ONE standing toast container, and no live region:
 * each toast is its own (`role="status"`, or `role="alert"` when urgent —
 * `islands/runtime/toast-accessibility.ts`), so a toast is announced once.
 *
 * `data-dismiss-label` is the server→client channel for the dismiss control's
 * accessible name. The renderers that build that control run in the browser and
 * cannot see the page's locale, so the locale-resolved word (renamable under
 * `sovrium.toast.dismiss`) is handed to them here — the same way every other
 * island label crosses that boundary.
 */
export function PageToastContainer({
  toasts,
  lang,
  languages,
}: {
  readonly toasts: NonNullable<Page['toasts']>
  readonly lang: string
  readonly languages: Languages | undefined
}): Readonly<ReactElement> {
  return (
    <div
      data-sonner-toaster=""
      data-toast-container=""
      data-dismiss-label={resolveToastDismissName(lang, languages)}
      {...(toasts.position !== undefined && { 'data-position': toasts.position })}
      style={TOAST_CONTAINER_STYLE}
    />
  )
}
