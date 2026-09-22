/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { generateClickDelegateScript } from '@/presentation/render/scripts/click-delegate-script'

/**
 * The built-in analytics beacon, inlined into `<head>`.
 *
 * Extracted VERBATIM from `dynamic-page.tsx` — the emitted string is unchanged.
 * It moved because it is a self-contained string builder that was holding ~25
 * lines of a file permanently at its `max-lines` cap, so every unrelated feature
 * touching the page shell had to pay for it.
 *
 * Deliberately hand-minified rather than built: it must run BEFORE anything else
 * on the page, so it ships as an inline script with no fetch of its own.
 *
 * @param appName - `page.name`, reported as the analytics app identifier
 * @param sessionTimeoutMinutes - `analytics.sessionTimeout`, default 30
 */
export function buildAnalyticsBeaconScript(
  appName: string,
  sessionTimeoutMinutes: number | undefined
): string {
  return `(function(){
"use strict";
var E="/api/analytics/collect",A="${appName}",D=true,sessionTimeout=${sessionTimeoutMinutes ?? 30};
if(D&&navigator.doNotTrack==="1")return;
var u=function(){
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
window.addEventListener("popstate",u);
${generateClickDelegateScript()}
})();`
}
