/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Code-block scroll-region runtime (SECURITY: Safe - static code, no user input).
 *
 * An unwrapped code block is as wide as its longest line, so on a narrow screen
 * its command `<pre>` scrolls sideways. A keyboard user cannot reach that
 * scroll unless the `<pre>` takes a tab stop, and a tab stop with no role or
 * name is announced as nothing. So, for every `pre[data-code-command]` — the
 * config `code` component and the markdown and chat fences alike — whose
 * content is wider than its box:
 *
 *  - `tabindex="0"`, `role="region"` and an `aria-label` naming the block: the
 *    frame's own accessible name (the filename, the terminal label, a chat
 *    fence's language), else "Code";
 *  - `data-scrollable="true"`, which the `code-block-content` recipe reads to
 *    paint a fade over the trailing edge, so a reader sees the line goes on
 *    before scrolling (most systems hide the scrollbar at rest). Scrolled to
 *    the end, the flag reads `"end"` and the fade goes away, so the last
 *    characters are never left faded.
 *
 * A block that fits gets none of these, so a page of short snippets does not
 * fill the tab order. Overflow depends on the viewport, which only the browser
 * knows, so this cannot be decided on the server: a `ResizeObserver` re-decides
 * whenever the `<pre>` or its `<code>` changes size, and a `MutationObserver`
 * picks up blocks that mount later (a tab panel, a streamed chat answer). The
 * `data-scrollable` flag records that the runtime made the `<pre>` a region, so
 * the three attributes are removed only from a block it marked.
 */
export const CODE_SCROLL_REGION_SCRIPT = `!function(){if(typeof ResizeObserver!=="function"||!document.body)return;var S="pre[data-code-command]";function edge(p){var end=Math.abs(p.scrollLeft)+p.clientWidth>=p.scrollWidth-1;p.setAttribute("data-scrollable",end?"end":"true")}function sync(p){var over=p.scrollWidth-p.clientWidth>1,on=p.hasAttribute("data-scrollable");if(over){if(!on){var f=p.closest("[data-code-frame]"),n=f&&f.getAttribute("aria-label");p.setAttribute("tabindex","0");p.setAttribute("role","region");p.setAttribute("aria-label",n||"Code")}edge(p)}else if(on){p.removeAttribute("data-scrollable");p.removeAttribute("tabindex");p.removeAttribute("role");p.removeAttribute("aria-label")}}var ro=new ResizeObserver(function(es){for(var i=0;i<es.length;i++){var p=es[i].target.closest(S);if(p)sync(p)}});function watch(root){var ps=root.querySelectorAll(S);for(var i=0;i<ps.length;i++){ro.observe(ps[i]);var c=ps[i].querySelector("code");if(c)ro.observe(c)}if(root.matches&&root.matches(S))watch(root.parentNode||document)}watch(document);new MutationObserver(function(ms){for(var i=0;i<ms.length;i++){var a=ms[i].addedNodes;for(var j=0;j<a.length;j++){if(a[j].nodeType===1)watch(a[j])}}}).observe(document.body,{childList:true,subtree:true});document.addEventListener("scroll",function(t){var p=t.target;if(p&&p.nodeType===1&&p.matches(S+"[data-scrollable]"))edge(p)},true)}();`
