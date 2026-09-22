/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Pure parsing + validation for named image-transform presets.
 *
 * Presets are operator-controlled shorthand for a set of transform parameters
 * (e.g. a `thumbnail` preset that resizes to 150x150 `cover`). They are
 * configured via the `STORAGE_TRANSFORM_PRESETS` environment variable (an
 * operator concern — NOT part of the app schema) and consumed by the bucket
 * file download route's `?preset=` query parameter.
 *
 * All functions here are pure — the image pipeline lives in the infrastructure
 * layer, and the env-var read happens at the route / server-startup boundary.
 */

import { parseTransformParams } from './image-transform-params'
import type { TransformParseResult } from './image-transform-params'

/**
 * The raw, per-preset configuration shape an operator declares in the
 * `STORAGE_TRANSFORM_PRESETS` JSON object. Every field is optional — a preset
 * may set only a subset (e.g. just `width`). Field semantics mirror the
 * `?width=&height=&fit=&quality=&format=` download query parameters.
 */
export interface PresetConfig {
  readonly width?: number
  readonly height?: number
  readonly fit?: string
  readonly quality?: number
  readonly format?: string
}

/** A validated, parsed map of preset name → preset configuration. */
export type PresetMap = ReadonlyMap<string, PresetConfig>

/** Result of parsing the `STORAGE_TRANSFORM_PRESETS` env var. */
export type PresetParseResult =
  | { readonly ok: true; readonly presets: PresetMap }
  | { readonly ok: false; readonly error: string }

/**
 * Preset names must be alphanumeric with optional hyphens (e.g. `thumbnail`,
 * `hero-banner`). This keeps preset names safe to embed in URLs and matches
 * [internal ref].
 */
const PRESET_NAME_PATTERN = /^[a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)*$/

/** True when a preset name satisfies the alphanumeric-with-hyphens contract. */
export const isValidPresetName = (name: string): boolean => PRESET_NAME_PATTERN.test(name)

/** The only keys a preset may declare. Anything else is refused at startup. */
const PRESET_KEYS: ReadonlySet<string> = new Set(['width', 'height', 'fit', 'quality', 'format'])

/**
 * Coerce a raw preset config value into the recognised `PresetConfig` shape.
 * Numeric fields are passed through verbatim for the downstream
 * `parseTransformParams` to range-check.
 */
const toPresetConfig = (raw: Readonly<Record<string, unknown>>): PresetConfig => ({
  ...(typeof raw['width'] === 'number' && { width: raw['width'] }),
  ...(typeof raw['height'] === 'number' && { height: raw['height'] }),
  ...(typeof raw['fit'] === 'string' && { fit: raw['fit'] }),
  ...(typeof raw['quality'] === 'number' && { quality: raw['quality'] }),
  ...(typeof raw['format'] === 'string' && { format: raw['format'] }),
})

/**
 * Name the first unrecognised key in a preset, if any.
 *
 * Unknown keys used to be dropped without comment. That is exactly how a
 * withdrawn capability rots quietly: every existing `crop` preset would keep
 * booting and keep answering `200` while silently no longer cropping. Naming
 * the key turns it into one startup failure the operator fixes once.
 */
const findUnknownPresetKey = (raw: Readonly<Record<string, unknown>>): string | undefined =>
  Object.keys(raw).find((key) => !PRESET_KEYS.has(key))

/**
 * Parse the `STORAGE_TRANSFORM_PRESETS` environment variable.
 *
 * - absent / empty — `{ ok: true, presets: <empty map> }` (no presets configured)
 * - a JSON object of `{ "<name>": { ...config } }` — a validated `PresetMap`
 * - malformed JSON, a non-object value, or an invalid preset name — an error
 *   (which the server-startup path surfaces as a fatal startup failure, per
 * [internal ref])
 */
