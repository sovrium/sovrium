/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { serializeJsonForScript } from '@/domain/kernel/sanitize/json-script-serialization'
import { resolveTranslationPattern } from '@/domain/models/app/languages/translation-resolver'
import { resolveLucideIconNode } from '../elements/lucide-resolver'
import type { ComponentDispatchConfig } from './component-dispatch-config'
import type { ReactElement } from 'react'

/** An authored group, as the schema declares it. */
interface AuthoredGroup {
  readonly label: string
  readonly items: ReadonlyArray<
    Readonly<Record<string, unknown>> & { readonly label: string; readonly icon?: string }
  >
}

/** The authored groups as the island reads them: labels in the page language, icons as geometry. */
const authoredGroupsPayload = (
  groups: readonly AuthoredGroup[],
  config: ComponentDispatchConfig
) => {
  const lang = config.currentLang ?? config.languages?.default ?? ''
  const translate = (text: string) => resolveTranslationPattern(text, lang, config.languages)
  return groups.map((group) => ({
    label: translate(group.label),
    items: group.items.map(({ icon, ...item }) => ({
      ...item,
      label: translate(item.label),
      ...(icon === undefined ? {} : { iconNode: resolveLucideIconNode(icon) }),
    })),
  }))
}

/**
 * The AUTHORED mode: the island's host carries the groups, deferred like the
 * built-in palette's, so nothing loads until a reader opens the command.
 */
function renderGroupsPalette(groups: ReturnType<typeof authoredGroupsPayload>): ReactElement {
  return (
    <div
      data-island-deferred="command"
      data-component-type="command"
      data-island-props={serializeJsonForScript({ groups })}
      className="hidden"
    >
      <span className="sr-only" />
    </div>
  )
}

/** The AUTHORED palette when the command declares `groups`; nothing otherwise. */
export const renderAuthoredGroups = (config: ComponentDispatchConfig): ReactElement | undefined => {
  const groups = (config.component as { readonly groups?: readonly AuthoredGroup[] } | undefined)
    ?.groups
  return groups === undefined
    ? undefined
    : renderGroupsPalette(authoredGroupsPayload(groups, config))
}
