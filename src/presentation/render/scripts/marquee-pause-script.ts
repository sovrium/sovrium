/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Marquee pause runtime (SECURITY: Safe - static code, no user input).
 *
 * Backs the optional `pauseControl` button on a `marquee` band. The band itself is
 * CSS-only — this handler does nothing but flip `data-marquee-paused` on the band
 * root, which the stylesheet reads to stop the track's `animation-play-state`.
 * The control is what makes the motion stoppable WITHOUT a pointer held anywhere
 * (WCAG 2.2.2), so it also swaps its own visible label to the inverse action —
 * otherwise a visitor who paused the band is stranded with a permanently frozen
 * row and no obvious way back.
 *
 * Delegated for the same reason as `copyCodeScript` in
 * `render/page/page-body-scripts.tsx`: a band inside a tab panel mounts after
 * hydration.
 */
export const MARQUEE_PAUSE_SCRIPT = `!function(){document.addEventListener("click",function(t){var b=t.target.closest("[data-marquee-pause]");if(!b)return;var m=b.closest("[data-marquee]");if(!m)return;if(m.getAttribute("data-marquee-paused")==="true"){m.removeAttribute("data-marquee-paused");b.textContent=b.getAttribute("data-marquee-pause-label")||"Pause"}else{m.setAttribute("data-marquee-paused","true");b.textContent=b.getAttribute("data-marquee-resume-label")||"Resume"}})}();`
