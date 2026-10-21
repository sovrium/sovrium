/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Effect } from 'effect'
import {
  InstanceSupervisor,
  InstanceSupervisorError,
} from '@/application/ports/services/instance-supervisor'
import {
  StorageService,
  UNATTRIBUTED_BUCKET,
  isStorageObjectTooLarge,
} from '@/application/ports/services/storage-service'
import { BUNDLE_MANIFEST_ENTRY } from '@/application/use-cases/server/bundle-manifest'
import {
  manifestSignatureProblem,
  verifySignedBundle,
} from '@/application/use-cases/server/signed-bundle'
import {
  BUNDLE_MAX_STORED_BYTES,
  BUNDLE_MAX_UNPACKED_BYTES,
  gunzipBounded,
} from '@/domain/kernel/format/bounded-gunzip'
import { decodeBase64 } from '@/domain/kernel/identity/ed25519'
import {
  ENGINE_LINK_ENTRY,
  reservedEngineEntry,
} from '@/domain/models/app/automations/actions/instance/engine-version-service'
import type { StarterFileGate } from './starter-file-gate'
import type { StorageError } from '@/application/ports/services/storage-service'

/**
 * The bundle an `instance/apply` names, read and verified before anything of
 * it reaches the host: inline base64 or an object in this app's storage, its
 * stored and unpacked sizes capped, the manifest's detached signature checked
 * before any other entry is read, no entry under the reserved `.engine`, then
 * every entry against the signed manifest.
 */

const refuse = (message: string) => Effect.fail(new InstanceSupervisorError({ message }))

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

const textOf = (value: unknown, name: string) =>
  typeof value === 'string' && value.trim() !== ''
    ? Effect.succeed(value)
    : refuse(`instance: ${name} must be a non-empty string`)

const causeText = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause)

const storageMessage = (key: string, error: Readonly<StorageError>): string =>
  `instance: could not read ${key} from storage: ${causeText(error.cause)}`

/** The entry paths a manifest lists, read loosely: its schema is checked later. */
const manifestPaths = (manifest: Readonly<Uint8Array>): readonly string[] => {
  try {
    const parsed = JSON.parse(new TextDecoder().decode(manifest)) as { readonly entries?: unknown }
    return Array.isArray(parsed.entries)
      ? parsed.entries
          .map((entry: unknown) => (isRecord(entry) ? entry['path'] : undefined))
          .filter((path): path is string => typeof path === 'string')
      : []
  } catch {
    return []
  }
}

/**
 * The archive an `apply` names: inline base64, or an object in this app's
 * storage. A stored key is read as the starter of a hand-started run may read
 * it (`gate`, before any byte): a refused key fails as one nothing holds does,
 * with `Resource not found`; a bundle with no catalog row is read as before.
 */
const bundleBytes = (bundle: unknown, gate: StarterFileGate) =>
  Effect.gen(function* () {
    if (!isRecord(bundle))
      return yield* refuse('instance: bundle must be { objectKey } or { base64 }')
    if (typeof bundle['base64'] === 'string') {
      const text = bundle['base64'].trim()
      // Measured before decoding: base64 carries 3 bytes in every 4 characters.
      if ((text.length / 4) * 3 > BUNDLE_MAX_STORED_BYTES) return yield* refuse(TOO_LARGE_STORED)
      const bytes = decodeBase64(text)
      return bytes ?? (yield* refuse('instance: bundle.base64 is not base64'))
    }
    const key = yield* textOf(bundle['objectKey'], 'bundle.objectKey')
    const refused = yield* gate(key)
    if (refused !== undefined) return yield* refuse(refused)
    const storage = yield* StorageService
    const toRefusal = (error: Readonly<StorageError>) =>
      new InstanceSupervisorError({ message: storageMessage(key, error) })
    // The size the STORE reports — the control plane wrote this object, so this app's catalog has
    // no row for it — is checked before a byte is downloaded; an unknown size is never downloaded.
    const stored = yield* storage.statObject(key).pipe(Effect.mapError(toRefusal))
    if (stored.size > BUNDLE_MAX_STORED_BYTES) return yield* refuse(TOO_LARGE_STORED)
    // Bounded too: the object may have grown between its size and its read.
    return yield* storage
      .downloadBounded(key, UNATTRIBUTED_BUCKET, BUNDLE_MAX_STORED_BYTES)
      .pipe(
        Effect.mapError((error) =>
          isStorageObjectTooLarge(error)
            ? new InstanceSupervisorError({ message: TOO_LARGE_STORED })
            : toRefusal(error)
        )
      )
  })

const TOO_LARGE_STORED = 'instance: the bundle is larger than 100 MiB, the most a bundle may weigh'

/**
 * The bundle's tar, inflated against the 256 MiB unpacked cap — the defence
 * against a small upload that expands a thousandfold; nothing past the cap is
 * ever allocated.
 */
const inflatedBundle = (archive: Uint8Array) => {
  const inflated = gunzipBounded(archive, BUNDLE_MAX_UNPACKED_BYTES)
  if (inflated._tag === 'TooLarge') {
    return refuse('instance: the bundle unpacks to more than 256 MiB, the most a bundle may hold')
  }
  return inflated._tag === 'NotGzip'
    ? refuse('instance: the bundle is not a tar.gz archive')
    : Effect.succeed(inflated.bytes)
}

/**
 * The bundle an `apply` names, verified in this order: stored size, unpacked
 * size, the manifest's signature (read alone, before any other entry), then
 * every entry against the signed manifest.
 */
export const verifiedBundleOf = Effect.fn('automations.instance-verify-bundle')(function* (
  bundle: unknown,
  signed: { readonly keyId: string; readonly signature: string },
  gate: StarterFileGate
) {
  const tar = yield* inflatedBundle(yield* bundleBytes(bundle, gate))
  const supervisor = yield* InstanceSupervisor
  const manifest = (yield* supervisor.readBundleEntries(tar, [BUNDLE_MANIFEST_ENTRY]))?.get(
    BUNDLE_MANIFEST_ENTRY
  )
  if (manifest === undefined) {
    return yield* refuse(`instance: the bundle holds no ${BUNDLE_MANIFEST_ENTRY}`)
  }
  const badSignature = manifestSignatureProblem(manifest, signed)
  if (badSignature !== undefined) return yield* refuse(`instance: ${badSignature}`)
  const entries = yield* supervisor.readBundleEntries(tar)
  if (entries === undefined) return yield* refuse('instance: the bundle is not a tar.gz archive')
  const reserved = reservedEngineEntry([...entries.keys(), ...manifestPaths(manifest)])
  if (reserved !== undefined) {
    return yield* refuse(
      `instance: the bundle holds ${reserved}, but ${ENGINE_LINK_ENTRY} is reserved: the host links the engine a release runs on there`
    )
  }
  const verified = verifySignedBundle({ entries, ...signed })
  return verified._tag === 'Refused' ? yield* refuse(`instance: ${verified.reason}`) : verified
})
