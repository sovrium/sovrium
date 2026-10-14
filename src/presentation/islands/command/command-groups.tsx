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
 */

import { useCallback, type ReactElement } from 'react'
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

/** One authored item, as the server serialised it. */
export interface AuthoredCommandItem {
  readonly label: string
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
  close,
}: {
  readonly item: AuthoredCommandItem
  readonly close: () => void
}): ReactElement {
  const select = useCallback(() => {
    close()
    run(item)
  }, [close, item])
  return (
    <CommandItem
      value={item.label}
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

/** The authored command: a search field over the declared groups. */
export function GroupsPalette({
  groups,
  close,
}: {
  readonly groups: readonly AuthoredCommandGroup[]
  readonly close: () => void
}): ReactElement {
  return (
    <Command>
      <CommandInput
        placeholder="Type a command or search…"
        aria-label="Search commands"
      />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        {groups.map((group) => (
          <CommandGroup
            key={group.label}
            heading={group.label}
          >
            {group.items.map((item) => (
              <AuthoredItem
                key={item.label}
                item={item}
                close={close}
              />
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </Command>
  )
}
