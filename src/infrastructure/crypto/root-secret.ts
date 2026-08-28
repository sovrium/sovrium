/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { randomBytes, scryptSync } from 'node:crypto'
import { chmodSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { defaultEncryptionKeyPath } from '@/domain/models/env/data-dir'

/**
 * The single root secret every cryptographic purpose in Sovrium derives from.
 *
 * Sovrium's headline promise is that a fresh install runs with an empty
 * environment. That used to be false: the server refused to boot without
 * `SOVRIUM_ENCRYPTION_KEY`, which broke unattended deploys outright and pushed
 * local setups onto a publicly-known constant. The whole of `src/` is
 * mirrored to a public repository and compiled into every shipped binary, so a
 * built-in default key would have made the encryption decorative.
 *
 * The resolution order removes the dilemma without weakening anything:
 *
 *   1. `SOVRIUM_ENCRYPTION_KEY` — an operator-managed secret always wins, and
 *      nothing is written to disk. A deployment that manages its secret
 *      externally must not silently acquire a second copy of it.
 *   2. `<dataDir>/encryption-key` — the secret this install generated earlier.
 *   3. Generate 256 bits, persist at mode `0600`, use it.
 *   4. The data directory cannot be written → refuse loudly, naming the path.
 *      Falling back to a process-local key would let a server come up and quietly
 *      orphan every token it wrote once it restarted.
 *
 * The key lands beside the SQLite database it protects, so on an ephemeral
 * filesystem the two die together and no unreadable ciphertext is left behind.
 * The one shape where they do NOT die together — an external `DATABASE_URL` with
 * an ephemeral container filesystem — is why a freshly-generated key emits a
 * startup ⚠ telling the operator to pin `SOVRIUM_ENCRYPTION_KEY`.
 *
 * Derivation is domain-separated: the root secret is never handed verbatim to a
 * primitive. Feeding the same string to an AES-GCM key and to an HMAC signing
 * secret is a key-reuse anti-pattern, so each purpose takes its own scrypt salt.
 * The token-encryption salt is deliberately UNCHANGED (`sovrium-token-salt`) —
 * that is what keeps every already-stored connection token readable.
 *
 * Resolution is memoized and LAZY. Importing this module must not read or write
 * a secret: it sits behind the token repository, which the table layer pulls in,
 * which the CLI's command handlers pull in — so an eager resolution would make
 * `sovrium --help` provision a key file as a side effect.
 */

/** Where the root secret came from. Drives the startup banner wording. */
export type RootSecretSource = 'env' | 'file' | 'generated'

export interface RootSecretResolution {
  readonly secret: string
  readonly source: RootSecretSource
  /** The key file this install would use — reported in banners and errors. */
  readonly keyFilePath: string
}

/** The env var an operator sets to manage the root secret themselves. */
export const ROOT_SECRET_ENV_VAR = 'SOVRIUM_ENCRYPTION_KEY'

/** Bytes of entropy in a generated root secret (256-bit, rendered as 64 hex). */
const GENERATED_SECRET_BYTES = 32

/** Owner-read/write only. The file holds the key to every stored OAuth token. */
const KEY_FILE_MODE = 0o600

/**
 * The operator-facing refusal when a key file EXISTS but cannot be read.
 *
 * Names the path and the underlying errno, plus the env var that removes the
 * need to read the file at all.
 */
const unreadableMessage = (keyFilePath: string, cause: unknown): string =>
  `Sovrium found an encryption key at ${keyFilePath} but could not read it ` +
  `(${cause instanceof Error ? cause.message : String(cause)}). ` +
  `Refusing to start rather than generate a replacement, which would permanently ` +
  `orphan every secret already encrypted under the existing key. ` +
  `Fix the file's permissions, or set ${ROOT_SECRET_ENV_VAR} to supply the key directly.`

/**
 * Read a persisted root secret, or `undefined` when there is none to read.
 *
 * ONLY "the file is not there" counts as absent. Every other failure — EACCES on
 * a key owned by another uid, EIO on failing storage, EISDIR where a directory
 * shadows the path — THROWS.
 *
 * That distinction is the entire job of this function, and it used to be a bare
 * `catch { return undefined }`. Returning `undefined` here does not mean "no
 * key"; it means "generate one", and `generateAndPersist` then writes OVER the
 * file it could not read. Every OAuth token, connection credential and
 * automation secret encrypted under the old key becomes permanently
 * undecryptable — silently, because a generated key is reported as a success
 * line at startup unless `DATABASE_URL` happens to be set. An unreadable file is
 * usually also unwritable, so the write would often have failed loudly on its
 * own; "usually" is not a safety property.
 *
 * A file that exists and is BLANK still reads as absent, deliberately: it
 * derives no usable key, so nothing can have been encrypted under it, and
 * treating that as fatal would strand an install behind a file it can simply
 * rewrite. Truncation is prevented at the write end instead — see
 * {@link generateAndPersist}.
 */
const readPersistedSecret = (keyFilePath: string): string | undefined => {
  try {
    const contents = readFileSync(keyFilePath, 'utf-8').trim()
    return contents.length > 0 ? contents : undefined
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === 'ENOENT') return undefined
    // eslint-disable-next-line functional/no-throw-statements -- fail-loud: generating a replacement key would silently orphan every secret encrypted under the unreadable one
    throw new Error(unreadableMessage(keyFilePath, cause))
  }
}

