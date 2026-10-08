/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Sign release archives with the project's Ed25519 release key.
 *
 * Writes one detached signature per asset, `<asset>.sig`, holding the base64
 * of the 64-byte Ed25519 signature over the asset's exact bytes. The `.sha256`
 * published beside an archive comes from the same release a tamperer would
 * edit, so it proves integrity and never authorship; the signature does, once
 * the public key is embedded in the binary that verifies it.
 *
 * ## Fail closed
 *
 * A release without signatures must not look like a release with them. When
 * `SOVRIUM_RELEASE_SIGNING_KEY` is unset or empty this exits 1 and says why —
 * there is no "skip". After signing, every signature is verified against the
 * public half DERIVED from the same key, and the derived public key is printed,
 * so a key that does not match the embedded one is visible in the run log.
 *
 * ## Key formats accepted
 *
 * `SOVRIUM_RELEASE_SIGNING_KEY` may hold, in order of preference:
 *   - a PEM `PRIVATE KEY` block (what `openssl genpkey -algorithm ed25519` writes);
 *   - the base64 of the PKCS#8 DER (48 bytes for Ed25519);
 *   - the base64 of the raw 32-byte seed.
 * A public key for `--verify` may be the base64 of the raw 32 bytes (the form
 * embedded in the binary) or of the SPKI DER (44 bytes).
 *
 * `node:crypto` `sign(null, …)` / `verify(null, …)`: Ed25519 hashes internally,
 * so the digest argument is null. Measured working in the compiled binary on
 * darwin, linux-x64 and linux-arm64 before this was written.
 *
 * Usage:
 *   SOVRIUM_RELEASE_SIGNING_KEY=… bun run scripts/build/sign-asset.ts <asset> [<asset>…]
 *   bun run scripts/build/sign-asset.ts --verify <asset> <asset.sig> <publicKeyBase64>
 */

import { createPrivateKey, createPublicKey, sign, verify, type KeyObject } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { printStderr } from '@/infrastructure/logging/cli-output'

/** The environment variable the CI step fills from the repository secret. */
export const SIGNING_KEY_ENV = 'SOVRIUM_RELEASE_SIGNING_KEY'

/** DER prefix turning a raw 32-byte Ed25519 seed into PKCS#8. */
const PKCS8_ED25519_PREFIX = Buffer.from('302e020100300506032b657004220420', 'hex')

/** DER prefix turning a raw 32-byte Ed25519 public key into SPKI. */
const SPKI_ED25519_PREFIX = Buffer.from('302a300506032b6570032100', 'hex')

/** Thrown for any key or signature that is not usable; the message is the operator's. */
export class SigningInputError extends Error {}

const requireEd25519 = (key: KeyObject, what: string): KeyObject => {
  if (key.asymmetricKeyType !== 'ed25519') {
    throw new SigningInputError(
      `${what} is a ${key.asymmetricKeyType ?? 'non-asymmetric'} key, not Ed25519.`
    )
  }
  return key
}

const decodeBase64 = (value: string, what: string): Buffer => {
  const compact = value.replace(/\s+/g, '')
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(compact)) {
    throw new SigningInputError(`${what} is neither PEM nor base64.`)
  }
  return Buffer.from(compact, 'base64')
}

/** Parse the private signing key from any of the accepted encodings. */
export const parsePrivateKey = (value: string): KeyObject => {
  const trimmed = value.trim()
  if (trimmed === '') throw new SigningInputError('The signing key is empty.')
  if (trimmed.startsWith('-----BEGIN')) {
    return requireEd25519(createPrivateKey(trimmed), 'The signing key')
  }
  const der = decodeBase64(trimmed, 'The signing key')
  const pkcs8 = der.length === 32 ? Buffer.concat([PKCS8_ED25519_PREFIX, der]) : der
  try {
    return requireEd25519(
      createPrivateKey({ key: pkcs8, format: 'der', type: 'pkcs8' }),
      'The signing key'
    )
  } catch (error) {
    if (error instanceof SigningInputError) throw error
    throw new SigningInputError(
      `The signing key is not a PKCS#8 DER or a 32-byte seed (${der.length} bytes decoded).`
    )
  }
}

