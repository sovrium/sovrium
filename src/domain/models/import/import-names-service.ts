/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The names `sovrium import` gives what it creates.
 *
 * A source tool names things for people — `Full name`, `Weekly pipeline
 * digest`, `Inès's list` — and Sovrium names them for a config: a table or a
 * field is `snake_case`, an automation or a form is `kebab-case`. The
 * conversion is deterministic, so the same source always yields the same
 * names, and the original stays in the field's `label` and in the report.
 *
 * `--prefix` is ONE flag for every target: its value is normalised to the
 * target's own spelling, so `--prefix crm_` and `--prefix crm-` both give the
 * table `crm_contacts` and the automation `crm-weekly-digest`.
 */

import { isReservedSqlKeyword } from '@/domain/kernel/sql/database-identifier'

/** The two spellings Sovrium names use. */
export type NameStyle = 'snake' | 'kebab'

const separatorOf = (style: NameStyle): string => (style === 'snake' ? '_' : '-')

/** Accents folded, everything outside `[a-z0-9]` a separator, runs collapsed. */
const words = (text: string): readonly string[] =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word !== '')

/**
 * A source label as a Sovrium name in the given style. A label that holds no
 * letter or digit becomes `fallback`; one that starts with a digit is
 * prefixed with it, because a Sovrium name starts with a letter.
 */
export const toSovriumName = (label: string, style: NameStyle, fallback: string): string => {
  const joined = words(label).join(separatorOf(style))
  if (joined === '') return fallback
  return /^[a-z]/.test(joined) ? joined : `${fallback}${separatorOf(style)}${joined}`
}

/** `Full name` → `full_name`. */
export const toSnakeName = (label: string, fallback = 'field'): string =>
  toSovriumName(label, 'snake', fallback)

/** `Weekly pipeline digest` → `weekly-pipeline-digest`. */
export const toKebabName = (label: string, fallback = 'item'): string =>
  toSovriumName(label, 'kebab', fallback)

/**
 * A table or field name that is not a reserved SQL keyword: `key`, `order` or
 * `user` gains a suffix (`key_field`, `order_table`), which a config would
 * otherwise refuse.
 */
export const avoidReservedName = (name: string, suffix: 'field' | 'table'): string =>
  isReservedSqlKeyword(name) ? `${name}_${suffix}` : name

/**
 * `--prefix` applied to a name, the prefix normalised to the name's style and
 * ending in its separator. An empty or absent prefix leaves the name alone.
 */
export const prefixedName = (
  prefix: string | undefined,
  name: string,
  style: NameStyle
): string => {
  if (prefix === undefined) return name
  const normalised = words(prefix).join(separatorOf(style))
  return normalised === '' ? name : `${normalised}${separatorOf(style)}${name}`
}

/**
 * The name of an action the import adds for a step, such as the no-op of a
 * branch's `otherwise` path: the step's action name, two underscores, then
 * the role, and its position when there are several. A source label never
 * yields two underscores in a row, so the name cannot clash with a step's.
 * `is_example_lead` → `is_example_lead__otherwise`, `route__skip_2`.
 */
export const derivedActionName = (owner: string, role: string, position?: number): string =>
  position === undefined ? `${owner}__${role}` : `${owner}__${role}_${String(position)}`

/**
 * Names made unique in order: the second `email` becomes `email_2`, and a name
 * already taken by `taken` is numbered too. The first occurrence keeps its name.
 */
export const uniqueNames = (
  names: readonly string[],
  style: NameStyle,
  taken: ReadonlySet<string> = new Set()
): readonly string[] =>
  names.reduce<{ readonly out: readonly string[]; readonly used: ReadonlySet<string> }>(
    (state, name) => {
      const candidate = (n: number): string =>
        n === 1 ? name : `${name}${separatorOf(style)}${String(n)}`
      const first = Array.from({ length: state.used.size + 2 }, (_unused, i) => i + 1).find(
        (n) => !state.used.has(candidate(n))
      )
      const chosen = candidate(first ?? 1)
      return { out: [...state.out, chosen], used: new Set([...state.used, chosen]) }
    },
    { out: [], used: taken }
  ).out

/** The longest table or field name Sovrium accepts: PostgreSQL's identifier limit. */
export const MAX_NAME_LENGTH = 63

/** A 32-bit FNV-1a hash of a text, as eight hex digits: the same text, the same digits. */
const shortHash = (text: string): string =>
  (
    Array.from(text).reduce(
      (hash, char) => Math.imul(hash ^ (char.codePointAt(0) ?? 0), 0x01_00_01_93),
      0x81_1c_9d_c5
    ) >>> 0
  )
    .toString(16)
    .padStart(8, '0')

/** The longest automation name Sovrium accepts (`automations[].name`). */
export const MAX_AUTOMATION_NAME_LENGTH = 100

/**
 * A name cut to `max` ({@link MAX_NAME_LENGTH} by default): a longer one keeps
 * its start and ends with a hash of the whole name (`very_long_…_3f9a07c2`),
 * so two long names that share their start still end apart, and the same name
 * always gets the same cut. A name that fits is left alone.
 */
export const fitName = (name: string, style: NameStyle, max = MAX_NAME_LENGTH): string => {
  if (name.length <= max) return name
  const separator = separatorOf(style)
  const hash = shortHash(name)
  const head = name.slice(0, max - hash.length - separator.length)
  return `${head.replace(/[-_]+$/, '')}${separator}${hash}`
}

/** The pattern a seed `key` must match (`SEED_KEY_PATTERN` in the seed format). */
const SEED_KEY = /^[A-Za-z0-9][A-Za-z0-9_-]*$/

/**
 * A source record id as a seed `key`. Most ids already fit (`recPrj01`,
 * `inv_8812`); one that does not has every other character replaced by `-`,
 * and gains a `k` when it would start with a separator. The `source_id` column
 * keeps the id unchanged, so nothing is lost.
 */
export const seedKeyOf = (sourceId: string): string => {
  if (SEED_KEY.test(sourceId)) return sourceId
  const replaced = sourceId.replace(/[^A-Za-z0-9_-]/g, '-')
  return /^[A-Za-z0-9]/.test(replaced) ? replaced : `k${replaced}`
}

/**
 * Seed keys for a table's records, made unique in record order: two ids that
 * sanitise to the same key are told apart by a `-2` suffix.
 */
export const seedKeysOf = (sourceIds: readonly string[]): readonly string[] =>
  uniqueNames(sourceIds.map(seedKeyOf), 'kebab')
