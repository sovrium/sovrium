/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// ─── Shiki Syntax Highlighting Script ────────────────────────────────────────
// Loads Shiki from CDN and highlights all code blocks with data-shiki attribute.
// Graceful degradation: plain gray monospace text stays if CDN fails.

export const shikiHighlightScript = {
  code: [
    '(async function(){',
    'try{',
    'var els=document.querySelectorAll("[data-shiki]");',
    'if(!els.length)return;',
    'var m=await import("https://esm.sh/shiki@3.0.0/bundle/web");',
    'var h=m.codeToHtml;',
    'for(var i=0;i<els.length;i++){',
    'var el=els[i];',
    'var code=el.textContent||"";',
    'var lang=el.getAttribute("data-lang")||"text";',
    'try{',
    'var html=await h(code,{lang:lang,theme:"github-dark"});',
    'el.innerHTML=html;',
    'el.setAttribute("data-shiki-done","1");',
    '}catch(e){console.warn("Shiki: failed to highlight",lang,e)}',
    '}',
    '}catch(e){console.warn("Shiki: CDN load failed",e)}',
    '})();',
  ].join(''),
  position: 'body-end' as const,
}

// ─── Custom Styles for Shiki Output ──────────────────────────────────────────
// Ensures Shiki-generated HTML integrates with our dark theme.

export const shikiCustomStyles = [
  {
    type: 'style' as const,
    content: [
      '[data-shiki-done] pre{background:transparent!important;margin:0;padding:0;overflow-x:auto}',
      '[data-shiki-done] code{font-size:0.875rem;line-height:1.625}',
      '[data-shiki-done] .line{min-height:1.25rem}',
    ].join(''),
  },
]
