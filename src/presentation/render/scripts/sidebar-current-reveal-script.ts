/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Sidebar current-entry reveal (SECURITY: Safe - static code, no user input).
 *
 * A sidebar's navigation root (`[data-sidebar-root]`, the `sidebar-content`
 * part) is its own scrolling region. When the page being read is reached
 * through an entry far down a long list, the server marks that entry
 * `aria-current="page"` — but the region opens scrolled to its top, so the one
 * row that answers "where am I" sits below the fold, often under the pinned
 * footer, until the reader goes looking for it.
 *
 * The script starts during body-end parse, when the sidebar's markup and the
 * blocking stylesheets are in place, and then keeps watching each navigation
 * root: an entry list fetched after hydration, a group that opens (its
 * `aria-expanded`, `data-state`, `data-open` or `hidden` flips), or a
 * same-document navigation that moves the mark all arrive later than the parse.
 * Every such change schedules ONE check on the next animation frame, so a burst
 * of mutations costs one layout read. A check centres the current entry in the
 * band the reader actually sees unless it is already wholly inside it: the
 * root's box, cut at its bottom padding (the band the fade at the scroll's end
 * paints over) and at the top of the sidebar's pinned footer, which can sit
 * over the list. The entry is re-checked on every change rather than once, so a
 * group opening ABOVE it after the first pass cannot push it out of sight.
 *
 * A reader's own scroll always wins: once the root scrolls away from the
 * position the script last set, the script stops revealing until a DIFFERENT
 * entry becomes current, so nobody is pulled back to a row they scrolled from.
 *
 * When several entries carry the mark (a parent row and its child), the LAST
 * one in document order — the most specific — is the one revealed.
 *
 * Two choices are deliberate:
 *
 *  - **`scrollTop`, never `scrollIntoView`.** `scrollIntoView` scrolls every
 *    scrollable ancestor, the document included, so revealing a sidebar row
 *    could move the page the reader came to read. Writing the region's own
 *    `scrollTop` moves the sidebar and nothing else.
 *  - **No animation.** The jump is instant, so there is no motion for
 *    `prefers-reduced-motion` to suppress.
 *
 * A collapsed (zero-height) entry, a region that does not overflow, and a
 * region whose overflow is clipped (the icon rail) are left alone, and retried
 * on the next change.
 */
export const SIDEBAR_CURRENT_REVEAL_SCRIPT = `!function(){function watch(r){var cur=null,want=r.scrollTop,user=!1,q=0;function reveal(){q=0;var all=r.querySelectorAll('[aria-current="page"]'),a=all[all.length-1];if(!a)return;if(a!==cur){cur=a;user=!1}if(user||r.scrollHeight<=r.clientHeight)return;var cs=getComputedStyle(r);if(!/(auto|scroll)/.test(cs.overflowY))return;var v=r.getBoundingClientRect(),b=a.getBoundingClientRect();if(b.height===0)return;var lo=v.bottom-(parseFloat(cs.paddingBottom)||0),s=r.closest('[data-sidebar="sidebar"]'),f=s&&s.querySelector('[data-sidebar="footer"]'),t=f&&f.getBoundingClientRect();if(t&&t.height>0&&t.top>v.top)lo=Math.min(lo,t.top);if(b.top>=v.top&&b.bottom<=lo)return;r.scrollTop+=b.top-v.top-(lo-v.top-b.height)/2;want=r.scrollTop}function later(){if(!q)q=requestAnimationFrame(reveal)}r.addEventListener('scroll',function(){if(Math.abs(r.scrollTop-want)>1)user=!0},{passive:!0});reveal();if(window.MutationObserver)new MutationObserver(later).observe(r,{subtree:true,childList:true,attributes:true,attributeFilter:["aria-current","aria-expanded","data-state","data-open","hidden"]})}var rs=document.querySelectorAll("[data-sidebar-root]");for(var i=0;i<rs.length;i++)watch(rs[i])}();`
