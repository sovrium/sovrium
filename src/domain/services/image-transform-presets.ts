/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */


import { parseTransformParams } from './image-transform-params'
import type { TransformParseResult } from './image-transform-params'

export interface PresetConfig {
  readonly width?: number
  readonly height?: number
  readonly fit?: string
  readonly crop?: string
  readonly quality?: number
  readonly format?: string
}

export type PresetMap = ReadonlyMap<string, PresetConfig>

export type PresetParseResult =
  | { readonly ok: true; readonly presets: PresetMap }
  | { readonly ok: false; readonly error: string }

const PRESET_NAME_PATTERN = /^[a-zA-Z0-9]+(?:-[a-zA-Z0-9]+)*$/

export const isValidPresetName = (name: string): boolean => PRESET_NAME_PATTERN.test(name)

const toPresetConfig = (raw: Record<string, unknown>): PresetConfig => ({
  ...(typeof raw['width'] === 'number' && { width: raw['width'] }),
  ...(typeof raw['height'] === 'number' && { height: raw['height'] }),
  ...(typeof raw['fit'] === 'string' && { fit: raw['fit'] }),
  ...(typeof raw['crop'] === 'string' && { crop: raw['crop'] }),
  ...(typeof raw['quality'] === 'number' && { quality: raw['quality'] }),
  ...(typeof raw['format'] === 'string' && { format: raw['format'] }),
})

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

  const presets = new Map<string, PresetConfig>(
    entries.map(([name, value]) => [
      name,
      toPresetConfig(
        typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
      ),
    ])
  )
  return { ok: true, presets }
}

const TRANSFORM_KEYS = ['width', 'height', 'fit', 'crop', 'quality', 'format'] as const

const presetToQuery = (preset: PresetConfig): Record<string, string> => ({
  ...(preset.width !== undefined && { width: String(preset.width) }),
  ...(preset.height !== undefined && { height: String(preset.height) }),
  ...(preset.fit !== undefined && { fit: preset.fit }),
  ...(preset.crop !== undefined && { crop: preset.crop }),
  ...(preset.quality !== undefined && { quality: String(preset.quality) }),
  ...(preset.format !== undefined && { format: preset.format }),
})

const explicitTransformQuery = (
  query: Record<string, string | undefined>
): Record<string, string> =>
  TRANSFORM_KEYS.reduce<Record<string, string>>((acc, key) => {
    const value = query[key]
    return value !== undefined && value !== '' ? { ...acc, [key]: value } : acc
  }, {})

const presetMissError = (presetName: string, presetCount: number): TransformParseResult => ({
  ok: false,
  error:
    presetCount === 0
      ? `No transform presets are configured (requested preset '${presetName}')`
      : `Unknown transform preset: '${presetName}'`,
})

export const resolvePresetTransform = (
  query: Record<string, string | undefined>,
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

  return parseTransformParams({ ...presetToQuery(preset), ...explicitTransformQuery(query) })
}
