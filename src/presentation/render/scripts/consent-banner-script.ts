/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { consentRecordDeclarations } from '@/presentation/render/scripts/consent-record-script'
import type { Consent } from '@/domain/models/app/consent'

/**
 * Runs what the visitor accepted: every held script tag whose purpose is granted
 * becomes a real script, once, in document order. A script that is neither
 * `async` nor an inline one is waited for, so a provider's init code still runs
 * after the library it sets up. A held tag stays in place, marked as run.
 */
const RUN_HELD_SCRIPTS = `run=function(){var c=read();if(!cur(c))return;var q=[].slice.call(document.querySelectorAll("script[data-consent]:not([data-consent-ran])")).filter(function(o){return c.purposes[o.getAttribute("data-consent")]==="granted"});q.forEach(function(o){o.setAttribute("data-consent-ran","true")});var next=function(){var o=q.shift();if(!o)return;var s=document.createElement("script"),src=o.getAttribute("data-src"),wait=!1;[].slice.call(o.attributes).forEach(function(a){if(!/^(type|data-consent|data-consent-ran|data-src|data-module)$/.test(a.name))s.setAttribute(a.name,a.value)});if(o.hasAttribute("data-module"))s.type="module";if(src){s.async=o.hasAttribute("async");wait=!s.async;if(wait)s.onload=s.onerror=next;s.src=src}else{s.text=o.text}o.parentNode.insertBefore(s,o.nextSibling);if(!wait)next()};next()}`

/**
 * The consent banner's runtime, one inline script placed right after its markup,
 * after every held script tag of the page, so the region is shown or left hidden
 * before the first paint and nothing moves.
 *
 * It shows the region unless the stored choice is current and answers every
 * declared purpose. Its three buttons write the choice; `Escape`, leaving and
 * reloading write nothing. It reserves room at the end of the page and in the
 * scroll padding while the region is up, so the focused element can always be
 * scrolled clear of it, and gives both back when the region hides. In a
 * window-high shell, where the document never scrolls and a content column
 * inside `main` does, that reserve goes on the column instead.
 *
 * After a choice, focus goes back to the last element the visitor was on outside
 * the banner, or to `main` (made focusable for it) when there was none, so it
 * never falls to the bare document as the hidden button loses it. The floating
 * "Built with Sovrium" badge, which sits right before the banner in the tab
 * order and in the same corner, is passed through rather than returned to.
 *
 * Whoever writes the choice (these buttons, a `consent-choice` control) fires the
 * change event, and everything here re-reads the store on it, so a control can
 * answer the banner and start a held script too.
 *
 * SECURITY: every interpolated value goes through `serializeJsonForScript`, and
 * the banner's text reaches the page as React-escaped markup.
 */
export function buildConsentBannerScript(consent: Consent): string {
  return `!function(){${consentRecordDeclarations(consent)}var root=document.querySelector("[data-consent-banner]");if(!root)return;var html=document.documentElement,outcome=document.querySelector("[data-consent-outcome]"),spacer=document.querySelector("[data-consent-spacer]"),answered=function(){var c=read();return cur(c)&&IDS.every(function(i){return c.purposes[i]==="granted"||c.purposes[i]==="denied"})},pane=null,last=null,free=function(){if(!pane)return;pane.style.paddingBlockEnd=pane.getAttribute("data-consent-pad");pane.style.scrollPaddingBlockEnd="";pane.removeAttribute("data-consent-pad");pane=null},fit=function(){if(root.hidden)return;var h=window.innerHeight-root.getBoundingClientRect().top+16,se=document.scrollingElement||html;free();spacer.style.height="0px";if(se.scrollHeight<=se.clientHeight)pane=[].slice.call(document.querySelectorAll("main *")).filter(function(e){var o=getComputedStyle(e).overflowY;return(o==="auto"||o==="scroll")&&e.scrollHeight>e.clientHeight})[0]||null;if(pane){var p=getComputedStyle(pane).paddingBlockEnd;pane.setAttribute("data-consent-pad",pane.style.paddingBlockEnd);pane.style.paddingBlockEnd="calc("+p+" + "+h+"px)";pane.style.scrollPaddingBlockEnd=h+"px";html.style.scrollPaddingBlockEnd=""}else{spacer.style.height=h+"px";html.style.scrollPaddingBlockEnd=h+"px"}},back=function(){var t=last&&last.isConnected&&last!==document.body?last:document.querySelector("main");if(!t)return;if(t===last){t.focus({focusVisible:!0});return}if(!t.hasAttribute("tabindex"))t.setAttribute("tabindex","-1");t.focus()},${RUN_HELD_SCRIPTS},sync=function(){if(answered()){root.hidden=!0;spacer.hidden=!0;spacer.style.height="";html.style.scrollPaddingBlockEnd="";free()}else if(root.hidden){root.hidden=!1;spacer.hidden=!1;fit()}run()};sync();window.addEventListener("resize",fit);document.addEventListener("focusin",function(ev){var t=ev.target;if(!root.contains(t)&&!(t.closest&&t.closest("[data-sovrium-badge]")))last=t});document.addEventListener(EV,sync);root.addEventListener("click",function(ev){var b=ev.target&&ev.target.closest?ev.target.closest("[data-consent-action]"):null;if(!b)return;var a=b.getAttribute("data-consent-action"),prev=read(),was=prev&&prev.purposes&&typeof prev.purposes==="object"?prev.purposes:{},ps={};Object.keys(was).forEach(function(k){if(IDS.indexOf(k)<0)ps[k]=was[k]});IDS.forEach(function(i){var box=root.querySelector('[data-consent-purpose="'+i+'"]');ps[i]=a==="accept"||(a==="save"&&box&&box.checked)?"granted":"denied"});write({v:1,configVersion:CV,at:today(),purposes:ps});outcome.textContent=outcome.getAttribute("data-saved-text");back()})}();`
}
