/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { COPY_READY_MARK, TOC_SPY_READY_MARK } from '@/presentation/design/runtime-ready-marks'

/**
 * Client-side enhancement payloads for the markdown article (the pages layout markdown pages requirements, P4). These are inline `<style>`/`<script>` string
 * literals injected via `dangerouslySetInnerHTML` — the "no island runtime"
 * pattern for the docs article: its touches over Typeset, the TOC scroll-spy, and
 * the header Copy-as-Markdown control.
 *
 * There is no per-code-block copy script here (one walking every `pre.shiki`
 * and APPENDING a control): fences are server-rendered inside the shared
 * code-block frame with the button already in their header
 * (`markdown-code-frames.ts`), so such a script would append a SECOND identical
 * control to every block.
 *
 * They live here (not in `markdown-article.tsx`) purely to keep that SSR
 * component under its line cap; the hoisted `*_HTML` wrappers are exported so
 * the component can bind them to `dangerouslySetInnerHTML` without allocating a
 * fresh object in render scope (react-perf/jsx-no-new-object-as-prop).
 */

/**
 * The docs layout's own touches over Typeset, scoped under `.typeset` so they
 * never leak into chrome. Typeset (`infrastructure/css/theme/typeset-styles.ts`)
 * sets the prose itself; this unlayered sheet keeps only what the docs zone
 * adds to it:
 *
 *   1. Links in the docs brand's warmth tone, where the theme declares one.
 *   2. Callouts: `:::callout` renders as `.md-callout`/`[data-component=alert]`,
 *      a `<div>` Typeset does not style. Draw the warmth-bordered panel, open
 *      the flow's space above it like any other block, and re-assert each
 *      declared kind's left accent (`data-type`) over it, since this unlayered
 *      sheet outranks the per-kind utilities the callout carries.
 *   3. Headings clear the sticky docs header when a TOC link scrolls to them.
 *
 * An element the author styled by part (`markdown.classes`) carries
 * `data-part`, and the rules that would outrank its classes skip it.
 *
 * Code blocks are deliberately absent: a fence is a `data-slot` component that
 * Typeset leaves to its own frame, whose padding its highlighted-line bleed is
 * measured against. The breadcrumb header sits outside the Typeset container,
 * so it needs no list reset either.
 *
 * Raw author selectors do not need to live in `BUILTIN_CSS_CANDIDATES` (only
 * Tailwind utility class names are candidate-gated), so this scoped sheet is
 * safe to inject directly without a `bun run build:css-assets` regeneration.
 */
const DOCS_PROSE_PATCH = `
.typeset :where(a):not(:where([data-slot] *,[data-component] *)):not([data-part]){color:var(--color-warmth, inherit);text-underline-offset:2px;}
.typeset :where(a):not(:where([data-slot] *,[data-component] *)):not([data-part]):hover{color:var(--color-warmth-border, inherit);}
.typeset .md-callout:not([data-part]),.typeset [data-component="alert"]:not([data-part]){border:1px solid #e5ded5;border-left:3px solid var(--color-warmth-border, var(--color-border-strong));background:#f5f0eb;border-radius:0 .5rem .5rem 0;padding:.85rem 1rem;margin:var(--typeset-flow) 0 0;color:#3f3a34;}
.dark .typeset .md-callout:not([data-part]),.dark .typeset [data-component="alert"]:not([data-part]){border-color:#262626;background:#171717;color:#d4d4d4;}
.typeset [data-component="alert"][data-type="note"]{border-left-color:var(--color-foreground-subtle);}
.typeset [data-component="alert"][data-type="tip"]{border-left-color:var(--color-success-solid);}
.typeset [data-component="alert"][data-type="warning"]{border-left-color:var(--color-warning-solid);}
.typeset [data-component="alert"][data-type="danger"]{border-left-color:var(--color-destructive);}
.typeset .md-callout :first-child,.typeset [data-component="alert"] :first-child{margin-top:0;}
.typeset :where(h1,h2,h3,h4,h5,h6){scroll-margin-top:5rem;}
`

/**
 * Hoisted `dangerouslySetInnerHTML` payload for the scoped docs patch
 * (react-perf/jsx-no-new-object-as-prop: the prop object must not be allocated
 * in render scope). Allocating it once at module scope keeps the lint rule
 * satisfied without per-element `eslint-disable`s; the TOC scroll-spy hoists
 * below (`TOC_SCROLLSPY_STYLE_HTML` / `TOC_SCROLLSPY_SCRIPT_HTML`) follow the
 * same pattern.
 */
export const DOCS_PROSE_PATCH_HTML = { __html: DOCS_PROSE_PATCH }

/**
 * Active-link styling for the TOC scroll-spy (P4). Raw CSS (a sibling of
 * DOCS_PROSE_PATCH) so the `data-active` selector never has to flow through the
 * Tailwind candidate pipeline — `[data-toc-link][data-active="true"]` is a plain
 * attribute selector, not a utility class. The active entry gets the warmth
 * accent border + brighter text so the reader sees where they are.
 */
