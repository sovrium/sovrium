/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { isGuestSession } from '@/domain/models/app/auth/guest-session'
import { resolveTranslationTokensDeep } from '@/domain/models/app/languages/translation-resolver'
import { hostComponentType } from '@/presentation/render/registry/island-host-attributes'
import { asRecord } from './island-form-props'
import type { ComponentRenderer } from './component-dispatch-config'

/**
 * The SSR host of a `notification-bell`: the island marker with the bell's
 * words resolved in the page language, and a disabled trigger until it mounts.
 *
 * Drawn for a signed-in reader only. A visitor without an account has no
 * notifications, so her page carries no bell — not an empty one — and nothing
 * on it asks the notifications API anything.
 */
export const notificationBellComponent: ComponentRenderer = ({
  component,
  elementProps,
  session,
  currentLang,
  languages,
}) => {
  if (session === undefined || isGuestSession(session.userId)) return null
  const c = asRecord(component)
  const words = resolveTranslationTokensDeep(
    {
      label: c['label'] ?? 'Notifications',
      emptyLabel: c['emptyLabel'] ?? 'No notifications',
      markAllLabel: c['markAllLabel'] ?? 'Mark all read',
    },
    currentLang,
    languages
  ) as { readonly label: string; readonly emptyLabel: string; readonly markAllLabel: string }
  const props = {
    ...words,
    limit: c['limit'] ?? 20,
    ...(c['sourceHrefs'] === undefined ? {} : { sourceHrefs: c['sourceHrefs'] }),
  }
  return (
    <div
      id={elementProps['id'] as string | undefined}
      data-testid={elementProps['data-testid'] as string | undefined}
      className={elementProps['className'] as string | undefined}
      data-island="notification-bell"
      data-component-type={hostComponentType(elementProps)}
      data-island-props={JSON.stringify(props)}
    >
      <button
        type="button"
        disabled
        className="inline-flex items-center rounded-md p-2"
      >
        <span className="sr-only">{words.label}</span>
      </button>
    </div>
  )
}
