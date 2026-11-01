/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * How the dispatcher runs `sovrium library`: the flags only it reads, declared
 * here so the verb's own module stays about browsing and installing.
 */

import { handleLibraryCommand } from '@/cli/commands/library'
import { defineFlags, flag } from '@/cli/runtime/flag-schema'
import { withFlagsAsync } from '@/cli/runtime/run-command'

/** The flags `sovrium library` reads beyond the shared ones. */
export const libraryFlags = defineFlags({
  kind: flag.value('--kind'),
  category: flag.value('--category'),
  sets: flag.values('--set'),
  as: flag.value('--as'),
  into: flag.value('--into'),
  noWire: flag.switch('--no-wire'),
  tag: flag.value('--tag'),
  limit: flag.value('--limit'),
  all: flag.switch('--all'),
  yes: flag.switch('--yes'),
  update: flag.switch('--update'),
})

/** `sovrium library`, as the dispatcher runs it. */
export const libraryCommand = withFlagsAsync(libraryFlags, ({ flags, ...args }) =>
  handleLibraryCommand({
    ...flags,
    args: args.positionalArgs ?? [],
    format: args.format,
    dryRun: args.dryRun ?? false,
  })
)
