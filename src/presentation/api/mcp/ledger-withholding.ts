/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * What the MCP call ledger keeps of an admin or internal read: the call, never
 * its answer.
 *
 * Those answers carry revealed submission bodies, export CSVs and directory
 * rows, and the ledger is read back by any admin through the ledger list tool,
 * behind no reveal gate. So every argument NAME is kept, a number or boolean
 * value as given (`limit`, `reveal`), and every other value — a string, an id,
 * a `where` object — is replaced by `"[withheld]"`. A successful answer becomes
 * `{ withheld: true, bytes }`, its size in UTF-8 bytes; a failure keeps its null
 * output and its error. This holds whatever `ADMIN_DETAIL_CAPTURE_BODIES_ALLOWED`
 * says: that switch governs the reveal itself, not the trail of it.
 *
 * User-table tools are not routed here and keep their full row.
 */

import type { McpToolResult } from './tool-call-helpers'

/** What a withheld argument value is recorded as. */
const WITHHELD_VALUE = '[withheld]'

/** The text a tool answered, its parts joined. */
const answeredTextOf = (result: unknown): string => {
  const content = (result as Partial<McpToolResult> | undefined)?.content ?? []
  return content.map((part) => (part.type === 'text' ? part.text : '')).join('')
}

/** Keep each argument's name, and its value only when it is a number or a boolean. */
const withheldArguments = (args: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(args).map(([name, value]) => [
      name,
      typeof value === 'number' || typeof value === 'boolean' ? value : WITHHELD_VALUE,
    ])
  )

/**
 * The ledger entry of an admin or internal read: argument values withheld,
 * and a successful answer reduced to its size.
 */
export const withheldLedgerEntry = <O extends { readonly result: unknown }>(
  args: Record<string, unknown>,
  outcome: O
): { readonly inputArgs: Record<string, unknown>; readonly outcome: O } => ({
  inputArgs: withheldArguments(args),
  outcome:
    outcome.result === undefined
      ? outcome
      : {
          ...outcome,
          result: {
            withheld: true,
            bytes: Buffer.byteLength(answeredTextOf(outcome.result), 'utf8'),
          },
        },
})
