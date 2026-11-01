/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Sign the desktop updater payloads with the Tauri updater key, OUTSIDE the build.
 *
 * `tauri build` signs its updater artefacts itself when `TAURI_SIGNING_PRIVATE_KEY`
 * is in its environment — which means every cargo build script, every proc macro
 * and every npm plugin the desktop build runs can read the key that every
 * installed copy of the app trusts for its next update. The release workflow
 * therefore builds with a THROWAWAY key, discards those signatures, and this
 * script re-signs the payloads in a separate job that installs nothing.
 *
 * ## The format, byte for byte
 *
 * A Tauri updater signature is the base64 of a minisign signature box:
 *
 *   untrusted comment: signature from tauri secret key
 *   base64("ED" ‖ key id[8] ‖ Ed25519(BLAKE2b-512(file))[64])
 *   trusted comment: timestamp:<unix>\tfile:<name>\tversion:<version>
 *   base64(Ed25519(signature[64] ‖ trusted comment)[64])
 *
 * The secret key Tauri hands out is the base64 of a minisign secret-key file,
 * whose payload is encrypted with scrypt (libsodium's `crypto_pwhash_scryptsalsa208sha256`
 * parameter choice). Tauri's signer HEDGES its Ed25519 signatures with random
 * noise, so two signatures over one file never match byte for byte; what the unit
 * test pins instead is a vector `tauri signer sign` wrote: this module decrypts that
 * key, verifies that signature, and produces signatures its verifier accepts under
 * the same public key, in the same box layout.
 *
 * Only `node:` built-ins (and the `Bun` global) are used, on purpose: the signing job runs this from
 * a bare checkout with no `bun install`, so no third-party code shares a process
 * with the key. `sign-tauri-updater.test.ts` holds that line.
 *
 * ## Fail closed
 *
 * Every signature is verified against the public key COMMITTED in
 * `desktop/src-tauri/tauri.conf.json` before it is written. A secret that does not
 * match the key every installed app trusts would produce updates nobody can
 * install, so it is refused here rather than discovered by users.
 *
 * Usage:
 *   TAURI_SIGNING_PRIVATE_KEY=… TAURI_SIGNING_PRIVATE_KEY_PASSWORD=… \
 *     bun run scripts/build/sign-tauri-updater.ts --version <x.y.z> <payload> [<payload>…]
 */

import {
  createHash,
  createPrivateKey,
  createPublicKey,
  scryptSync,
  sign,
  verify,
} from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { basename } from 'node:path'
import type { KeyObject } from 'node:crypto'

/** The environment variables the CI step fills from the `release` environment. */
export const TAURI_KEY_ENV = 'TAURI_SIGNING_PRIVATE_KEY'
export const TAURI_PASSWORD_ENV = 'TAURI_SIGNING_PRIVATE_KEY_PASSWORD'

/** Where the public key every installed app trusts is committed. */
export const TAURI_CONF_PATH = 'desktop/src-tauri/tauri.conf.json'

/** Thrown for any key, password or signature that is not usable; the message is the operator's. */
export class TauriSigningError extends Error {}

/** DER prefix turning a raw 32-byte Ed25519 seed into PKCS#8. */
const PKCS8_ED25519_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex')

/** DER prefix turning a raw 32-byte Ed25519 public key into SPKI. */
const SPKI_ED25519_PREFIX = Buffer.from('302a300506032b6570032100', 'hex')

const UNTRUSTED_COMMENT = 'untrusted comment: signature from tauri secret key'

/** A decrypted minisign secret key: its 8-byte id and the Ed25519 private key. */
export interface MinisignSecretKey {
  readonly keyId: Buffer
  readonly privateKey: KeyObject
}

/** A minisign public key: its 8-byte id and the Ed25519 public key. */
export interface MinisignPublicKey {
  readonly keyId: Buffer
  readonly publicKey: KeyObject
}

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/

const fromBase64 = (value: string, what: string): Buffer => {
  const compact = value.replace(/\s+/g, '')
  if (compact === '' || !BASE64.test(compact)) {
    throw new TauriSigningError(`${what} is not base64.`)
  }
  return Buffer.from(compact, 'base64')
}

/**
 * The base64 payload line of a minisign key file, whether the value is the file
 * itself or (Tauri's form) the base64 of the file.
 */
const minisignPayload = (value: string, what: string): Buffer => {
  const trimmed = value.trim()
  const text = trimmed.startsWith('untrusted comment:')
    ? trimmed
    : fromBase64(trimmed, what).toString('utf8')
  const lines = text.split('\n').map((line) => line.trim())
  if (!lines[0]?.startsWith('untrusted comment:') || lines[1] === undefined) {
    throw new TauriSigningError(`${what} is not a minisign key file (no untrusted comment line).`)
  }
  return fromBase64(lines[1], what)
}

/**
 * libsodium's `pickparams` for scryptsalsa208sha256: the (N, r, p) a minisign key's
 * opslimit/memlimit pair stands for. Ported line for line; the vector test fails if
 * it drifts, because the derived stream would no longer decrypt the key.
 */
