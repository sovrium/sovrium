/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { createPrivateKey, X509Certificate } from 'node:crypto'
import { Result, Schema } from 'effect'
import { blankToUndefined } from '@/domain/kernel/config-parsing/blank-text'

/**
 * The signing variables: the organisation's seal, the timestamp authority and
 * the secret one-time codes are derived from.
 *
 * Env vars: SIGNATURE_SEAL_KEY, SIGNATURE_SEAL_CERT_CHAIN, SIGNATURE_TSA_URL,
 *           SIGNATURE_OTP_SECRET
 *
 * ─── WHY THESE ARE ENV VARS AND NOT CONFIG KEYS ────────────────────────────
 *
 * A private key and the secret behind every one-time code are credentials of
 * the DEPLOYMENT. A config file is versioned, shared and read by the console;
 * a key in it would be published with it. The same app config runs in staging
 * with a test seal and in production with the real one.
 *
 * ─── WHAT EACH ONE DECIDES ─────────────────────────────────────────────────
 *
 * - The seal (key and chain, both or neither) is the ORGANISATION's: it says
 *   the document left this server unchanged, never who signed. Unset, a flow
 *   completes with an unsealed signed document and the proof file says so.
 * - The timestamp authority anchors the event log in time. Unset, the log
 *   still detects an accidental change, but nothing outside the server can
 *   show that the operator did not rewrite it.
 * - The one-time-code secret is required as soon as one flow declares
 *   `verify`; a boot without it is refused, naming the flow.
 */

/** Shortest accepted one-time-code secret, in characters. */
export const MIN_SIGNATURE_OTP_SECRET_LENGTH = 32

const PEM_BLOCK = /-----BEGIN [A-Z ]+-----[\s\S]+-----END [A-Z ]+-----/

const pem = (description: string) =>
  Schema.String.pipe(
    Schema.annotate({ description }),
    Schema.check(
      Schema.isPattern(PEM_BLOCK, { message: 'expected a PEM block (-----BEGIN …-----)' })
    )
  )

/** The raw `SIGNATURE_*` variables, decoded. Every key is optional: unset means not used. */
export const SignatureEnvSchema = Schema.Struct({
  sealKey: Schema.optional(
    pem(
      'Private key of the organisation seal, PEM: RSA of 2048 bits or more, or ECDSA P-256 / P-384 (SIGNATURE_SEAL_KEY)'
    )
  ),
  sealCertChain: Schema.optional(
    pem(
      'Certificate of the seal key followed by its issuing certificates, PEM (SIGNATURE_SEAL_CERT_CHAIN)'
    )
  ),
  tsaUrl: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description:
          'URL of an RFC 3161 timestamp authority; redirects are refused (SIGNATURE_TSA_URL)',
        examples: ['https://freetsa.org/tsr'],
      }),
      Schema.check(Schema.isPattern(/^https?:\/\/\S+$/))
    )
  ),
  otpSecret: Schema.optional(
    Schema.String.pipe(
      Schema.annotate({
        description:
          'Secret the one-time codes are derived from, at least 32 characters; required once a flow declares verify (SIGNATURE_OTP_SECRET)',
      }),
      Schema.check(Schema.isMinLength(MIN_SIGNATURE_OTP_SECRET_LENGTH))
    )
  ),
})

/** The signing settings of this deployment. */
export interface SignatureEnvConfig {
  readonly seal?: { readonly key: string; readonly certChain: string }
  readonly tsaUrl?: string
  readonly otpSecret?: string
}

/** The outcome of reading the signing variables, or the operator-facing reason they are invalid. */
export type SignatureEnvParse =
  | { readonly ok: true; readonly config: SignatureEnvConfig }
  | { readonly ok: false; readonly error: string }

const INVALID =
  'The SIGNATURE_* variables are invalid: SIGNATURE_SEAL_KEY and SIGNATURE_SEAL_CERT_CHAIN must be PEM blocks, SIGNATURE_TSA_URL an http(s) URL, and SIGNATURE_OTP_SECRET at least 32 characters.'

/**
 * Read the signing variables from an env snapshot.
 *
 * Total: an invalid value, or a seal key without its chain (or the reverse),
 * is `{ ok: false }` with a message startup turns into a refused boot.
 *
 * @public
 */
export const parseSignatureEnv = (
  env: Readonly<Record<string, string | undefined>>
): SignatureEnvParse => {
  const decoded = Schema.decodeResult(SignatureEnvSchema)({
    sealKey: blankToUndefined(env['SIGNATURE_SEAL_KEY']),
    sealCertChain: blankToUndefined(env['SIGNATURE_SEAL_CERT_CHAIN']),
    tsaUrl: blankToUndefined(env['SIGNATURE_TSA_URL']),
    otpSecret: blankToUndefined(env['SIGNATURE_OTP_SECRET']),
  })
  if (Result.isFailure(decoded)) return { ok: false, error: INVALID }
  const raw = decoded.success
  if ((raw.sealKey === undefined) !== (raw.sealCertChain === undefined)) {
    return {
      ok: false,
      error:
        'SIGNATURE_SEAL_KEY and SIGNATURE_SEAL_CERT_CHAIN go together: set both to seal signed documents, or neither.',
    }
  }
  return {
    ok: true,
    config: {
      ...(raw.sealKey !== undefined && raw.sealCertChain !== undefined
        ? { seal: { key: raw.sealKey, certChain: raw.sealCertChain } }
        : {}),
      ...(raw.tsaUrl !== undefined ? { tsaUrl: raw.tsaUrl } : {}),
      ...(raw.otpSecret !== undefined ? { otpSecret: raw.otpSecret } : {}),
    },
  }
}

