/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `sovrium library add` refuses an entry that reads an environment variable
 * the config does not declare in `app.env`.
 *
 * A configuration may reference only the variables it declares, so installing
 * an entry whose fragment reads `$env.STRIPE_SECRET_KEY` into an app that does
 * not declare it would leave the app refusing to boot. The install is refused
 * BEFORE anything is written, as a missing table is, and the refusal prints the
 * exact `app.env` lines to add, in the config's own format. The entry is never
 * edited to fit: the operator declares the variable, and runs the command again.
 */

/** The format of the operator's root config, as the lines to paste follow it. */
export type EnvDeclarationFormat = 'yaml' | 'json' | 'typescript'

/** What the refusal needs to know about the install. */
export interface UndeclaredEnvInput {
  readonly entryId: string
  readonly configName: string
  readonly format: EnvDeclarationFormat
  /** The root config as parsed, before the change. */
  readonly parsed: unknown
  /** Every variable the entry and what it requires read, in install order. */
  readonly reads: readonly string[]
}

/** The variables the config declares under `env`. */
export const declaredEnvKeys = (parsed: unknown): ReadonlySet<string> => {
  const env = (parsed as Readonly<Record<string, unknown>> | undefined)?.['env']
  return new Set(
    Array.isArray(env)
      ? env.flatMap((entry: unknown) => {
          const key = (entry as { readonly key?: unknown } | null)?.key
          return typeof key === 'string' ? [key] : []
        })
      : []
  )
}

/** Whether the parsed root already has an `env` list the lines go under. */
const hasEnvList = (parsed: unknown): boolean =>
  Array.isArray((parsed as Readonly<Record<string, unknown>> | undefined)?.['env'])

/** The lines declaring `names`, in the config's own format. */
export const envDeclarationLines = (
  names: readonly string[],
  format: EnvDeclarationFormat,
  withKey: boolean
): readonly string[] => {
  if (format === 'yaml')
    return withKey
      ? ['env:', ...names.map((name) => `  - key: ${name}`)]
      : names.map((name) => `- key: ${name}`)
  const entry = (name: string): string =>
    format === 'json' ? `{ "key": "${name}" }` : `{ key: '${name}' }`
  if (!withKey) return names.map((name) => `${entry(name)},`)
  return format === 'json'
    ? [`"env": [${names.map(entry).join(', ')}],`]
    : [`env: [${names.map(entry).join(', ')}],`]
}

/**
 * The refusal for an install reading variables the config does not declare,
 * or `undefined` when every one is declared.
 */
export const undeclaredEnvMessage = (input: UndeclaredEnvInput): string | undefined => {
  const declared = declaredEnvKeys(input.parsed)
  const missing = [...new Set(input.reads)].filter((name) => !declared.has(name))
  if (missing.length === 0) return undefined
  const withKey = !hasEnvList(input.parsed)
  const plural = missing.length > 1
  const where = withKey ? `to ${input.configName}` : `under env in ${input.configName}`
  return (
    `Error: ${input.entryId} reads the environment variable${plural ? 's' : ''} ${missing.join(', ')}, ` +
    `which ${input.configName} does not declare in env.\n\n` +
    `  Add ${where}:\n\n` +
    envDeclarationLines(missing, input.format, withKey)
      .map((line) => `    ${line}`)
      .join('\n') +
    `\n\n  Then set ${plural ? 'their values' : 'its value'} in your environment (.env) and run the command again.` +
    '\n  Nothing was written.'
  )
}