/** Parse a public key given as raw 32 bytes or SPKI DER, both base64. */
export const parsePublicKey = (value: string): KeyObject => {
  const der = decodeBase64(value.trim(), 'The public key')
  const spki = der.length === 32 ? Buffer.concat([SPKI_ED25519_PREFIX, der]) : der
  try {
    return requireEd25519(
      createPublicKey({ key: spki, format: 'der', type: 'spki' }),
      'The public key'
    )
  } catch (error) {
    if (error instanceof SigningInputError) throw error
    throw new SigningInputError(
      `The public key is not a raw 32-byte key or an SPKI DER (${der.length} bytes decoded).`
    )
  }
}

/** The raw 32-byte public key, base64 — the form embedded in the binary. */
export const rawPublicKeyBase64 = (key: KeyObject): string => {
  const spki = createPublicKey(key).export({ format: 'der', type: 'spki' })
  return spki.subarray(SPKI_ED25519_PREFIX.length).toString('base64')
}

/** The base64 detached signature over `data`. */
export const signBytes = (data: Uint8Array, privateKey: KeyObject): string =>
  sign(null, data, privateKey).toString('base64')

/** Whether `signatureBase64` is a valid signature over `data` for `publicKey`. */
export const verifyBytes = (
  data: Uint8Array,
  signatureBase64: string,
  publicKey: KeyObject
): boolean => {
  const signature = Buffer.from(signatureBase64.trim(), 'base64')
  if (signature.length !== 64) return false
  return verify(null, data, publicKey, signature)
}

const signAssets = (assets: readonly string[]): number => {
  const secret = process.env[SIGNING_KEY_ENV]
  if (secret === undefined || secret.trim() === '') {
    printStderr(
      `Refusing to publish unsigned archives: ${SIGNING_KEY_ENV} is not set.\n` +
        '  The release signing key is custodial: a CI secret plus an offline copy the\n' +
        '  maintainer holds. Generate it and set the secret before cutting a release.'
    )
    return 1
  }
  if (assets.length === 0) {
    printStderr('No asset named — nothing would be signed.')
    return 1
  }
  const missing = assets.filter((asset) => !existsSync(asset))
  if (missing.length > 0) {
    printStderr(`No such asset: ${missing.join(', ')}`)
    return 1
  }

  const privateKey = parsePrivateKey(secret)
  const publicKey = createPublicKey(privateKey)
  for (const asset of assets) {
    const data = readFileSync(asset)
    const signature = signBytes(data, privateKey)
    if (!verifyBytes(data, signature, publicKey)) {
      printStderr(`The signature over ${asset} does not verify against its own key.`)
      return 1
    }
    writeFileSync(`${asset}.sig`, `${signature}\n`)
    console.log(`Signed ${asset} -> ${asset}.sig`)
  }
  console.log(`Public key (raw, base64): ${rawPublicKeyBase64(privateKey)}`)
  return 0
}

const verifyAsset = (args: readonly string[]): number => {
  const [asset, signatureFile, publicKey] = args
  if (asset === undefined || signatureFile === undefined || publicKey === undefined) {
    printStderr('Usage: sign-asset.ts --verify <asset> <asset.sig> <publicKeyBase64>')
    return 2
  }
  const valid = verifyBytes(
    readFileSync(asset),
    readFileSync(signatureFile, 'utf8'),
    parsePublicKey(publicKey)
  )
  if (!valid) {
    printStderr(`The signature in ${signatureFile} does not match ${asset} for that key.`)
    return 1
  }
  console.log(`Verified ${asset} against ${signatureFile}`)
  return 0
}

const main = (args: readonly string[]): number => {
  try {
    return args[0] === '--verify' ? verifyAsset(args.slice(1)) : signAssets(args)
  } catch (error) {
    if (error instanceof SigningInputError) {
      printStderr(error.message)
      return 1
    }
    throw error
  }
}

if (import.meta.main) {
  process.exit(main(Bun.argv.slice(2)))
}
