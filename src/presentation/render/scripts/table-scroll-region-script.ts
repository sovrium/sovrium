/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Markdown table scroll-region runtime (SECURITY: Safe - static code, no user input).
 *
 * Every markdown table sits in a `[data-table-scroll]` wrapper that scrolls
 * sideways when the table is wider than the column. A keyboard user cannot
 * reach that scroll unless the wrapper takes a tab stop, and a tab stop with
 * no role or name is announced as nothing. So, for every wrapper whose table
 * is wider than its box:
 *
 *  - `tabindex="0"`, `role="region"` and an `aria-label` built from the
 *    wrapper's `data-table-scroll` word and the table's column headers
 *    (`"Table: Variable, Default, Purpose"`), else the first row's cells;
 *  - `data-scrollable="true"`, which the wrapper's classes read to paint a
 *    fade over the trailing edge. Scrolled to the end, the flag reads `"end"`
 *    and the fade goes away.
 *
 * A table that fits gets none of these, so a page of narrow tables does not
 * fill the tab order. Overflow depends on the viewport, which only the browser
 * knows: a `ResizeObserver` re-decides whenever the wrapper or its table
 * changes size, and a `MutationObserver` picks up tables that mount later. The
 * `data-scrollable` flag records that the runtime made the wrapper a region,
 * so the three attributes are removed only from a wrapper it marked.
 */
export const TABLE_SCROLL_REGION_SCRIPT = `!function(){if(typeof ResizeObserver!=="function"||!document.body)return;var S="[data-table-scroll]";function edge(w){var end=Math.abs(w.scrollLeft)+w.clientWidth>=w.scrollWidth-1;w.setAttribute("data-scrollable",end?"end":"true")}function name(w){var cs=w.querySelectorAll("thead th"),r,t=[];if(!cs.length){r=w.querySelector("tr");cs=r?r.children:[]}for(var i=0;i<cs.length;i++){var x=(cs[i].textContent||"").trim();if(x)t.push(x)}var p=w.getAttribute("data-table-scroll")||"Table";return t.length?p+": "+t.join(", "):p}function sync(w){var over=w.scrollWidth-w.clientWidth>1,on=w.hasAttribute("data-scrollable");if(over){if(!on){w.setAttribute("tabindex","0");w.setAttribute("role","region");w.setAttribute("aria-label",name(w))}edge(w)}else if(on){w.removeAttribute("data-scrollable");w.removeAttribute("tabindex");w.removeAttribute("role");w.removeAttribute("aria-label")}}var ro=new ResizeObserver(function(es){for(var i=0;i<es.length;i++){var w=es[i].target.closest(S);if(w)sync(w)}});function observe(w){ro.observe(w);var t=w.querySelector("table");if(t)ro.observe(t)}function watch(root){if(root.matches&&root.matches(S))observe(root);var ws=root.querySelectorAll(S);for(var i=0;i<ws.length;i++)observe(ws[i])}watch(document);new MutationObserver(function(ms){for(var i=0;i<ms.length;i++){var a=ms[i].addedNodes;for(var j=0;j<a.length;j++){if(a[j].nodeType===1)watch(a[j])}}}).observe(document.body,{childList:true,subtree:true});document.addEventListener("scroll",function(e){var w=e.target;if(w&&w.nodeType===1&&w.matches(S+"[data-scrollable]"))edge(w)},true)}();`