/** The smallest log2 whose power of two exceeds `maxN / 2` (libsodium's loop). */
const firstLog2Above = (maxN: bigint): bigint => {
  let log2 = 1n
  while (log2 < 63n && 1n << log2 <= maxN / 2n) log2 += 1n
  return log2
}

const MIN_OPSLIMIT = 32_768n
const MAX_RP = 0x3f_ff_ff_ffn

export const scryptParams = (
  opslimitIn: bigint,
  memlimit: bigint
): { readonly N: number; readonly r: number; readonly p: number } => {
  const opslimit = opslimitIn < MIN_OPSLIMIT ? MIN_OPSLIMIT : opslimitIn
  const r = 8n
  if (opslimit < memlimit / 32n) {
    const log2 = firstLog2Above(opslimit / (r * 4n))
    return { N: Number(1n << log2), r: Number(r), p: 1 }
  }
  const log2 = firstLog2Above(memlimit / (r * 128n))
  const rp = opslimit / 4n / (1n << log2)
  const maxrp = rp > MAX_RP ? MAX_RP : rp
  return { N: Number(1n << log2), r: Number(r), p: Number(maxrp / r) }
}

const blake2b512 = (data: Uint8Array): Buffer => createHash('blake2b512').update(data).digest()

/**
 * BLAKE2b with a 32-byte digest, the checksum minisign stores inside the secret key.
 * Bun's own hasher: `node:crypto` here has no variable-length BLAKE2b. Still no
 * third-party code — `Bun` is the runtime itself.
 */
const blake2b256 = (data: Uint8Array): Buffer =>
  Buffer.from(new Bun.CryptoHasher('blake2b256').update(data).digest())

/** Parse and decrypt a Tauri updater secret key (minisign format). */
export const parseSecretKey = (value: string, password: string): MinisignSecretKey => {
  if (value.trim() === '') throw new TauriSigningError('The updater signing key is empty.')
  const bytes = minisignPayload(value, 'The updater signing key')
  if (bytes.length !== 158) {
    throw new TauriSigningError(
      `The updater signing key payload is ${bytes.length} bytes; a minisign secret key is 158.`
    )
  }
  const sigAlg = bytes.subarray(0, 2)
  const kdfAlg = bytes.subarray(2, 4).toString('latin1')
  const chkAlg = bytes.subarray(4, 6).toString('latin1')
  if (sigAlg.toString('latin1') !== 'Ed' || chkAlg !== 'B2') {
    throw new TauriSigningError('The updater signing key is not an Ed25519/BLAKE2b minisign key.')
  }
  const salt = bytes.subarray(6, 38)
  const opslimit = bytes.readBigUInt64LE(38)
  const memlimit = bytes.readBigUInt64LE(46)
  const sealed = bytes.subarray(54, 158)
  const keynum = (() => {
    if (kdfAlg === '\0\0') return Buffer.from(sealed)
    if (kdfAlg !== 'Sc') {
      throw new TauriSigningError(`The updater signing key uses an unknown KDF (${kdfAlg}).`)
    }
    const { N, r, p } = scryptParams(opslimit, memlimit)
    const stream = scryptSync(Buffer.from(password, 'utf8'), salt, sealed.length, {
      N,
      r,
      p,
      maxmem: 256 * N * r + 1024 * 1024,
    })
    return Buffer.from(sealed.map((byte, index) => byte ^ (stream[index] ?? 0)))
  })()
  const keyId = keynum.subarray(0, 8)
  const secret = keynum.subarray(8, 72)
  const checksum = keynum.subarray(72, 104)
  if (!blake2b256(Buffer.concat([sigAlg, keyId, secret])).equals(checksum)) {
    throw new TauriSigningError(
      `The updater signing key does not decrypt: wrong ${TAURI_PASSWORD_ENV}, or a damaged key.`
    )
  }
  const privateKey = createPrivateKey({
    key: Buffer.concat([PKCS8_ED25519_PREFIX, secret.subarray(0, 32)]),
    format: 'der',
    type: 'pkcs8',
  })
  return { keyId: Buffer.from(keyId), privateKey }
}

/** Parse a minisign public key (the `pubkey` value in `tauri.conf.json`). */
export const parsePublicKey = (value: string): MinisignPublicKey => {
  const bytes = minisignPayload(value, 'The updater public key')
  if (bytes.length !== 42 || bytes.subarray(0, 2).toString('latin1') !== 'Ed') {
    throw new TauriSigningError('The updater public key is not an Ed25519 minisign key.')
  }
  const publicKey = createPublicKey({
    key: Buffer.concat([SPKI_ED25519_PREFIX, bytes.subarray(10, 42)]),
    format: 'der',
    type: 'spki',
  })
  return { keyId: Buffer.from(bytes.subarray(2, 10)), publicKey }
}

/** The trusted comment `tauri build` writes, version-bound. */
export const trustedComment = (timestamp: number, fileName: string, version: string): string =>
  `timestamp:${timestamp}\tfile:${fileName}\tversion:${version}`

