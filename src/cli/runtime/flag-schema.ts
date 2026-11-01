/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A command's flags, declared once and read once.
 *
 * A verb declares the flags it reads with {@link defineFlags}, beside its
 * handler; the dispatcher reads them off the command line with
 * {@link parseFlags} before the verb runs, and the verb receives them typed.
 * No verb reads the command line for a flag itself: the declaration is the
 * one place that says which flags a verb has and how each is spelled.
 *
 * The readers below are the only code that reads a flag off the command line.
 * Whether a flag is ACCEPTED at all is `findUnknownFlag`'s question
 * (`flag-vocabulary.ts`), asked before any verb runs.
 */

/** A value flag read in both spellings: whether it was given, and its value if it had one. */
export interface ValueFlagReading {
  readonly given: boolean
  readonly value?: string
}

/** Everything the command line says about one flag, for a verb that judges its spelling. */
export interface FlagOccurrence {
  /** Given as `--flag` or `--flag=…`, anywhere. */
  readonly given: boolean
  /** Given as `--flag` exactly. */
  readonly bare: boolean
  /** Given as `--flag=…`. */
  readonly joined: boolean
  /** The first token that names it, in either spelling. */
  readonly first: string | undefined
  /** The token after its first bare `--flag`; absent at the end of the line or when not bare. */
  readonly next: string | undefined
}

/** How one flag is read. */
export type FlagSpec =
  /** `true` when any of the names is on the command line, exactly. */
  | { readonly kind: 'switch'; readonly names: readonly string[] }
  /** The token after the flag, whatever it is. */
  | { readonly kind: 'value'; readonly name: string }
  /** The token after the flag, unless it is itself a flag. */
  | { readonly kind: 'path'; readonly name: string }
  /** Every value of a repeatable flag, in order. */
  | { readonly kind: 'values'; readonly name: string }
  /** `--flag value` or `--flag=value`, and whether it was given at all. */
  | { readonly kind: 'named'; readonly name: string }
  /** The flag's spelling on the command line. */
  | { readonly kind: 'occurrence'; readonly name: string }

/** A verb's flags: the key it reads each one as, and how it is read. */
export type FlagSchema = Readonly<Record<string, FlagSpec>>

/** What one spec reads as. */
export type FlagValue<S extends FlagSpec> = S extends { readonly kind: 'switch' }
  ? boolean
  : S extends { readonly kind: 'value' | 'path' }
    ? string | undefined
    : S extends { readonly kind: 'values' }
      ? readonly string[]
      : S extends { readonly kind: 'named' }
        ? ValueFlagReading
        : FlagOccurrence

/** A schema's flags, read: one typed value per key. */
export type FlagsOf<S extends FlagSchema> = { readonly [K in keyof S]: FlagValue<S[K]> }

/** The constructors of a {@link FlagSpec}, one per kind. */
export const flag = {
  switch: (...names: readonly string[]) => ({ kind: 'switch', names }) as const,
  value: (name: string) => ({ kind: 'value', name }) as const,
  path: (name: string) => ({ kind: 'path', name }) as const,
  values: (name: string) => ({ kind: 'values', name }) as const,
  named: (name: string) => ({ kind: 'named', name }) as const,
  occurrence: (name: string) => ({ kind: 'occurrence', name }) as const,
}

/** Declare a verb's flags. The identity, typed: the keys and kinds survive into {@link FlagsOf}. */
export const defineFlags = <const S extends FlagSchema>(schema: S): S => schema

const getFlagValue = (argv: readonly string[], name: string): string | undefined => {
  const index = argv.indexOf(name)
  return index !== -1 ? argv[index + 1] : undefined
}

/**
 * A value flag's value, where a following FLAG counts as no value at all.
 *
 * `getFlagValue` returns the next token whatever it is, which would read
 * `docs --export --full` as an export into a directory named `--full`. For a
 * flag whose value is a path the caller will write into, that is the wrong
 * guess in the most expensive direction.
 */
const getFlagPathValue = (argv: readonly string[], name: string): string | undefined => {
  const value = getFlagValue(argv, name)
  return value === undefined || value.startsWith('-') ? undefined : value
}

/**
 * A value flag read in both spellings, `--flag value` and `--flag=value`.
 *
 * `given` says the flag is on the command line; `value` is absent when it was
 * given none — at the end of the line, before another flag, or as `--flag=`.
 * A command that addresses something remote refuses that case rather than
 * falling back to a default: `--app` with no slug deploying to the linked app
 * is the wrong guess in the most expensive direction.
 */
const readValueFlag = (
  argv: readonly string[],
  name: string
): { readonly given: boolean; readonly value?: string } => {
  const joined = argv.find((arg) => arg.startsWith(`${name}=`))
  if (joined !== undefined) {
    const value = joined.slice(name.length + 1)
    return value === '' ? { given: true } : { given: true, value }
  }
  if (!argv.includes(name)) return { given: false }
  const next = argv[argv.indexOf(name) + 1]
  return next === undefined || next.startsWith('-') ? { given: true } : { given: true, value: next }
}

/**
 * Every value of a repeatable value flag, in argv order.
 *
 * `getFlagValue` uses `indexOf`, which stops at the first occurrence — correct
 * for `--output`, wrong for `--table`. A trailing `--table` with no argument
 * contributes nothing rather than swallowing the next flag.
 */

const getFlagValues = (argv: readonly string[], name: string): readonly string[] =>
  argv.flatMap((arg, index) => {
    if (arg !== name) return []
    const value = argv[index + 1]
    return value === undefined || value.startsWith('-') ? [] : [value]
  })

const namesFlag = (arg: string, name: string): boolean => arg === name || arg.startsWith(`${name}=`)

const occurrenceOf = (argv: readonly string[], name: string): FlagOccurrence => {
  const bareAt = argv.indexOf(name)
  return {
    given: argv.some((arg) => namesFlag(arg, name)),
    bare: bareAt !== -1,
    joined: argv.some((arg) => arg.startsWith(`${name}=`)),
    first: argv.find((arg) => namesFlag(arg, name)),
    next: bareAt === -1 ? undefined : argv[bareAt + 1],
  }
}

const readSpec = (argv: readonly string[], spec: FlagSpec): FlagValue<FlagSpec> => {
  switch (spec.kind) {
    case 'switch':
      return spec.names.some((name) => argv.includes(name))
    case 'value':
      return getFlagValue(argv, spec.name)
    case 'path':
      return getFlagPathValue(argv, spec.name)
    case 'values':
      return getFlagValues(argv, spec.name)
    case 'named':
      return readValueFlag(argv, spec.name)
    case 'occurrence':
      return occurrenceOf(argv, spec.name)
  }
}

/** Read a schema's flags off the command line. */
export const parseFlags = <S extends FlagSchema>(schema: S, argv: readonly string[]): FlagsOf<S> =>
  Object.fromEntries(
    Object.entries(schema).map(([key, spec]) => [key, readSpec(argv, spec)])
  ) as FlagsOf<S>

/** Every flag name a schema reads, for checking it against the accepted vocabulary. */
export const flagNamesOf = (schema: FlagSchema): readonly string[] =>
  Object.values(schema).flatMap((spec) => (spec.kind === 'switch' ? spec.names : [spec.name]))
