/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  COMMAND_HINTS_CLASSES,
  COMMAND_KBD_CLASSES,
} from '@/presentation/design/command-default-classes'
import type { ReactElement } from 'react'

/** The hint words, already in the page language (`commandPalette.hint*`). */
export interface CommandHintWords {
  readonly navigate: string
  readonly open: string
  readonly close: string
  /** The palette's own words (`commandPalette.<word>`), stamped beside the hints. */
  readonly [word: string]: string | undefined
}

const NAVIGATE_KEYS = ['↑', '↓'] as const
const OPEN_KEYS = ['↵'] as const
const CLOSE_KEYS = ['Esc'] as const

/** English, the catalogue's own words, for a host that stamped none. */
const ENGLISH: CommandHintWords = { navigate: 'navigate', open: 'open', close: 'close' }

function Hint({
  keys,
  label,
}: {
  readonly keys: readonly string[]
  readonly label: string
}): ReactElement {
  return (
    <span className="inline-flex items-center gap-1">
      {keys.map((key) => (
        <kbd
          key={key}
          data-slot="kbd"
          className={COMMAND_KBD_CLASSES}
        >
          {key}
        </kbd>
      ))}
      <span>{label}</span>
    </span>
  )
}

/**
 * The footer under the command's list telling a first-time reader which keys
 * drive it. It sits outside the list, so the arrows never land on it.
 */
export function CommandHints({
  words = ENGLISH,
}: {
  readonly words?: CommandHintWords | undefined
}): ReactElement {
  return (
    <div
      data-slot="command-hints"
      className={COMMAND_HINTS_CLASSES}
    >
      <Hint
        keys={NAVIGATE_KEYS}
        label={words.navigate}
      />
      <Hint
        keys={OPEN_KEYS}
        label={words.open}
      />
      <Hint
        keys={CLOSE_KEYS}
        label={words.close}
      />
    </div>
  )
}