/** The `.sig` file content for `data`: base64 of the minisign signature box. */
export const signPayload = (data: Uint8Array, key: MinisignSecretKey, comment: string): string => {
  const signature = sign(null, blake2b512(data), key.privateKey)
  const globalSignature = sign(
    null,
    Buffer.concat([signature, Buffer.from(comment, 'utf8')]),
    key.privateKey
  )
  const box =
    `${UNTRUSTED_COMMENT}\n` +
    `${Buffer.concat([Buffer.from('ED', 'latin1'), key.keyId, signature]).toString('base64')}\n` +
    `trusted comment: ${comment}\n` +
    `${globalSignature.toString('base64')}\n`
  return Buffer.from(box, 'utf8').toString('base64')
}

/**
 * Whether a `.sig` content verifies `data` under `publicKey`, as the Tauri updater
 * checks it: key id, the prehashed signature and the global signature over the
 * trusted comment. Returns the trusted comment when it verifies, else undefined.
 */
export const verifyPayload = (
  data: Uint8Array,
  sigContent: string,
  publicKey: MinisignPublicKey
): string | undefined => {
  const lines = Buffer.from(sigContent.trim(), 'base64').toString('utf8').split('\n')
  const [, boxLine, commentLine, globalLine] = lines
  if (boxLine === undefined || commentLine === undefined || globalLine === undefined) {
    return undefined
  }
  const box = Buffer.from(boxLine, 'base64')
  if (box.length !== 74 || box.subarray(0, 2).toString('latin1') !== 'ED') return undefined
  if (!box.subarray(2, 10).equals(publicKey.keyId)) return undefined
  const signature = box.subarray(10, 74)
  if (!verify(null, blake2b512(data), publicKey.publicKey, signature)) return undefined
  if (!commentLine.startsWith('trusted comment: ')) return undefined
  const comment = commentLine.slice('trusted comment: '.length)
  const globalSignature = Buffer.from(globalLine, 'base64')
  if (globalSignature.length !== 64) return undefined
  const covered = Buffer.concat([signature, Buffer.from(comment, 'utf8')])
  return verify(null, covered, publicKey.publicKey, globalSignature) ? comment : undefined
}

/** The updater public key committed in `tauri.conf.json`. */
export const committedPublicKey = (confPath: string = TAURI_CONF_PATH): string => {
  const conf = JSON.parse(readFileSync(confPath, 'utf8')) as {
    readonly plugins?: { readonly updater?: { readonly pubkey?: unknown } }
  }
  const pubkey = conf.plugins?.updater?.pubkey
  if (typeof pubkey !== 'string' || pubkey.trim() === '') {
    throw new TauriSigningError(`${confPath} has no plugins.updater.pubkey.`)
  }
  return pubkey
}

const fail = (message: string): number => {
  process.stderr.write(`${message}\n`)
  return 1
}

const main = (args: readonly string[]): number => {
  const versionIndex = args.indexOf('--version')
  const version = versionIndex === -1 ? undefined : args[versionIndex + 1]
  const payloads = args.filter((_, index) => index !== versionIndex && index !== versionIndex + 1)
  if (version === undefined || version.trim() === '') {
    return fail('Usage: sign-tauri-updater.ts --version <x.y.z> <payload> [<payload>…]')
  }
  if (payloads.length === 0) return fail('No payload named — nothing would be signed.')
  const missing = payloads.filter((payload) => !existsSync(payload))
  if (missing.length > 0) return fail(`No such payload: ${missing.join(', ')}`)
  const secret = process.env[TAURI_KEY_ENV]
  if (secret === undefined || secret.trim() === '') {
    return fail(`Refusing to sign: ${TAURI_KEY_ENV} is not set.`)
  }
  try {
    const key = parseSecretKey(secret, process.env[TAURI_PASSWORD_ENV] ?? '')
    const trusted = parsePublicKey(committedPublicKey())
    if (!key.keyId.equals(trusted.keyId)) {
      return fail(
        `The updater signing key (id ${key.keyId.toString('hex')}) is not the key ${TAURI_CONF_PATH} ` +
          `trusts (id ${trusted.keyId.toString('hex')}). Every installed app would reject these updates.`
      )
    }
    const timestamp = Math.floor(Date.now() / 1000)
    for (const payload of payloads) {
      const data = readFileSync(payload)
      const signature = signPayload(
        data,
        key,
        trustedComment(timestamp, basename(payload), version)
      )
      if (verifyPayload(data, signature, trusted) === undefined) {
        return fail(`The signature over ${payload} does not verify against ${TAURI_CONF_PATH}.`)
      }
      writeFileSync(`${payload}.sig`, signature)
      console.log(`Signed ${payload} -> ${payload}.sig (version ${version})`)
    }
    return 0
  } catch (error) {
    if (error instanceof TauriSigningError) return fail(error.message)
    throw error
  }
}

if (import.meta.main) {
  process.exit(main(Bun.argv.slice(2)))
}
