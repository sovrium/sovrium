/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { resolveTranslation } from '@/domain/models/app/languages/translation-resolver'
import { withConsoleSignInLink } from '@/presentation/render/page/console-sign-in-link'
import { mountedPreferredLanguage } from './mounted-render-options'
import type { HonoAppConfig } from '../../../application/ports/contracts/hono-app-config'
import type { EmbeddedAppMount } from '@/application/ports/contracts/embedded-app-mount'
import type { Context } from 'hono'

/**
 * The 404 a console address answers a caller the console does not admit: the
 * app's own not-found document — the very one a missing console address gets,
 * so it says nothing about which pages exist — carrying one "Sign in" link to
 * the console's sign-in page, in the reader's language, which returns them to
 * the address asked for. An operator whose session ended is never stranded on
 * a page with no way back; outside the console base the app's 404 is untouched.
 */
export const signedOutConsoleNotFound = async (
  mount: EmbeddedAppMount,
  config: HonoAppConfig,
  c: Context
): Promise<string> => {
  const { languages } = mount.presetApp
  const language = mountedPreferredLanguage(mount.presetApp, undefined, c) ?? languages?.default
  const label = resolveTranslation('admin.login.heading', language ?? 'en', languages)
  return withConsoleSignInLink(await config.renderNotFoundPage(config.app), {
    loginPath: `${mount.basePath}/login`,
    label,
  })
}
