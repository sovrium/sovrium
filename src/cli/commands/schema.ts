/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { Effect, Console } from 'effect'
import { generateAppJsonSchema } from '@/domain/services/json-schema'

/**
 * Handle the 'schema' command - print JSON Schema to stdout or file
 */
export const handleSchemaCommand = async (outputPath?: string): Promise<void> => {
  const schema = generateAppJsonSchema()
  // eslint-disable-next-line unicorn/no-null -- JSON.stringify requires null as replacer
  const json = JSON.stringify(schema, null, 2) + '\n'

  if (outputPath) {
    // eslint-disable-next-line functional/no-expression-statements
    await mkdir(dirname(outputPath), { recursive: true })
    // eslint-disable-next-line functional/no-expression-statements
    await writeFile(outputPath, json)
    Effect.runSync(Console.log(`Schema written to ${outputPath}`))
  } else {
    // Write to stdout without trailing console formatting
    // eslint-disable-next-line functional/no-expression-statements
    process.stdout.write(json)
  }
}
