/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { serializeJsonForScript } from '@/domain/kernel/sanitize/json-script-serialization'
import type { BuiltInAnalytics } from './analytics'

/**
 * Which browser privacy signals the built-in analytics honours.
 *
 * Both default to `true`: an unset option behaves exactly like the documented
 * default, in the shorthand `analytics: true` and in an object omitting the key.
 */
export type PrivacySignalSettings = {
  readonly respectDoNotTrack: boolean
  readonly respectGlobalPrivacyControl: boolean
}

/**
 * Resolves the two privacy-signal options to their effective values.
 *
 * Every road a visitor event takes (page views, outbound clicks, short-link
 * clicks, QR scans, and the trackers a page inlines) reads its settings here,
 * so no road can default differently from another.
 */
export function resolvePrivacySignals(
  analytics: BuiltInAnalytics | undefined
): PrivacySignalSettings {
  const settings = typeof analytics === 'object' ? analytics : undefined
  return {
    respectDoNotTrack: settings?.respectDoNotTrack ?? true,
    respectGlobalPrivacyControl: settings?.respectGlobalPrivacyControl ?? true,
  }
}

/**
 * Whether a request carries a signal the settings say to honour.
 *
 * Only the exact value `1` is a signal, for `DNT` and `Sec-GPC` alike: `0`, an
 * empty value or a missing header is recorded like any other request.
 *
 * @param settings - The effective settings, from {@link resolvePrivacySignals}
 * @param header - Reads one request header by name
 */
export function requestDeclinesTracking(
  settings: PrivacySignalSettings,
  header: (name: string) => string | undefined
): boolean {
  if (settings.respectDoNotTrack && header('DNT') === '1') return true
  return settings.respectGlobalPrivacyControl && header('Sec-GPC') === '1'
}

/**
 * The first statement of every tracker the engine emits: it stops the script
 * before anything is sent when the browser reports a signal the settings
 * honour. The client-side twin of {@link requestDeclinesTracking}, shared so
 * the inlined tracker and `/assets/analytics.js` cannot drift apart.
 *
 * `navigator.doNotTrack` reports the string `"1"`; `navigator.globalPrivacyControl`
 * reports the boolean `true`.
 */
export function trackerPrivacyGuard(settings: PrivacySignalSettings): string {
  return `${browserSignalDeclarations(settings)}
if(${BROWSER_SIGNAL_TEST})return;`
}

/**
 * Declares `D` and `G`, the two settings {@link BROWSER_SIGNAL_TEST} reads, as
 * literal booleans.
 */
export function browserSignalDeclarations(settings: PrivacySignalSettings): string {
  return `var D=${settings.respectDoNotTrack};var G=${settings.respectGlobalPrivacyControl};`
}

/**
 * The expression, over `D` and `G`, that is true when the browser reports a
 * privacy signal the settings honour. The tracker stops on it, and the
 * `consent-choice` control disables itself on it, so both read the same rule.
 */
export const BROWSER_SIGNAL_TEST =
  '(D&&navigator.doNotTrack==="1")||(G&&navigator.globalPrivacyControl===true)'

/**
 * The browser-storage key a visitor's own choice is kept under, shared by
 * every `consent-choice` control and every tracker so the two cannot drift.
 *
 * Its value is `{ v, configVersion, at, purposes }`: a format version, the
 * version of the purposes vocabulary, the day the choice was made
 * (`YYYY-MM-DD`, never a time) and each purpose mapped to `granted` or
 * `denied`.
 */
export const CONSENT_STORAGE_KEY = 'sovrium.consent'

/**
 * The event every writer of the stored choice fires on `document` once it has
 * written, so what waits on a choice (the tracker, a held script, a control) can
 * act on the same page without a reload.
 */
export const CONSENT_CHANGE_EVENT = 'sovrium:consent'

/**
 * The expression reading the stored choice: the record the storage refused and
 * that lives on `window` for the rest of the page, or else the stored one. It
 * can throw, so its caller wraps it. A held tracker and the page's consent
 * runtimes read through it, so they cannot disagree about what was chosen.
 */
export const STORED_CONSENT_READ = `window.__sovriumConsent||JSON.parse(localStorage.getItem(${serializeJsonForScript(CONSENT_STORAGE_KEY)}))`

/** What a tracker holding for the `analytics` purpose compares a stored choice against. */
export type TrackerConsentHold = {
  /** The version a stored choice must carry to count. */
  readonly configVersion: string
  /** How many days a stored choice counts for. */
  readonly expiresAfterDays: number
}

/**
 * The expression that is true when the stored choice in `record` was made
 * against the purposes declared now and has not expired. A record whose `at` is
 * missing or unreadable does not count, and neither does one stored by the
 * opt-out control, whose version is never a purposes version.
 */
export function consentRecordIsCurrent(record: string, hold: TrackerConsentHold): string {
  return `${record}&&${record}.purposes&&${record}.configVersion===${serializeJsonForScript(hold.configVersion)}&&Date.now()-Date.parse(${record}.at)<${hold.expiresAfterDays}*864e5`
}

/**
 * Defines `K()` for a site that declares an `analytics` purpose: the opposite
 * rule of {@link trackerConsentReader}. Anything but a current `granted` holds
 * the tracker, so storage that is blocked or empty sends nothing.
 */
export function trackerConsentHoldReader(hold: TrackerConsentHold): string {
  return `var K=function(){try{var c=${STORED_CONSENT_READ};return!(${consentRecordIsCurrent('c', hold)}&&c.purposes.analytics==="granted")}catch(e){return true}};`
}

/**
 * Defines `K()`, which answers whether the visitor has turned the measurement
 * of their visits off in a `consent-choice` control. It reads the stored choice
 * on every call, so a choice made on the page holds from the next event on.
 *
 * Any failure (storage blocked, an absent or malformed value) answers `false`:
 * only an explicit `denied` stops the tracker. The privacy signals are judged
 * separately, by {@link trackerPrivacyGuard}, and win over a stored `granted`.
 */
export function trackerConsentReader(): string {
  return `var K=function(){try{return JSON.parse(localStorage.getItem(${serializeJsonForScript(CONSENT_STORAGE_KEY)})).purposes.analytics==="denied"}catch(e){return false}};`
}
