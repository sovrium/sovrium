/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Client-side enhancement payloads for the markdown article ([internal ref], P4). These are inline `<style>`/`<script>` string
 * literals injected via `dangerouslySetInnerHTML` — the "no island runtime"
 * pattern for the docs article: a prose-styling patch, the TOC scroll-spy, and
 * the header Copy-as-Markdown control.
 *
 * The per-code-block copy button used to live here too, as a script that walked
 * every `pre.shiki` and APPENDED a control. It is gone: fences are now
 * server-rendered inside the shared code-block frame with the button already in
 * their header (`markdown-code-frames.ts`), so the script would append a SECOND
 * identical control to every block.
 *
 * They live here (not in `MarkdownArticle.tsx`) purely to keep that SSR
 * component under its line cap; the hoisted `*_HTML` wrappers are exported so
 * the component can bind them to `dangerouslySetInnerHTML` without allocating a
 * fresh object in render scope (react-perf/jsx-no-new-object-as-prop).
 */

/**
 * Minimal SSR-only patch over `@tailwindcss/typography` for the five things
 * `prose` cannot style correctly for this markdown pipeline. This is NOT the
 * old full `.docs-article` workaround (that styled every element — headings,
 * paragraphs, lists, tables, links — which `prose prose-invert` now handles).
 * It is scoped under `.prose` so it never leaks into chrome, and patches only:
 *
 *   1. Inline code: prose wraps `<code>` in literal backtick glyphs via
 *      `code::before`/`::after { content: "\`" }`. Strip them and give inline
 *      code the warmth chip the docs brand uses (prose's default invert chip
 *      is a flat neutral that reads as plain text here).
 *   2. Shiki code blocks: markdown fences are highlighted by Shiki as
 *      `pre.shiki` with token colors on inner spans; prose's own `pre`
 *      background/padding fights that (it overrode the pre to a light fill).
 *      `not-prose`-style reset on `pre.shiki` hands the block back to Shiki on
 *      Sovrium's dark surface.
 *   3. Callouts: `:::callout` renders as `.md-callout`/`[data-component=alert]`,
 *      which prose does not recognise — restore the warmth-bordered panel.
 *   4. Body text: the design-system base layer sets `p { color: var(--color-
 *      foreground) }` directly on `<p>` (dark, light-mode foreground), which
 *      beats prose's *inherited* `--tw-prose-body` color → invisible paragraphs
 *      on the dark docs surface. Re-assert the prose body color on `p`/`li` with
 *      class-level specificity so prose-invert wins.
 *   5. Docs-article-header breadcrumb: the header renders as the FIRST child
 *      inside the `.prose` article, so prose's `ol { padding-inline-start }` (a
 *      ≈19.5px list indent) leaks onto the breadcrumb `<ol>` and pushes the
 *      "Home" crumb ≈24px to the RIGHT of the article body text. Zero the ol's
 *      margin + padding so the breadcrumb's left edge lines up with the article
 *      body (its `list-none` already suppresses the markers).
 *
 * Raw author selectors do not need to live in `BUILTIN_CSS_CANDIDATES` (only
 * Tailwind utility class names are candidate-gated), so this scoped sheet is
 * safe to inject directly without a `bun run build:css-assets` regeneration.
 */
const DOCS_PROSE_PATCH = `
.prose :where(p,li){color:var(--tw-prose-body);}
.prose :where(a):not(:where([data-component] *)){color:var(--color-warmth, var(--color-foreground));text-decoration:underline;text-underline-offset:2px;}
.prose :where(a):not(:where([data-component] *)):hover{color:var(--color-warmth-border, var(--color-border-strong));}
.prose :where(:not(pre)>code)::before,.prose :where(:not(pre)>code)::after{content:none;}
.prose :where(:not(pre)>code){color:var(--color-warmth, var(--color-foreground));background:#f5f0eb;border:1px solid #e5ded5;border-radius:.375rem;padding:.1rem .4rem;font-weight:500;}
.dark .prose :where(:not(pre)>code){background:#171717;border-color:#262626;}
.prose pre.shiki{background:#0d0d0d;color:#e1e4e8;border:1px solid #262626;border-radius:.75rem;padding:1rem 1.25rem;overflow-x:auto;}
.prose pre.shiki code{background:none;border:0;padding:0;color:inherit;font-weight:400;}
.prose .md-callout,.prose [data-component="alert"]{border:1px solid #e5ded5;border-left:3px solid var(--color-warmth-border, var(--color-border-strong));background:#f5f0eb;border-radius:0 .5rem .5rem 0;padding:.85rem 1rem;margin:0 0 1.5rem;color:#3f3a34;}
.dark .prose .md-callout,.dark .prose [data-component="alert"]{border-color:#262626;background:#171717;color:#d4d4d4;}
.prose .md-callout p,.prose [data-component="alert"] p{color:inherit;}
.prose .md-callout :first-child,.prose [data-component="alert"] :first-child{margin-top:0;}
.prose .md-callout :last-child,.prose [data-component="alert"] :last-child{margin-bottom:0;}
.prose :where(h1,h2,h3,h4,h5,h6){scroll-margin-top:5rem;}
.prose [data-component="docs-article-header"] ol,.prose [data-component="docs-article-header"] li{margin:0;padding:0;}
`

/**
 * Hoisted `dangerouslySetInnerHTML` payload for the scoped prose patch
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
var nav=document.querySelector('[data-component="markdown-toc"]:not([data-toc-spy-ready])');
if(!nav){return;}
nav.setAttribute("data-toc-spy-ready","");
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
var btns=document.querySelectorAll("[data-copy-markdown]:not([data-copy-ready])");
for(var i=0;i<btns.length;i++){
(function(btn){
btn.setAttribute("data-copy-ready","");
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
