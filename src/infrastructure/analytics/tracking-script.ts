/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Minimal first-party analytics tracking script (~1KB minified)
 *
 * Features:
 * - Sends page path, title, referrer, screen size via navigator.sendBeacon
 * - Extracts UTM params from URL on load
 * - Listens for history.pushState / popstate for SPA navigation
 * - Respects navigator.doNotTrack if configured
 * - No cookies, no external dependencies
 *
 * Template variables replaced at serve time:
 * - __ENDPOINT__ — collection API URL (e.g., /api/analytics/collect)
 * - __APP_NAME__ — application name for multi-tenant support
 * - __RESPECT_DNT__ — whether to respect Do Not Track header ("true" or "false")
 */
export function generateTrackingScript(
  endpoint: string,
  appName: string,
  respectDoNotTrack: boolean
): string {
  return `(function(){
"use strict";
var E="${endpoint}",A="${appName}",D=${respectDoNotTrack ? 'true' : 'false'};
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
})();`
}