/**
 * The operator-facing refusal when the data directory cannot hold a key.
 *
 * It names the path it could not write AND the env var that removes the need to
 * write anything at all — an operator hitting this on a read-only container
 * filesystem needs both halves to act. Asserted by [internal ref].
 */
const unwritableMessage = (keyFilePath: string, cause: unknown): string =>
  `Sovrium could not write its encryption key to ${keyFilePath} ` +
  `(${cause instanceof Error ? cause.message : String(cause)}). ` +
  `Point SOVRIUM_DATA_DIR at a writable directory, or set ${ROOT_SECRET_ENV_VAR} ` +
  `so no key needs to be written.`

/**
 * Write the key, then move it into place.
 *
 * `writeFileSync` truncates the target before writing, so a crash, a full disk
 * or a container kill between those two steps leaves a zero-byte or partial key
 * file. A partial file is the worse outcome: `readPersistedSecret` accepts any
 * non-blank contents, so a truncated key is adopted verbatim as THE key and
 * every previously-encrypted secret silently fails to decrypt, with no error at
 * startup. Writing to a sibling temp file and renaming makes the publish atomic
 * on POSIX — the key file only ever exists complete or not at all.
 *
 * The temp file is created with the restrictive mode too: a key must never be
 * observable at a wider mode, even for the instant before the rename.
 */
const writeKeyFileAtomically = (keyFilePath: string, contents: string): void => {
  const tempPath = `${keyFilePath}.${randomBytes(6).toString('hex')}.tmp`
  // eslint-disable-next-line functional/no-expression-statements -- filesystem provisioning; mirrors writeLockFile's mkdir-then-write precedent
  mkdirSync(dirname(keyFilePath), { recursive: true })
  writeFileSync(tempPath, contents, { mode: KEY_FILE_MODE, encoding: 'utf-8' })
  // `mode` on writeFileSync applies only on creation and is masked by umask,
  // so the bits are asserted explicitly rather than hoped for.
  chmodSync(tempPath, KEY_FILE_MODE)
  renameSync(tempPath, keyFilePath)
}

const generateAndPersist = (keyFilePath: string): string => {
  const generated = randomBytes(GENERATED_SECRET_BYTES).toString('hex')
  try {
    writeKeyFileAtomically(keyFilePath, `${generated}\n`)
  } catch (cause) {
    // eslint-disable-next-line functional/no-throw-statements -- fail-loud: a process-local key would silently orphan every token it wrote
    throw new Error(unwritableMessage(keyFilePath, cause))
  }
  return generated
}

const resolve = (): RootSecretResolution => {
  const keyFilePath = defaultEncryptionKeyPath()
  const fromEnv = process.env[ROOT_SECRET_ENV_VAR]
  if (typeof fromEnv === 'string' && fromEnv.length > 0) {
    return { secret: fromEnv, source: 'env', keyFilePath }
  }
  const persisted = readPersistedSecret(keyFilePath)
  if (persisted !== undefined) {
    return { secret: persisted, source: 'file', keyFilePath }
  }
  return { secret: generateAndPersist(keyFilePath), source: 'generated', keyFilePath }
}

// eslint-disable-next-line functional/no-let -- one-shot process-lifetime memo; resolution must stay lazy so importing this module provisions nothing
let cached: RootSecretResolution | undefined

/**
 * Resolve (and, on a fresh install, provision) the root secret.
 *
 * Memoized for the process lifetime: the env var and the key file are constant
 * across a run, and re-reading them would let a mid-run filesystem change split
 * the process across two secrets.
 *
 * Throws when the data directory cannot be written. Call it explicitly at the
 * top of a server boot so that failure lands on whoever deployed the server
 * rather than on whoever first connects an integration.
 */
export const provisionRootSecret = (): RootSecretResolution => {
  if (cached !== undefined) return cached
  // eslint-disable-next-line functional/no-expression-statements -- memo assignment
  cached = resolve()
  return cached
}

/**
 * Derive a purpose-specific subkey from the root secret.
 *
 * `purpose` IS the scrypt salt, so it must be stable forever for a given
 * purpose — changing it rotates that purpose's key and invalidates everything
 * already derived under the old one.
 */
export const deriveSubkey = (purpose: string, length = 32): Buffer =>
  scryptSync(provisionRootSecret().secret, purpose, length)

/**
 * Human-readable provenance for the startup banner.
 *
 * The three phrasings are a CONTRACT, not cosmetics: [internal ref]
 * distinguish a generated secret from a read one from a supplied one purely by
 * this wording, and that distinction is what lets an operator tell "my key is
 * being regenerated on every restart" from "my key is stable" without reading
 * the filesystem.
 *
 * `formatPath` is injected rather than imported. The banner renders the SQLite
 * database and the storage directory — both siblings of the key file, in the
 * same directory — through `formatPathForDisplay`, so printing the key's raw
 * absolute path beside them read as a different kind of thing entirely. The
 * formatter belongs to the logging layer and this module is crypto, so it
 * arrives as an argument instead of an import; the identity default keeps every
 * non-display caller honest.
 */
export const describeRootSecretSource = (
  resolution: RootSecretResolution,
  formatPath: (path: string) => string = (path) => path
): string => {
  if (resolution.source === 'env') return `from ${ROOT_SECRET_ENV_VAR}`
  if (resolution.source === 'file') return `from ${formatPath(resolution.keyFilePath)}`
  return `generated at ${formatPath(resolution.keyFilePath)}`
}
