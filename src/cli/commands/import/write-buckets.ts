/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `sovrium import --write` / `--apply` — the files of the imported buckets.
 *
 * `--write` copies each object from the snapshot's `assets/` to
 * `seed/import/buckets/<bucket>/<path>`, in the gitignored seed folder, only
 * when its bytes change. `--apply` then stores each one in the instance's own
 * bucket store (`seed/bucket-files.ts`).
 */

import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { refuse } from '@/cli/commands/app-prelude'
import { SEED_IMPORT_DIR } from '@/domain/models/import/seed-emission-service'
import { isSnapshotFilePath } from '@/domain/models/import/snapshot-manifest'
import type { BucketFileCopy } from '@/domain/models/import/accounts-buckets-mapper-service'

/** Where a bucket file is seeded from: `seed/import/buckets/<bucket>/<path>`. */
export const seededBucketPath = (projectRoot: string, file: BucketFileCopy): string =>
  join(projectRoot, SEED_IMPORT_DIR, 'buckets', file.bucket, ...file.path.split('/'))

/** The bytes of one object in the snapshot, refused when the plan names a path outside `assets/`. */
const snapshotBytes = async (snapshotRoot: string, file: BucketFileCopy): Promise<Uint8Array> => {
  if (!isSnapshotFilePath(file.from) || !file.from.startsWith('assets/')) {
    return refuse(
      'Error: The snapshot names a bucket file outside its assets/ folder, so nothing more was written.\n\n' +
        '  Fetch the snapshot again with `sovrium import fetch`.'
    )
  }
  return new Uint8Array(await Bun.file(join(snapshotRoot, file.from)).arrayBuffer())
}

/** Write each bucket file under `seed/import/buckets/`; returns whether any file changed. */
export const writeBucketFiles = async (
  projectRoot: string,
  files: readonly BucketFileCopy[],
  snapshotRoot: string | undefined
): Promise<boolean> => {
  if (snapshotRoot === undefined || files.length === 0) return false
  const outcomes = await Promise.all(
    files.map(async (file) => {
      const target = seededBucketPath(projectRoot, file)
      const bytes = await snapshotBytes(snapshotRoot, file)
      const held = Bun.file(target)
      if ((await held.exists()) && Buffer.from(await held.arrayBuffer()).equals(bytes)) return false
      await mkdir(dirname(target), { recursive: true })
      await Bun.write(target, bytes)
      return true
    })
  )
  return outcomes.some((changed) => changed)
}
