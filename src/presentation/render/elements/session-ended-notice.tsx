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
  computeAuthFeedbackBannerClasses,
} from '@/presentation/design/form-layout-classes'
import type { AuthFormAction, AuthFormRenderContext } from './auth-form-action'

/**
 * A sign-in form reached from a refused session (`action._sessionEnded`,
 * stamped by `session-ended-stamp.ts`), drawn with one sentence above it in the
 * page language: `auth.sessionEnded`, renamed under `sovrium.auth.sessionEnded`.
 *
 * The sentence sits BESIDE the form's island rather than inside it: the island
 * replaces what the server drew inside its host when it mounts, and the notice
 * has to stay.
 */
export function withSessionEndedNotice(
  form: ReactElement,
  action: AuthFormAction | undefined,
  context: Pick<AuthFormRenderContext, 'lang' | 'languages'>
): ReactElement {
  if (action?._sessionEnded !== true) return form
  const { lang, languages } = context
  return (
    <>
      <p
        role="status"
        data-session-ended=""
        className={computeAuthFeedbackBannerClasses()}
        style={AUTH_ERROR_BANNER_STYLE}
      >
        {resolveInterpreterString('auth.sessionEnded', lang ?? languages?.default, languages)}
      </p>
      {form}
    </>
  )
}
