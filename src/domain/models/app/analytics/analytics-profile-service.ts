/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { BuiltInAnalytics } from './analytics'

/** Which fields each analytics event stores. */
export type AnalyticsProfile = 'audience-only' | 'full'

/**
 * The effective profile: `audience-only` unless the operator wrote
 * `profile: full`, in the shorthand `analytics: true` and in an object omitting
 * the key alike.
 */
export function resolveAnalyticsProfile(analytics: BuiltInAnalytics | undefined): AnalyticsProfile {
  return typeof analytics === 'object' && analytics.profile === 'full' ? 'full' : 'audience-only'
}

/**
 * The one visitor identifier every short-link click, QR scan and form
 * submission carries under `audience-only`, so none of them can be told apart
 * by visitor. 64 hexadecimal characters, like every other identifier.
 */
export const SHARED_VISITOR_IDENTIFIER = '0'.repeat(64)

/**
 * The visitor and session identifiers of a short-link click, QR scan or form
 * submission under `audience-only`: both are {@link SHARED_VISITOR_IDENTIFIER},
 * on every path that writes such a row and in the start-up sweep alike.
 */
export const SHARED_IDENTIFIERS = {
  visitorHash: SHARED_VISITOR_IDENTIFIER,
  sessionHash: SHARED_VISITOR_IDENTIFIER,
} as const

/** A path or URL without its query string and fragment. */
export function withoutQuery(value: string): string {
  const cut = value.search(/[?#]/)
  return cut === -1 ? value : value.slice(0, cut)
}

/**
 * An absolute URL reduced to its origin and path. A value that is not an
 * absolute URL keeps everything before its query string.
 */
export function originAndPath(url: string): string {
  const parsed = URL.parse(url)
  if (parsed === null || parsed.origin === 'null') return withoutQuery(url)
  return `${parsed.origin}${parsed.pathname}`
}

/** The page-view properties `audience-only` never stores. */
export const PAGE_VIEW_EXCLUDED_PROPERTIES = [
  'title',
  'referrerUrl',
  'utmSource',
  'utmMedium',
  'utmCampaign',
  'utmContent',
  'utmTerm',
  'screenWidth',
  'screenHeight',
] as const

/** The only properties a short-link click or a QR scan keeps under `audience-only`. */
export const LINK_EVENT_KEPT_PROPERTIES = [
  'slug',
  'destination',
  'targetIndex',
  'deviceType',
  'browserName',
  'osName',
] as const

/** The event types whose rows carry the shared identifier under `audience-only`. */
export const SHARED_IDENTIFIER_EVENT_TYPES = ['link_click', 'qr_scan', 'form_submission'] as const

/** One stored analytics event, as far as the profile is concerned. */
export interface ProfiledEvent {
  readonly eventType: string
  /** The stored `event_name`; a page view's is its path, minimised as the path is. */
  readonly eventName?: string | null
  readonly visitorHash: string
  readonly sessionHash: string
  readonly properties: Readonly<Record<string, unknown>>
}

const mapString = (value: unknown, map: (text: string) => string): unknown =>
  typeof value === 'string' ? map(value) : value

const pick = (
  properties: Readonly<Record<string, unknown>>,
  keep: (key: string) => boolean
): Readonly<Record<string, unknown>> =>
  Object.fromEntries(Object.entries(properties).filter(([key]) => keep(key)))

const withString = (
  properties: Readonly<Record<string, unknown>>,
  key: string,
  map: (text: string) => string
): Readonly<Record<string, unknown>> =>
  key in properties ? { ...properties, [key]: mapString(properties[key], map) } : properties

/**
 * The properties one event type keeps under `audience-only`.
 *
 * The ONE rule for what the profile keeps in an event's properties: outbound
 * clicks, short-link clicks, QR scans and form submissions apply it before the
 * row is stored, and {@link minimiseEvent} applies it to the rows already
 * stored, so a row written today and a row swept at start end up alike. (The
 * page-view collector drops the same {@link PAGE_VIEW_EXCLUDED_PROPERTIES} from
 * its typed input, before the repository names them.) Applying it to its own
 * result changes nothing.
 */
export function audienceOnlyProperties(
  eventType: string,
  properties: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> {
  switch (eventType) {
    case 'page_view': {
      const excluded: readonly string[] = PAGE_VIEW_EXCLUDED_PROPERTIES
      return withString(
        pick(properties, (key) => !excluded.includes(key)),
        'path',
        withoutQuery
      )
    }
    case 'outbound_click':
      return withString(withString(properties, 'href', originAndPath), 'pagePath', withoutQuery)
    case 'link_click':
    case 'qr_scan': {
      const kept: readonly string[] = LINK_EVENT_KEPT_PROPERTIES
      return withString(
        pick(properties, (key) => kept.includes(key)),
        'destination',
        originAndPath
      )
    }
    case 'form_submission':
      return pick(properties, (key) => key !== 'submissionId')
    default:
      return properties
  }
}

/**
 * The properties an event is stored with under `profile`: all of them under
 * `full`, {@link audienceOnlyProperties} otherwise.
 */
export function profiledProperties(
  profile: AnalyticsProfile,
  eventType: string,
  properties: Readonly<Record<string, unknown>>
): Readonly<Record<string, unknown>> {
  return profile === 'full' ? properties : audienceOnlyProperties(eventType, properties)
}

const sameProperties = (
  left: Readonly<Record<string, unknown>>,
  right: Readonly<Record<string, unknown>>
): boolean =>
  Object.keys(left).length === Object.keys(right).length &&
  Object.entries(left).every(([key, value]) => key in right && right[key] === value)

/**
 * The event as `audience-only` would have stored it, or `undefined` when it
 * already is. Applying it to its own result changes nothing, so a sweep that
 * runs on every start rewrites each row at most once.
 *
 * Short-link clicks, QR scans and form submissions move to
 * {@link SHARED_IDENTIFIERS}, visitor and session alike, so a row written today
 * is already where the sweep would put it.
 */
export function minimiseEvent(event: ProfiledEvent): ProfiledEvent | undefined {
  const properties = audienceOnlyProperties(event.eventType, event.properties)
  const eventName = audienceOnlyEventName(event.eventType, event.eventName)
  const shares = (SHARED_IDENTIFIER_EVENT_TYPES as readonly string[]).includes(event.eventType)
  const moves =
    shares &&
    (event.visitorHash !== SHARED_IDENTIFIERS.visitorHash ||
      event.sessionHash !== SHARED_IDENTIFIERS.sessionHash)
  const renamed = eventName !== event.eventName
  if (!moves && !renamed && sameProperties(properties, event.properties)) return undefined
  return {
    eventType: event.eventType,
    ...(event.eventName === undefined ? {} : { eventName }),
    ...(moves
      ? SHARED_IDENTIFIERS
      : { visitorHash: event.visitorHash, sessionHash: event.sessionHash }),
    properties,
  }
}

/**
 * The `event_name` an event keeps under `audience-only`: a page view's is its
 * path, so it loses its query string as `properties.path` does; every other
 * event type's name (a host, a slug, a form's name) is kept as it is.
 */
function audienceOnlyEventName(
  eventType: string,
  eventName: string | null | undefined
): string | null | undefined {
  return eventType === 'page_view' && typeof eventName === 'string'
    ? withoutQuery(eventName)
    : eventName
}
