/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The palette's BUILT-IN mode: the search field over the app's quick actions
 * and content matches (`command-actions.tsx`), and what choosing one does —
 * navigate, open the create-record dialog, or flip the colour scheme.
 */

import { useCallback, useState, type ReactElement } from 'react'
import { toSafeRedirectPath } from '@/domain/kernel/url/redirect-safety'
import { Command, CommandInput, CommandList } from '../parts/command-primitives'
import { BuiltInActions } from './command-actions'
import { toggleDarkMode } from './command-dark-mode'
import { CommandHints, type CommandHintWords } from './command-hints'
import type { PaletteConfig } from './command-actions-data'

/** The BUILT-IN mode: quick actions and the content matches. */
export function BuiltInPalette({
  config,
  hints,
  close,
  onCreate,
}: {
  readonly config: PaletteConfig
  readonly hints: CommandHintWords | undefined
  readonly close: () => void
  readonly onCreate: (table: string) => void
}): ReactElement {
  const [query, setQuery] = useState('')
  const onActivate = useCallback(
    (action: string, href: string | undefined) => {
      close()
      if (action === 'toggle-dark-mode') {
        toggleDarkMode(config.strings)
      } else if (action.startsWith('create-record:')) {
        onCreate(action.slice('create-record:'.length))
      } else {
        // A page path or a record's detail path, both this instance's own.
        const target = toSafeRedirectPath(href)
        if (target !== undefined) window.location.assign(target)
      }
    },
    [close, config.strings, onCreate]
  )
  return (
    <Command shouldFilter={false}>
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder={config.strings['searchPlaceholder'] ?? 'Search…'}
        aria-label={config.strings['search'] ?? 'Search'}
      />
      <CommandList>
        <BuiltInActions
          config={config}
          query={query}
          onActivate={onActivate}
        />
      </CommandList>
      <CommandHints words={hints} />
    </Command>
  )
}
