/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import type { Consent } from './consent'

/** The purpose id the built-in analytics and the page `meta.analytics` providers answer to. */
export const ANALYTICS_PURPOSE_ID = 'analytics'

/** Days a choice counts for when the app sets no `expiresAfterDays`: a product default. */
export const DEFAULT_CONSENT_EXPIRY_DAYS = 180

/**
 * The version a stored choice records, `purposes:` followed by the sorted ids.
 * Declaring or removing a purpose changes it, so a returning visitor is asked
 * again. It can never equal `analytics`, the version the opt-out control writes
 * with no `consent` block, so an opt-out record never counts as an acceptance.
 */
export const consentConfigVersion = (consent: Pick<Consent, 'purposes'>): string =>
  `purposes:${consent.purposes
    .map((purpose) => purpose.id)
    .toSorted()
    .join(',')}`

/** How many days a choice counts for, the decoder setting no default. */
export const consentExpiryDays = (consent: Pick<Consent, 'expiresAfterDays'>): number =>
  consent.expiresAfterDays ?? DEFAULT_CONSENT_EXPIRY_DAYS

/**
 * What a stored choice is compared against, for a page reading it in the browser.
 */
export const consentStoreVersion = (
  consent: Consent
): { readonly configVersion: string; readonly expiresAfterDays: number } => ({
  configVersion: consentConfigVersion(consent),
  expiresAfterDays: consentExpiryDays(consent),
})

/**
 * What holds the built-in tracker back: present only when the app declares a
 * purpose with the id `analytics`. Without one the tracker keeps running unless
 * the visitor or a privacy signal stops it.
 */
export const analyticsConsentHold = (
  consent: Consent | undefined
): ReturnType<typeof consentStoreVersion> | undefined =>
  consent?.purposes.some((purpose) => purpose.id === ANALYTICS_PURPOSE_ID)
    ? consentStoreVersion(consent)
    : undefined
