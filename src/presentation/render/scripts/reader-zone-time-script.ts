/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Writes a `timeZone: local` moment in the reader's own zone.
 *
 * The server cannot know that zone, so it prints the moment at the operator's
 * inside `<time datetime data-reader-zone>` (`render/elements/reader-zone-time.tsx`),
 * whose attribute carries the page language and the reading's recipe
 * (`kernel/format/date-recipe.ts`). This enhancer follows the recipe exactly as
 * `formatDateRecipe` does, with no zone (the browser's own is the reader's), as
 * the page is parsed, and again for any node mounted later, so a reader never
 * sees one hour and then another. Shipped only on a page of an app declaring a
 * `local` field; a value it cannot read keeps the server's text.
 *
 * SECURITY: Safe - engine-authored constant; it writes `textContent`, never HTML.
 */
export const READER_ZONE_TIME_SCRIPT = `!function(){var C={},S="[data-reader-zone]";function F(l,o){var k=l+JSON.stringify(o);return C[k]||(C[k]=new Intl.DateTimeFormat(l,o))}function P(d,o,t){var q=F("en-US",o).formatToParts(d);for(var i=0;i<q.length;i++)if(q[i].type===t)return q[i].value;return""}function W(e){var s=e.getAttribute("data-reader-zone");e.removeAttribute("data-reader-zone");try{var d=new Date(e.getAttribute("datetime")||""),x=JSON.parse(s),o="";if(isNaN(d.getTime()))return;for(var i=0;i<x.r.length;i++){var p=x.r[i];o+=typeof p==="string"?p:p.f?F(x.l,p.f).format(d):p.p?P(d,p.p,p.t):(+P(d,{hour:"2-digit",hourCycle:"h23"},"hour")>=12?"PM":"AM")}e.textContent=o}catch(r){}}function A(r){if(r.matches&&r.matches(S))W(r);var a=r.querySelectorAll(S);for(var i=0;i<a.length;i++)W(a[i])}A(document);if(window.MutationObserver&&document.body)new MutationObserver(function(m){for(var i=0;i<m.length;i++){var a=m[i].addedNodes;for(var j=0;j<a.length;j++)if(a[j].nodeType===1)A(a[j])}}).observe(document.body,{childList:true,subtree:true})}();`
