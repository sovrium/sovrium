/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { serializeJsonForScript } from '@/domain/kernel/sanitize/json-script-serialization'
import {
  CONSENT_CHANGE_EVENT,
  trackerConsentHoldReader,
  trackerConsentReader,
  trackerPrivacyGuard,
} from './privacy-signals-service'
import type { PrivacySignalSettings, TrackerConsentHold } from './privacy-signals-service'

/**
 * The page-view sender every tracker shares: it reads the page, the referrer,
 * the screen and the UTM parameters, posts them to `E`, and sends again on
 * every `history.pushState` and `popstate`. Each send first asks `K()` (see
 * `trackerConsentReader`), so a visitor who turned measuring off in a
 * `consent-choice` control sends nothing from that moment on.
 */
const PAGE_VIEW_SENDER = `var u=function(){
if(K())return;
try{var s=new URLSearchParams(location.search);
var d={p:location.pathname,t:document.title,r:document.referrer||void 0,
sw:screen.width,sh:screen.height,
us:s.get("utm_source")||void 0,um:s.get("utm_medium")||void 0,
uc:s.get("utm_campaign")||void 0,ux:s.get("utm_content")||void 0,
ut:s.get("utm_term")||void 0};
var b=JSON.stringify(d);
if(navigator.sendBeacon){navigator.sendBeacon(E,new Blob([b],{type:"application/json"}))}
else{var x=new XMLHttpRequest();x.open("POST",E,true);x.setRequestHeader("Content-Type","application/json");x.send(b)}
}catch(e){}};
u();
var op=history.pushState;
history.pushState=function(){op.apply(this,arguments);u()};
window.addEventListener("popstate",u);`

/**
 * Sends the page view a held tracker kept back, once, when the visitor accepts
 * on this page. A later change of mind sends nothing more than `K()` allows.
 */
const HELD_PAGE_VIEW_RELEASE = `var H=K();
document.addEventListener(${serializeJsonForScript(CONSENT_CHANGE_EVENT)},function(){if(H&&!K()){H=!1;u()}});`

/** What one tracker is built from. */
export interface PageViewTrackerOptions {
  /** Where the page views are posted. */
  readonly endpoint: string
  /** The app the tracker reports for. */
  readonly appName: string
  /** The browser signals that stop the tracker before it sends anything. */
  readonly privacySignals: PrivacySignalSettings
  /** Set when the app declares an `analytics` purpose: nothing is sent until it is accepted. */
  readonly consentHold?: TrackerConsentHold
  /** More declarations on the first `var` line, each starting with a comma. */
  readonly extraDeclarations?: string
  /** Statements run after the page-view sender, inside the same function. */
  readonly epilogue?: string
}

/**
 * The page-view tracker, as one self-invoking script.
 *
 * The ONE builder behind both trackers the engine emits, the script inlined
 * into a page and `/assets/analytics.js`, so they cannot drift apart on what
 * they send, on the privacy signals they honour, or on how they escape the
 * endpoint and the app name.
 */
export function buildPageViewTracker(options: PageViewTrackerOptions): string {
  const declarations = `var E=${serializeJsonForScript(options.endpoint)},A=${serializeJsonForScript(options.appName)}${options.extraDeclarations ?? ''};`
  const epilogue = options.epilogue === undefined ? '' : `${options.epilogue}\n`
  return `(function(){
"use strict";
${declarations}
${trackerPrivacyGuard(options.privacySignals)}
${options.consentHold === undefined ? trackerConsentReader() : trackerConsentHoldReader(options.consentHold)}
${PAGE_VIEW_SENDER}
${options.consentHold === undefined ? '' : `${HELD_PAGE_VIEW_RELEASE}\n`}${epilogue}})();`
}
