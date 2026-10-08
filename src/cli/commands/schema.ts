/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, join } from 'node:path'
import { Effect, Console } from 'effect'
import { generateAppJsonSchema, splitAppJsonSchema } from '@/domain/models/app/app-json-schema'
import { writeStdout } from './document-output'

/** A document as the schema command writes it: two-space JSON, one trailing newline. */
const toJsonText = (document: unknown): string => JSON.stringify(document, null, 2) + '\n'

/**
 * Write the per-key companions beside the full schema: `<name>.index.json` and
 * `<name>/<key>.json`, named after the full file's own base name. See
 * `splitAppJsonSchema` for the shape.
 */
const writeSplitSchema = async (
  schema: Readonly<Record<string, unknown>>,
  outputPath: string
): Promise<void> => {
  const directory = dirname(outputPath)
  const name = basename(outputPath, extname(outputPath))
  const files = splitAppJsonSchema(schema, name)
  await mkdir(join(directory, name), { recursive: true })
  await Promise.all(
    files.map((file) => writeFile(join(directory, file.path), toJsonText(file.document)))
  )
}

/**
 * Handle the 'schema' command - print JSON Schema to stdout or file
 */
export const handleSchemaCommand = async (outputPath?: string): Promise<void> => {
  const schema = generateAppJsonSchema()
  const json = toJsonText(schema)

  if (outputPath) {
    await mkdir(dirname(outputPath), { recursive: true })
    await writeFile(outputPath, json)
    // Beside the full file, never instead of it: the full file stays the one
    // document an editor maps a whole config to.
    await writeSplitSchema(schema, outputPath)
    Effect.runSync(Console.log(`Schema written to ${outputPath}.`))
  } else {
    // Write to stdout without trailing console formatting
    await writeStdout(json)
  }
}
