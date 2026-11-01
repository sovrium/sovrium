/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import {
  BROWSER_SIGNAL_TEST,
  browserSignalDeclarations,
} from '@/domain/models/app/analytics/privacy-signals-service'
import { consentRecordDeclarations } from '@/presentation/render/scripts/consent-record-script'
import type { PrivacySignalSettings } from '@/domain/models/app/analytics/privacy-signals-service'
import type { Consent } from '@/domain/models/app/consent'

/**
 * The `consent-choice` runtime, one IIFE appended to the body-end enhancer
 * script on a page that draws the control (SECURITY: the interpolated values
 * are escaped by `serializeJsonForScript` in `consent-record-script.ts`, plus
 * two literal booleans).
 *
 * On load it reads the stored choice and the browser privacy signals the app
 * honours, and brings every control on the page to that state: `aria-pressed`,
 * the status line's text, and `disabled` while a signal holds the purpose off,
 * in which case the control is not pressed and shows its signal text. Only then
 * does it reveal the button and the status, which the server drew hidden, and
 * hide the no-script message, so a browser without JavaScript shows the message
 * alone.
 *
 * What pressed means depends on the purpose. A purpose the app declares in
 * `consent` is off until the visitor grants it, by a current record only. Any
 * other (the `analytics` opt-out, with no such purpose) is on unless they turned
 * it off, whatever the record's age.
 *
 * A press is handled by ONE delegated listener: it writes
 * `{ v, configVersion, at, purposes }`, `at` being a date and never a time, and
 * every control redraws on the change event, so two controls for the same purpose
 * never disagree, and a choice made on the banner shows here too. A press leaves
 * the date of a current declared record alone, so changing one purpose does not
 * extend the others, and drops what a stale record said about declared purposes.
 * Storage that refuses the write keeps the choice in memory for the rest of the
 * page.
 *
 * A body observer redraws controls that arrive after load, the way the
 * theme-toggle runtime does for its own buttons.
 */
export function buildConsentChoiceScript(
  settings: PrivacySignalSettings,
  consent?: Consent
): string {
  return `!function(){${consentRecordDeclarations(consent)}${browserSignalDeclarations(settings)}var sig=function(){try{return!!(${BROWSER_SIGNAL_TEST})}catch(e){return!1}},ps=function(){var c=read();return c&&c.purposes&&typeof c.purposes==="object"?c.purposes:{}},isOn=function(p){if(IDS.indexOf(p)<0)return ps()[p]!=="denied";var c=read();return cur(c)&&c.purposes[p]==="granted"},sync=function(){var s=sig();document.querySelectorAll("[data-consent-choice]").forEach(function(w){var p=w.getAttribute("data-purpose"),b=w.querySelector("[data-consent-toggle]"),t=w.querySelector("[data-consent-status]");if(!p||!b||!t)return;var held=p==="analytics"&&s,on=!held&&isOn(p),txt=w.getAttribute(held?"data-signal-text":on?"data-granted-text":"data-denied-text")||"";b.disabled=held;b.setAttribute("aria-pressed",on?"true":"false");if(t.textContent!==txt)t.textContent=txt;b.hidden=!1;t.hidden=!1;var n=w.querySelector("[data-consent-noscript]");if(n)n.hidden=!0})};sync();if(document.body)new MutationObserver(sync).observe(document.body,{childList:!0,subtree:!0});document.addEventListener(EV,sync);document.addEventListener("click",function(ev){var b=ev.target&&ev.target.closest?ev.target.closest("[data-consent-toggle]"):null;if(!b||b.disabled)return;var w=b.closest("[data-consent-choice]"),p=w&&w.getAttribute("data-purpose");if(!p)return;var prev=read(),keep=cur(prev),was=ps(),o={};Object.keys(was).forEach(function(k){if(keep||IDS.indexOf(k)<0)o[k]=was[k]});o[p]=b.getAttribute("aria-pressed")==="true"?"denied":"granted";write({v:1,configVersion:CV,at:keep?prev.at:today(),purposes:o})})}();`
}