const TOC_SCROLLSPY_STYLE = `
.sv-toc-link[data-active="true"]{border-left-color:var(--color-warmth-border, var(--color-border-strong));color:var(--color-foreground, #fafafa);font-weight:500;}
`

/**
 * TOC scroll-spy enhancement (P4). An inline IIFE (the docs article's
 * "no island runtime" pattern) observes every heading the TOC links to and toggles
 * `data-active="true"` on the matching `[data-toc-link]` as the reader scrolls,
 * so the right-rail "On this page" tracks the viewport. Degrades gracefully when
 * IntersectionObserver is unavailable (the static anchors still work). Idempotent
 * via a `data-toc-spy-ready` guard on the nav so client navigations don't double-bind.
 */
const TOC_SCROLLSPY_SCRIPT = `(function(){
"use strict";
function init(){
var nav=document.querySelector('[data-component="markdown-toc"]:not([${TOC_SPY_READY_MARK}])');
if(!nav){return;}
nav.setAttribute("${TOC_SPY_READY_MARK}","");
var links=nav.querySelectorAll("[data-toc-link]");
if(!links.length||typeof IntersectionObserver==="undefined"){return;}
var linkById={};
var ids=[];
for(var i=0;i<links.length;i++){var id=links[i].getAttribute("data-toc-link");if(id){linkById[id]=links[i];ids.push(id);}}
var visible={};
function setActive(id){for(var j=0;j<ids.length;j++){var l=linkById[ids[j]];if(l){if(ids[j]===id){l.setAttribute("data-active","true");}else{l.removeAttribute("data-active");}}}}
var obs=new IntersectionObserver(function(entries){
for(var k=0;k<entries.length;k++){var e=entries[k];var hid=e.target.id;if(e.isIntersecting){visible[hid]=true;}else{delete visible[hid];}}
var firstVisible=null;for(var m=0;m<ids.length;m++){if(visible[ids[m]]){firstVisible=ids[m];break;}}
if(firstVisible){setActive(firstVisible);}
},{rootMargin:"-80px 0px -70% 0px",threshold:0});
for(var n=0;n<ids.length;n++){var h=document.getElementById(ids[n]);if(h){obs.observe(h);}}
}
if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",init);}else{init();}
})();`

/** Hoisted TOC scroll-spy payloads (see `DOCS_PROSE_PATCH_HTML`). */
export const TOC_SCROLLSPY_STYLE_HTML = { __html: TOC_SCROLLSPY_STYLE }
export const TOC_SCROLLSPY_SCRIPT_HTML = { __html: TOC_SCROLLSPY_SCRIPT }

/**
 * Copy-as-Markdown enhancement. The docs
 * header renders a `[data-copy-markdown]` button carrying the article's per-page
 * `.md` URL in `data-copy-markdown-url`. This tiny inline IIFE (the docs
 * article's "no island runtime" pattern) wires the button to copy that raw markdown to the
 * clipboard on click. It PREFETCHES the `.md` body on load so the click writes
 * synchronously (avoiding a click→fetch→clipboard race), falling back to a
 * fetch-on-click when the prefetch has not resolved. The label flips to a
 * "Copied" confirmation on success and restores after 1.5s (the `aria-label`
 * keeps the accessible name stable). Idempotent via a `data-copy-ready` guard.
 * The "View as Markdown" link is the no-JS fallback and always works.
 */
const COPY_MARKDOWN_SCRIPT = `(function(){
"use strict";
function enhance(){
var btns=document.querySelectorAll("[data-copy-markdown]:not([${COPY_READY_MARK}])");
for(var i=0;i<btns.length;i++){
(function(btn){
btn.setAttribute("${COPY_READY_MARK}","");
var url=btn.getAttribute("data-copy-markdown-url");
var cached=null;
if(url){fetch(url).then(function(r){return r.text();}).then(function(t){cached=t;}).catch(function(){});}
function write(text){
var restore=btn.textContent;
var flip=function(){btn.textContent="Copied";setTimeout(function(){btn.textContent=restore;},1500);};
if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(text).then(flip).catch(function(){});}
else{try{var ta=document.createElement("textarea");ta.value=text;document.body.appendChild(ta);ta.select();document.execCommand("copy");document.body.removeChild(ta);flip();}catch(e){}}
}
btn.addEventListener("click",function(){
if(cached!==null){write(cached);}
else if(url){fetch(url).then(function(r){return r.text();}).then(write).catch(function(){});}
});
})(btns[i]);
}
}
if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",enhance);}else{enhance();}
})();`

/** Hoisted copy-as-markdown payload (see `DOCS_PROSE_PATCH_HTML`). */
export const COPY_MARKDOWN_SCRIPT_HTML = { __html: COPY_MARKDOWN_SCRIPT }
