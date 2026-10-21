/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The AUTHORED mode of the `command` island: the groups the page declared,
 * drawn as shadcn/ui's CommandGroup and CommandItem, with cmdk's own filter
 * on, so typing narrows the items across groups and hides a group left with no
 * match. Choosing an item closes the command, then goes where its `href` says
 * or runs its action (a toast or a navigation).
 *
 * Beside a declared `search` the same groups are drawn above the results
 * ({@link SearchedGroups}), narrowed by the palette's own token match because
 * the list's filter is off there. In both, an item's `label` and `href` may
 * carry bare `$query`, the words typed so far: such an item always matches
 * them, and with nothing typed it reads its `emptyLabel`, or is not drawn.
 * In both, typing matches an item's label OR its group's name, so the words a
 * group is named by ("help") keep every item of that group.
 */

import { useCallback, useMemo, useState, type ReactElement } from 'react'
import { toSafeRedirectPath } from '@/domain/kernel/url/redirect-safety'
import { LucideGlyph } from '@/presentation/design/lucide-glyph'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from '../parts/command-primitives'
import { renderToast } from '../runtime/toast'
import { itemForQuery, keptByQuery } from './command-group-match'
import { CommandHints, type CommandHintWords } from './command-hints'

/** One authored item, as the server serialised it. */
export interface AuthoredCommandItem {
  readonly label: string
  readonly emptyLabel?: string
  readonly iconNode?: unknown
  readonly href?: string
  readonly shortcut?: readonly string[]
  readonly action?:
    | {
        readonly type: 'toast'
        readonly message: string
        readonly variant?: string
        readonly duration?: number
      }
    | { readonly type: 'navigate'; readonly path: string }
}

/** One authored group. */
export interface AuthoredCommandGroup {
  readonly label: string
  readonly items: readonly AuthoredCommandItem[]
}

/** Go to a path of this instance, or nowhere. */
const go = (path: string | undefined): void => {
  const target = toSafeRedirectPath(path)
  if (target !== undefined) window.location.assign(target)
}

/** Run what choosing an item does. */
const run = (item: AuthoredCommandItem): void => {
  if (item.href !== undefined) return go(item.href)
  if (item.action?.type === 'toast')
    return renderToast(item.action.message, item.action.variant, item.action.duration)
  if (item.action?.type === 'navigate') return go(item.action.path)
  return undefined
}

function AuthoredItem({
  item,
  group,
  close,
}: {
  readonly item: AuthoredCommandItem
  /** The group's name, which cmdk's own filter matches beside the label. */
  readonly group: string
  readonly close: () => void
}): ReactElement {
  const select = useCallback(() => {
    close()
    run(item)
  }, [close, item])
  const keywords = useMemo(() => [group], [group])
  return (
    <CommandItem
      value={item.label}
      keywords={keywords}
      onSelect={select}
    >
      {item.iconNode === undefined ? undefined : (
        <LucideGlyph
          iconNode={item.iconNode}
          aria-hidden="true"
        />
      )}
      <span>{item.label}</span>
      {item.shortcut === undefined ? undefined : (
        <CommandShortcut>
          {item.shortcut.map((key) => (
            <kbd
              key={key}
              data-slot="kbd"
              className="font-sans"
            >
              {key}
            </kbd>
          ))}
        </CommandShortcut>
      )}
    </CommandItem>
  )
}

/**
 * The declared groups as drawn for `query`. `narrow` filters the items itself,
 * for a list whose own filter is off; a group left with no item is not drawn.
 */
export function SearchedGroups({
  groups,
  query,
  narrow,
  close,
}: {
  readonly groups: readonly AuthoredCommandGroup[]
  readonly query: string
  readonly narrow: boolean
  readonly close: () => void
}): ReactElement {
  const drawn = groups.map((group) => ({
    label: group.label,
    items: group.items
      .filter((item) => !narrow || keptByQuery(item, group.label, query))
      .flatMap((item) => itemForQuery(item, query) ?? []),
  }))
  return (
    <>
      {drawn
        .filter((group) => group.items.length > 0)
        .map((group) => (
          <CommandGroup
            key={group.label}
            heading={group.label}
          >
            {group.items.map((item, index) => (
              <AuthoredItem
                key={`${String(index)}:${item.label}`}
                item={item}
                group={group.label}
                close={close}
              />
            ))}
          </CommandGroup>
        ))}
    </>
  )
}

/** The authored command: a search field over the declared groups. */
export function GroupsPalette({
  groups,
  hints,
  close,
}: {
  readonly groups: readonly AuthoredCommandGroup[]
  readonly hints: CommandHintWords | undefined
  readonly close: () => void
}): ReactElement {
  const [query, setQuery] = useState('')
  return (
    <Command>
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder={hints?.['commandPlaceholder'] ?? 'Type a command or search…'}
        aria-label={hints?.['commandLabel'] ?? 'Search commands'}
      />
      <CommandList>
        <CommandEmpty>{hints?.['empty'] ?? 'No results found.'}</CommandEmpty>
        <SearchedGroups
          groups={groups}
          query={query}
          narrow={false}
          close={close}
        />
      </CommandList>
      <CommandHints words={hints} />
    </Command>
  )
}
