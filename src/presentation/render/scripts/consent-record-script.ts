/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { serializeJsonForScript } from '@/domain/kernel/sanitize/json-script-serialization'
import {
  CONSENT_CHANGE_EVENT,
  CONSENT_STORAGE_KEY,
  consentRecordIsCurrent,
  STORED_CONSENT_READ,
} from '@/domain/models/app/analytics/privacy-signals-service'
import { consentStoreVersion } from '@/domain/models/app/consent/consent-version-service'
import type { Consent } from '@/domain/models/app/consent'

/**
 * The declarations the banner's runtime and the `consent-choice` runtime share,
 * so they read and write the stored choice by one rule:
 *
 * - `read()`: the stored record, or the one the storage refused and that lives
 *   on `window` for the rest of the page.
 * - `cur(c)`: the record was made against the purposes declared now and has not
 *   expired. Always false with no `consent` block.
 * - `write(r)`: stores the record and tells the page it changed.
 * - `IDS`, `CV`: the declared ids, and the version a new record carries, which
 *   with no `consent` block stays the opt-out control's own.
 * - `EV`: the event `write` fires, which a runtime listens to for a choice made
 *   elsewhere on the page.
 *
 * SECURITY: every interpolated value goes through `serializeJsonForScript`.
 */
export function consentRecordDeclarations(consent: Consent | undefined): string {
  const version =
    consent === undefined
      ? { configVersion: 'analytics', expiresAfterDays: 0 }
      : consentStoreVersion(consent)
  const ids = (consent?.purposes ?? []).map((purpose) => purpose.id)
  return `var KEY=${serializeJsonForScript(CONSENT_STORAGE_KEY)},EV=${serializeJsonForScript(CONSENT_CHANGE_EVENT)},CV=${serializeJsonForScript(version.configVersion)},IDS=${serializeJsonForScript(ids)},read=function(){try{return ${STORED_CONSENT_READ}}catch(e){return null}},cur=function(c){return!!(${consentRecordIsCurrent('c', version)})},write=function(r){try{window.localStorage.setItem(KEY,JSON.stringify(r));delete window.__sovriumConsent}catch(e){window.__sovriumConsent=r}document.dispatchEvent(new Event(EV))},today=function(){return new Date().toISOString().slice(0,10)};`
}