export const parsePresetEnv = (raw: string | undefined): PresetParseResult => {
  if (raw === undefined || raw.trim() === '') {
    return { ok: true, presets: new Map() }
  }

  const parsed = ((): unknown => {
    try {
      return JSON.parse(raw)
    } catch {
      return Symbol.for('parse-error')
    }
  })()

  if (parsed === Symbol.for('parse-error')) {
    return { ok: false, error: 'STORAGE_TRANSFORM_PRESETS is not valid JSON' }
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, error: 'STORAGE_TRANSFORM_PRESETS must be a JSON object' }
  }

  const entries = Object.entries(parsed as Record<string, unknown>)
  const invalidName = entries.find(([name]) => !isValidPresetName(name))
  if (invalidName) {
    return {
      ok: false,
      error: `Invalid preset name '${invalidName[0]}': preset names must be alphanumeric with hyphens`,
    }
  }

  const configs = entries.map(
    ([name, value]) =>
      [
        name,
        typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {},
      ] as const
  )

  const unknown = configs
    .map(([name, raw]) => ({ name, key: findUnknownPresetKey(raw) }))
    .find((entry) => entry.key !== undefined)
  if (unknown) {
    return {
      ok: false,
      error:
        `Unknown key '${unknown.key}' in preset '${unknown.name}': ` +
        `accepted keys are width, height, fit, format, quality`,
    }
  }

  const presets = new Map<string, PresetConfig>(
    configs.map(([name, raw]) => [name, toPresetConfig(raw)])
  )
  return { ok: true, presets }
}

/** Transform query keys a preset can supply / a request can override. */
const TRANSFORM_KEYS = ['width', 'height', 'fit', 'quality', 'format'] as const

/**
 * Flatten a `PresetConfig` into a `?width=&height=&...` query-style record so
 * it can feed `parseTransformParams`. Numeric fields are stringified.
 */
const presetToQuery = (preset: PresetConfig): Readonly<Record<string, string>> => ({
  ...(preset.width !== undefined && { width: String(preset.width) }),
  ...(preset.height !== undefined && { height: String(preset.height) }),
  ...(preset.fit !== undefined && { fit: preset.fit }),
  ...(preset.quality !== undefined && { quality: String(preset.quality) }),
  ...(preset.format !== undefined && { format: preset.format }),
})

/** Collect the transform-affecting query params explicitly present in the request. */
const explicitTransformQuery = (
  query: Readonly<Record<string, string | undefined>>
): Readonly<Record<string, string>> =>
  TRANSFORM_KEYS.reduce<Record<string, string>>((acc, key) => {
    const value = query[key]
    return value !== undefined && value !== '' ? { ...acc, [key]: value } : acc
  }, {})

/** Build the "unknown preset" / "no presets configured" 400 error message. */
const presetMissError = (presetName: string, presetCount: number): TransformParseResult => ({
  ok: false,
  error:
    presetCount === 0
      ? `No transform presets are configured (requested preset '${presetName}')`
      : `Unknown transform preset: '${presetName}'`,
})

/**
 * Resolve a transform request that may carry a named preset.
 *
 * - `presetName` absent — parse the explicit query params as-is.
 * - `presetName` present but no presets configured / unknown — a validation
 * error which surfaces as HTTP 400.
 * - `presetName` present and known — the preset config provides the base
 *   transform values, and any explicit query parameter (e.g. `?width=300`)
 * overrides the preset's value for that field.
 */
export const resolvePresetTransform = (
  query: Readonly<Record<string, string | undefined>>,
  presets: PresetMap
): TransformParseResult => {
  const presetName = query['preset']
  if (presetName === undefined || presetName === '') {
    return parseTransformParams(query)
  }

  const preset = presets.get(presetName)
  if (!preset) {
    return presetMissError(presetName, presets.size)
  }

  // Preset values supply the base; explicit query parameters override per-field.
  //
  // `crop` is deliberately forwarded even though no preset may declare it: a
  // `?preset=thumbnail&crop=entropy` request must still be REFUSED, and
  // dropping the parameter here would silently accept it instead.
  return parseTransformParams({
    ...presetToQuery(preset),
    ...explicitTransformQuery(query),
    ...(query['crop'] !== undefined && query['crop'] !== '' && { crop: query['crop'] }),
  })
}
