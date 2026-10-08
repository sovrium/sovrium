/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The environment of a host that supervises other Sovrium apps through the
 * `instance/*` automation actions.
 *
 * The switch is an environment variable and never a config key: a config
 * cannot grant itself reach over the machine it runs on. Every other app on the
 * machine leaves all five variables unset.
 */

type Env = Readonly<Record<string, string | undefined>>

export const SOVRIUM_HOST_ACTIONS_VAR = 'SOVRIUM_HOST_ACTIONS'
export const SOVRIUM_INSTANCES_DIR_VAR = 'SOVRIUM_INSTANCES_DIR'
export const SOVRIUM_BUNDLE_PUBLIC_KEYS_VAR = 'SOVRIUM_BUNDLE_PUBLIC_KEYS'
export const SOVRIUM_SYSTEMCTL_PATH_VAR = 'SOVRIUM_SYSTEMCTL_PATH'
export const SOVRIUM_JOURNALCTL_PATH_VAR = 'SOVRIUM_JOURNALCTL_PATH'

/**
 * What an `instance/*` action answers, and an app declaring one refuses to boot
 * with, while the switch is off.
 */
export const HOST_ACTIONS_DISABLED_MESSAGE =
  'instance/* is disabled; set SOVRIUM_HOST_ACTIONS=1 on a host dedicated to supervising other Sovrium apps'

const ON_VALUES: ReadonlySet<string> = new Set(['1', 'true'])

/**
 * Whether the switch is on: `1` or `true`. Unset or empty is off — so a parent
 * process that exports the name empty cannot switch it on. Any other value is a
 * typo the boot refuses ({@link parseSovriumHostActions}); read here it is off.
 */
export const isHostActionsEnabled = (env: Env = process.env): boolean =>
  ON_VALUES.has(env[SOVRIUM_HOST_ACTIONS_VAR]?.trim().toLowerCase() ?? '')

/** The boot-time reading of the switch: a value other than `1`, `true` or empty is refused. */
export const parseSovriumHostActions = (env: Env = process.env): boolean => {
  const raw = env[SOVRIUM_HOST_ACTIONS_VAR]?.trim().toLowerCase() ?? ''
  if (raw === '' || ON_VALUES.has(raw)) return raw !== ''
  // eslint-disable-next-line functional/no-throw-statements -- a boot-time refusal: the caller turns it into a startup failure before the port binds.
  throw new Error(
    `${SOVRIUM_HOST_ACTIONS_VAR} must be 1, true or empty; "${env[SOVRIUM_HOST_ACTIONS_VAR] ?? ''}" is not one.`
  )
}

/** The directory holding one folder per supervised app, or `undefined` when unset. */
export const resolveInstancesDir = (env: Env = process.env): string | undefined => {
  const raw = env[SOVRIUM_INSTANCES_DIR_VAR]?.trim() ?? ''
  return raw === '' ? undefined : raw
}

/** The `systemctl` to run: `SOVRIUM_SYSTEMCTL_PATH`, else `systemctl` on the `PATH`. */
export const resolveSystemctlPath = (env: Env = process.env): string =>
  env[SOVRIUM_SYSTEMCTL_PATH_VAR]?.trim() || 'systemctl'

/** The `journalctl` to run: `SOVRIUM_JOURNALCTL_PATH`, else `journalctl` on the `PATH`. */
export const resolveJournalctlPath = (env: Env = process.env): string =>
  env[SOVRIUM_JOURNALCTL_PATH_VAR]?.trim() || 'journalctl'

const KEY_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/
const KEY_TEXT = /^[A-Za-z0-9+/]{43}=$/

/** One trusted Ed25519 public key: its identifier and its 32 raw bytes in base64. */
export interface TrustedPublicKey {
  readonly keyId: string
  readonly publicKey: string
}

/** Why an entry of a public keyring cannot be read, or `undefined`. */
const entryProblem = (entry: string): string | undefined => {
  const colon = entry.indexOf(':')
  if (colon === -1) return `"${entry}" is not <id>:<base64>`
  const keyId = entry.slice(0, colon)
  if (!KEY_ID.test(keyId)) return `"${keyId}" is not a key identifier`
  return KEY_TEXT.test(entry.slice(colon + 1))
    ? undefined
    : `the key of "${keyId}" is not 32 bytes in base64`
}

const splitEntries = (raw: string): readonly string[] =>
  raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '')

const toTrustedKey = (entry: string): TrustedPublicKey => {
  const colon = entry.indexOf(':')
  return { keyId: entry.slice(0, colon), publicKey: entry.slice(colon + 1) }
}

/**
 * The trusted keys, `<id>:<base64>[,…]`, refusing a malformed value at boot so
 * a typo in the keyring is not discovered as a refused release.
 */
export const parseSovriumBundlePublicKeys = (env: Env = process.env): readonly TrustedPublicKey[] =>
  parsePublicKeyring(SOVRIUM_BUNDLE_PUBLIC_KEYS_VAR, env)

/**
 * Read the keyring held by `varName`, in the `<id>:<base64>[,…]` format of
 * `SOVRIUM_BUNDLE_PUBLIC_KEYS`. Shared by every variable that names trusted
 * Ed25519 keys, so they all accept, and refuse, exactly the same text. A
 * malformed entry throws, naming the variable.
 */
export const parsePublicKeyring = (
  varName: string,
  env: Env = process.env
): readonly TrustedPublicKey[] => {
  const entries = splitEntries(env[varName] ?? '')
  const problem = entries.map(entryProblem).find((found) => found !== undefined)
  if (problem !== undefined) {
    // eslint-disable-next-line functional/no-throw-statements -- a configuration refusal: every caller turns it into a failure before acting on the keyring.
    throw new Error(`${varName} must be <id>:<base64>[,…]; ${problem}.`)
  }
  return entries.map(toTrustedKey)
}

/**
 * The base64 public key `keyId` names in the keyring, or `undefined` when the
 * keyring holds no well-formed entry of that name. Never throws: the boot has
 * already refused a malformed keyring.
 */
export const findBundlePublicKey = (keyId: string, env: Env = process.env): string | undefined =>
  splitEntries(env[SOVRIUM_BUNDLE_PUBLIC_KEYS_VAR] ?? '')
    .filter((entry) => entryProblem(entry) === undefined)
    .map(toTrustedKey)
    .find((key) => key.keyId === keyId)?.publicKey
