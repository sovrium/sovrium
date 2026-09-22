/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The on-page outbound-click delegate.
 *
 * A short link measures the links you MADE. This measures the links you HAVE —
 * every external anchor already in a rendered page: the partner in the footer,
 * the documentation link in a callout, the "powered by" in a template. It needs
 * no short link and no config change per link.
 *
 * WHY IT LIVES IN `presentation/scripts` rather than beside the page-view
 * script in `infrastructure/analytics`: the page-view tracker exists in two
 * copies today — the served `/assets/analytics.js` and an inline IIFE emitted by
 * `DynamicPage` — and only the inline one actually runs, because nothing renders
 * a `<script src="/assets/analytics.js">` tag. A UI component may not import
 * infrastructure, so putting the delegate here is what lets the copy that runs
 * and the copy that is served share ONE source instead of starting life
 * duplicated the way the page-view half did.
 */

/**
 * The endpoint the delegate posts to.
 *
 * A SIBLING of `/api/analytics/collect`, not an overload of it. The deployed
 * `/assets/analytics.js` speaks a terse one-letter page-view contract, and
 * widening that payload with a discriminant would change the meaning of a body
 * already in flight from browsers running a previously-cached script.
 */
export const CLICK_ENDPOINT = '/api/analytics/click'

/**
 * One capture-phase click delegate, recording outbound anchors only.
 *
 * FOUR EXCLUSIONS, each a decision rather than a filter:
 *
 *  - **Non-http schemes.** A `mailto:` has no hostname to group by, and treating
 *    one as outbound would put a mail client in the partner report.
 *  - **`/l/{slug}`.** The redirect already records that click. Recording it here
 *    too would double-count every short link that appears in a page — which is
 *    the most common place a short link appears. (Same-host anchors are excluded
 *    below anyway; this test is what keeps the rule true for a short link
 *    written as an absolute URL on a host the page is not currently served from,
 *    which is an ordinary consequence of sitting behind a proxy.)
 *  - **Same-host anchors.** The page view that follows already holds that
 *    navigation, so an internal-click event would be a second row for a journey
 *    the store already has — the highest-volume event kind in the system, for no
 *    new information. If per-element attribution inside a page is ever genuinely
 *    needed, it is a different feature with a different name, not this one
 *    widened.
 *  - **Anything that is not an anchor carrying an href.**
 *
 * `sendBeacon`, never `fetch`: a beacon survives the page unloading, so there is
 * nothing to await and the navigation is never delayed. An awaited fetch would
 * make every outbound click feel slow, on the one interaction where the visitor
 * is already leaving.
 *
 * Bound with `capture: true` and exactly ONCE — a delegate bound on both bubble
 * and capture would double every figure by a constant nobody notices. Capture
 * rather than bubble so a handler calling `stopPropagation()` cannot silently
 * remove a link from the report.
 *
 * @returns A JavaScript statement list, for embedding inside an existing IIFE.
 */
export function generateClickDelegateScript(): string {
  return `var C="${CLICK_ENDPOINT}";
document.addEventListener("click",function(ev){
try{
var t=ev.target;
var a=t&&t.closest?t.closest("a[href]"):null;
if(!a)return;
var w=new URL(a.getAttribute("href"),location.href);
if(w.protocol!=="http:"&&w.protocol!=="https:")return;
if(w.pathname==="/l"||w.pathname.indexOf("/l/")===0)return;
if(w.host===location.host)return;
var q=JSON.stringify({href:w.href,hostname:w.hostname,pagePath:location.pathname});
if(navigator.sendBeacon){navigator.sendBeacon(C,new Blob([q],{type:"application/json"}))}
}catch(e){}
},true);`
}
