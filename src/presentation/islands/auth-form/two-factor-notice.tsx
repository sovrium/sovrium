/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import {
  AUTH_ERROR_BANNER_STYLE,
  AUTH_NOTICE_LINK_CLASSES,
  computeAuthFeedbackBannerClasses,
  computeFormLayoutClasses,
} from '@/presentation/design/form-layout-classes'
import { resolveClasses } from '@/presentation/design/resolve-classes'

/**
 * What a code form says when no sign-in waits for its code, as the server
 * resolved it in the page language (`two-factor-notice.tsx` on the render side
 * draws the same markup before the island loads).
 */
export interface TwoFactorNotice {
  readonly message: string
  readonly linkLabel: string
  /** The sign-in page; absent, the notice carries no link. */
  readonly href?: string
  /** No sign-in waits on this page load: the notice replaces the field at once. */
  readonly shown: boolean
  /** A sign-in waits on a page of its own: the code field takes focus on load. */
  readonly focusCode?: boolean
}

/** The notice and its link back to the sign-in page, in the form's place. */
export function TwoFactorNoticeView(props: {
  readonly notice: TwoFactorNotice
  readonly id?: string
  readonly className?: string
  readonly 'data-testid'?: string
}): ReactElement {
  const { notice } = props
  return (
    <div
      id={props.id}
      data-testid={props['data-testid']}
      className={resolveClasses(computeFormLayoutClasses(), props.className)}
    >
      <p
        role="status"
        className={computeAuthFeedbackBannerClasses()}
        style={AUTH_ERROR_BANNER_STYLE}
      >
        {notice.message}
      </p>
      {notice.href === undefined ? undefined : (
        <a
          href={notice.href}
          className={AUTH_NOTICE_LINK_CLASSES}
        >
          {notice.linkLabel}
        </a>
      )}
    </div>
  )
}
