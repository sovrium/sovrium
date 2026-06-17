/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */



import {
  computeArrayChipClasses,
  computeArrayChipsWrapClasses,
  computeCodeInlineClasses,
  computeCountBadgeClasses,
  computeFormulaReadonlyClasses,
  computeGeolocationClasses,
  computeGeolocationCoordClasses,
  computeGeolocationPinClasses,
  computeJsonPreviewClasses,
  computeLinkedRecordPillClasses,
  computeLinkedRecordWrapClasses,
  computeStatusPillClasses,
  computeUserAvatarClasses,
  computeUserNameClasses,
  computeUserPillClasses,
} from '../recipes/cell-affordances-default-classes'


interface StatusOptionMeta {
  readonly value: string
  readonly color?: string
  readonly tone?: 'neutral' | 'info' | 'success' | 'warning' | 'error'
}

export interface CellFieldOptions {
  readonly statusOptions?: readonly StatusOptionMeta[]
  readonly formulaKind?: 'number' | 'text' | 'date' | 'error'
}

export type CellRenderer = (props: {
  value: unknown
  fieldOptions?: CellFieldOptions
}) => React.ReactNode

const EMPTY_VALUE = <span className="text-[var(--sv-fg-muted,oklch(0.445_0.012_55))]">—</span>

const isMissing = (value: unknown): boolean => value === undefined || value === null || value === ''


const initialsOf = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase()
  return (parts[0]!.charAt(0) + parts[parts.length - 1]!.charAt(0)).toUpperCase()
}

export function UserPillCell({ value }: { value: unknown }): React.ReactNode {
  if (isMissing(value)) return EMPTY_VALUE
  const display = String(value)
  return (
    <span className={computeUserPillClasses()}>
      <span
        aria-hidden="true"
        className={computeUserAvatarClasses()}
      >
        {initialsOf(display)}
      </span>
      <span className={computeUserNameClasses()}>{display}</span>
    </span>
  )
}


export function LinkedRecordPillCell({ value }: { value: unknown }): React.ReactNode {
  if (isMissing(value)) return EMPTY_VALUE

  if (Array.isArray(value)) {
    if (value.length === 0) return EMPTY_VALUE
    return (
      <span className={computeLinkedRecordWrapClasses()}>
        {value.map((entry, i) => (
          <span
            key={`linked-${String(i)}`}
            className={computeLinkedRecordPillClasses()}
          >
            {String(entry)}
          </span>
        ))}
      </span>
    )
  }

  return <span className={computeLinkedRecordPillClasses()}>{String(value)}</span>
}


export function StatusPillCell({
  value,
  fieldOptions,
}: {
  value: unknown
  fieldOptions?: CellFieldOptions
}): React.ReactNode {
  if (isMissing(value)) return EMPTY_VALUE

  const display = String(value)
  const match = fieldOptions?.statusOptions?.find((opt) => opt.value === display)
  const tone = match?.tone ?? 'neutral'
  const inlineColor = match?.color

  return (
    <span
      className={computeStatusPillClasses({ tone })}
      style={inlineColor ? { backgroundColor: inlineColor } : undefined}
    >
      {display}
    </span>
  )
}


const detectFormulaKind = (
  value: unknown,
  declared: CellFieldOptions['formulaKind']
): 'number' | 'text' | 'date' | 'error' => {
  if (declared) return declared
  if (typeof value === 'string' && value.startsWith('#') && value.endsWith('!')) return 'error'
  if (typeof value === 'number' || (typeof value === 'string' && !Number.isNaN(Number(value))))
    return 'number'
  if (value instanceof Date) return 'date'
  return 'text'
}

export function FormulaReadonlyCell({
  value,
  fieldOptions,
}: {
  value: unknown
  fieldOptions?: CellFieldOptions
}): React.ReactNode {
  if (isMissing(value)) return EMPTY_VALUE
  const kind = detectFormulaKind(value, fieldOptions?.formulaKind)
  const display = value instanceof Date ? value.toLocaleDateString() : String(value)
  return <span className={computeFormulaReadonlyClasses({ kind })}>{display}</span>
}


interface LatLng {
  readonly lat: number
  readonly lng: number
}

const parseObjectGeoloc = (obj: Record<string, unknown>): LatLng | undefined => {
  const lat = typeof obj['lat'] === 'number' ? obj['lat'] : Number(obj['lat'])
  const lng = typeof obj['lng'] === 'number' ? obj['lng'] : Number(obj['lng'])
  if (Number.isNaN(lat) || Number.isNaN(lng)) return undefined
  return { lat, lng }
}

const parseStringGeoloc = (s: string): LatLng | undefined => {
  const parts = s.split(',').map((p) => Number(p.trim()))
  if (parts.length !== 2) return undefined
  const [lat, lng] = parts
  if (lat === undefined || lng === undefined) return undefined
  if (Number.isNaN(lat) || Number.isNaN(lng)) return undefined
  return { lat, lng }
}

const parseGeoloc = (value: unknown): LatLng | undefined => {
  if (isMissing(value)) return undefined
  if (typeof value === 'object') return parseObjectGeoloc(value as Record<string, unknown>)
  if (typeof value === 'string') return parseStringGeoloc(value)
  return undefined
}

export function GeolocationCell({ value }: { value: unknown }): React.ReactNode {
  const coords = parseGeoloc(value)
  if (!coords) return EMPTY_VALUE
  return (
    <span className={computeGeolocationClasses()}>
      <span
        aria-hidden="true"
        className={computeGeolocationPinClasses()}
      >
        ◉
      </span>
      <span className={computeGeolocationCoordClasses()}>
        {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
      </span>
    </span>
  )
}


export function CountBadgeCell({ value }: { value: unknown }): React.ReactNode {
  if (isMissing(value)) return EMPTY_VALUE
  const num = typeof value === 'number' ? value : Number(value)
  if (Number.isNaN(num)) return EMPTY_VALUE
  return <span className={computeCountBadgeClasses()}>{num}</span>
}


const previewJson = (value: unknown): string => {
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

export function JsonPreviewCell({ value }: { value: unknown }): React.ReactNode {
  if (isMissing(value)) return EMPTY_VALUE
  return <span className={computeJsonPreviewClasses()}>{previewJson(value)}</span>
}


const parseJsonArray = (trimmed: string): readonly string[] | undefined => {
  if (!(trimmed.startsWith('[') && trimmed.endsWith(']'))) return undefined
  try {
    const parsed = JSON.parse(trimmed) as unknown
    if (Array.isArray(parsed)) return parsed.map((v) => String(v))
  } catch {
  }
  return undefined
}

const normalizeArray = (value: unknown): readonly string[] | undefined => {
  if (Array.isArray(value)) return value.map((v) => String(v))
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return (
      parseJsonArray(trimmed) ??
      trimmed
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    )
  }
  return undefined
}

export function ArrayChipsCell({ value }: { value: unknown }): React.ReactNode {
  if (isMissing(value)) return EMPTY_VALUE
  const items = normalizeArray(value)
  if (!items || items.length === 0) return EMPTY_VALUE
  return (
    <span className={computeArrayChipsWrapClasses()}>
      {items.map((item, i) => (
        <span
          key={`chip-${String(i)}`}
          className={computeArrayChipClasses()}
        >
          {item}
        </span>
      ))}
    </span>
  )
}


export function CodeInlineCell({ value }: { value: unknown }): React.ReactNode {
  if (isMissing(value)) return EMPTY_VALUE
  return <code className={computeCodeInlineClasses()}>{String(value)}</code>
}
