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

export const handleSchemaCommand = async (outputPath?: string): Promise<void> => {
  const schema = generateAppJsonSchema()
  const json = JSON.stringify(schema, null, 2) + '\n'

  if (outputPath) {
    await mkdir(dirname(outputPath), { recursive: true })
    await writeFile(outputPath, json)
    Effect.runSync(Console.log(`Schema written to ${outputPath}`))
  } else {
    process.stdout.write(json)
  }
}