/**
 * Why a boot is refused for lack of an OTP secret, or `undefined` when none is
 * needed or one is set: `verifyingFlows` names the flows declaring `verify`.
 *
 * @public
 */
export const missingOtpSecretRefusal = (
  config: SignatureEnvConfig,
  verifyingFlows: readonly string[]
): string | undefined =>
  verifyingFlows.length === 0 || config.otpSecret !== undefined
    ? undefined
    : `SIGNATURE_OTP_SECRET is required: signing flow ${verifyingFlows.map((name) => `"${name}"`).join(', ')} declares verify. Generate one with sovrium secret generate.`

/** The seal's key and certificates, checked usable: one PEM key, the chain one PEM block per certificate. */
export interface SealMaterial {
  readonly keyPem: string
  /** The seal certificate first, then each issuer. */
  readonly chainPem: readonly string[]
}

/** The outcome of checking a seal: its material, or the operator-facing reason it cannot seal. */
export type SealMaterialCheck =
  | { readonly ok: true; readonly material: SealMaterial }
  | { readonly ok: false; readonly error: string }

/** The smallest RSA modulus a seal key may have, in bits. */
export const MIN_SEAL_RSA_BITS = 2048

/** The curves a seal key may be on: P-256 and P-384. */
const SEAL_CURVES: ReadonlySet<string> = new Set(['prime256v1', 'secp384r1'])

const CERTIFICATE_BLOCK = /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g

const KEY_ACCEPTED =
  'An RSA key of 2048 bits or more, or an ECDSA key on P-256 or P-384, is accepted.'

/** What a seal key is, as far as the seal cares. */
interface SealKeyShape {
  readonly type: string | undefined
  readonly bits: number
  readonly curve: string | undefined
}

/** The shape of the key `pem` holds, or `undefined` when it holds no private key this server reads. */
const sealKeyShapeOf = (pem: string): SealKeyShape | undefined => {
  try {
    const key = createPrivateKey(pem)
    const details = key.asymmetricKeyDetails
    return {
      type: key.asymmetricKeyType,
      bits: details?.modulusLength ?? 0,
      curve: details?.namedCurve,
    }
  } catch {
    return undefined
  }
}

/** Why a key of `shape` cannot seal, or `undefined`. */
const sealKeyRefusal = (shape: SealKeyShape | undefined): string | undefined => {
  if (shape === undefined) {
    return `SIGNATURE_SEAL_KEY is not a private key this server can read (an encrypted key, or an RSA-PSS key, is not). ${KEY_ACCEPTED}`
  }
  if (shape.type === 'rsa') {
    return shape.bits >= MIN_SEAL_RSA_BITS
      ? undefined
      : `SIGNATURE_SEAL_KEY is an RSA key of ${String(shape.bits)} bits. ${KEY_ACCEPTED}`
  }
  if (shape.type === 'ec' && SEAL_CURVES.has(shape.curve ?? '')) return undefined
  const curve = shape.curve === undefined ? '' : ` on ${shape.curve}`
  return `SIGNATURE_SEAL_KEY is a ${shape.type ?? 'unknown'} key${curve}. ${KEY_ACCEPTED}`
}

/** Whether the certificate `certificate` names the private key `keyPem`. */
const namesKey = (certificate: Readonly<X509Certificate>, keyPem: string): boolean => {
  try {
    return certificate.checkPrivateKey(createPrivateKey(keyPem))
  } catch {
    return false
  }
}

/** The certificate `pem` holds, or `undefined`. */
const certificateOf = (pem: string): X509Certificate | undefined => {
  try {
    return new X509Certificate(pem)
  } catch {
    return undefined
  }
}

/**
 * Check that a configured seal can sign: the key is one the seal accepts
 * (RSA of 2048 bits or more, ECDSA P-256 or P-384), every block of the chain
 * is a certificate, and the first certificate is the key's.
 *
 * Total: a seal that cannot sign is `{ ok: false }` with the sentence the
 * boot refuses with, naming neither the key nor any part of it.
 *
 * @public
 */
export const checkSealMaterial = (seal: {
  readonly key: string
  readonly certChain: string
}): SealMaterialCheck => {
  const keyRefusal = sealKeyRefusal(sealKeyShapeOf(seal.key))
  if (keyRefusal !== undefined) return { ok: false, error: keyRefusal }
  const chainPem = seal.certChain.match(CERTIFICATE_BLOCK) ?? []
  const certificates = chainPem.map(certificateOf)
  const [leaf] = certificates
  if (leaf === undefined || certificates.some((certificate) => certificate === undefined)) {
    return {
      ok: false,
      error:
        'SIGNATURE_SEAL_CERT_CHAIN must hold the seal certificate, then its issuing certificates, each a PEM CERTIFICATE block.',
    }
  }
  if (!namesKey(leaf, seal.key)) {
    return {
      ok: false,
      error:
        'The first certificate of SIGNATURE_SEAL_CERT_CHAIN is not the certificate of SIGNATURE_SEAL_KEY: put the seal certificate first.',
    }
  }
  return { ok: true, material: { keyPem: seal.key, chainPem } }
}

/**
 * Why the signing variables refuse a boot, or `undefined`: a value that does
 * not decode, a seal key without its chain, or a seal that cannot sign.
 *
 * @public
 */
export const signatureEnvRefusal = (
  env: Readonly<Record<string, string | undefined>>
): string | undefined => {
  const parsed = parseSignatureEnv(env)
  if (!parsed.ok) return parsed.error
  const { seal } = parsed.config
  if (seal === undefined) return undefined
  const checked = checkSealMaterial(seal)
  return checked.ok ? undefined : checked.error
}
