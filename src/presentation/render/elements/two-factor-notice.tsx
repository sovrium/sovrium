/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { type ReactElement } from 'react'
import { resolveInterpreterString } from '@/domain/models/app/languages/translation-resolver'
import {
  AUTH_ERROR_BANNER_STYLE,
  AUTH_NOTICE_LINK_CLASSES,
  computeAuthFeedbackBannerClasses,
  computeFormLayoutClasses,
} from '@/presentation/design/form-layout-classes'
import { resolveClasses } from '@/presentation/design/resolve-classes'
import { omitInternalMarkers } from '../props/internal-marker-props'
import type { AuthFormAction } from './auth-form-action'
import type { ElementProps } from './html-element-renderer'
import type { Languages } from '@/domain/models/app/languages'

/**
 * What a code form says when no sign-in waits for its code — on page load
 * (`shown`), or once a submit finds the attempt lapsed — in the page language:
 * the notice, and its link back to the sign-in page.
 */
export interface TwoFactorNotice {
  readonly message: string
  readonly linkLabel: string
  /** The sign-in page; absent when the render could not read the app's (no link then). */
  readonly href?: string
  /** No sign-in waits on this page load: draw the notice instead of the field. */
  readonly shown: boolean
  /** A sign-in waits on a page of its own: the code field takes focus on load. */
  readonly focusCode?: boolean
}

/** The notice of a `verifyTwoFactor` form; `undefined` for every other method. */
export function twoFactorNoticeOf(
  method: string,
  action: AuthFormAction,
  localized: { readonly lang?: string; readonly languages?: Languages }
): TwoFactorNotice | undefined {
  if (method !== 'verifyTwoFactor') return undefined
  const { lang, languages } = localized
  const stamp = action._twoFactor
  return {
    message: resolveInterpreterString('twoFactor.attemptExpired', lang, languages),
    linkLabel: resolveInterpreterString('twoFactor.signInAgain', lang, languages),
    ...(stamp !== undefined && { href: stamp.loginPage }),
    shown: stamp?.expired === true,
    ...(stamp?.focusCode === true && { focusCode: true }),
  }
}

/**
 * The code form's place, drawn as the notice and its link instead of a field
 * nothing could check — the server's paint of what the island draws too.
 */
export function renderTwoFactorNotice(props: ElementProps, notice: TwoFactorNotice): ReactElement {
  const { 'data-component-type': _named, ...rest } = omitInternalMarkers(props)
  return (
    <div
      {...rest}
      className={resolveClasses(computeFormLayoutClasses(), props.className as string | undefined)}
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
