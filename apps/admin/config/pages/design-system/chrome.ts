/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// What every design-system console page shares with its six siblings.
//
// ─── THE SECTION DECLARES NO SCHEME TOGGLE OF ITS OWN ──────────────────────
//
// It declared one until 2026-09-16, in the shell's `chromeEnd` slot. The shared
// shell bar now carries a scheme toggle on EVERY console page
// (`components/shell.ts`), so a second declaration here put two controls in one
// bar — redundancy on a single axis rather than a choice between two.
//
// One toggle, in the shell, everywhere: a reader moving between a design-system
// page and a data page finds the control in the same place, and the section has
// nothing left to forget. The kit still draws `theme-toggle` as a SPECIMEN on
// `/ui-kit`, inside the app scope, which is a drawing rather than a control.
//
// ─── THE TRAIL IS DERIVED, SO A PAGE DECLARES ONLY ITS OWN NOUN ────────────
//
// `withShell`'s breadcrumb derives from the request path; a surface supplies the
// human noun for each segment. Every console page shares the `design-system`
// segment, so naming it once here is what stops seven pages disagreeing about
// what the section is called.

/**
 * The head script honouring a `?scheme=` deep link, for the pages that take it.
 *
 * ONE axis, two inputs: the operator's STORED preference, applied before paint
 * by the shared no-FOUC script, and a REQUEST — a deep link someone was sent has
 * to show them what the sender saw. For that one request the query wins, which
 * is why this runs LAST in the head. It writes nothing to storage.
 *
 * It reads `location.search` itself rather than being emitted conditionally: a
 * config page is one document for every request, and resolving the query on the
 * client is what lets the same declaration serve both states. A misspelt value
 * falls through to the stored preference rather than to some default — a typo
 * must not silently repaint the section.
 *
 * ─── IT LIVES HERE BECAUSE A SECOND PAGE NEEDS IT ─────────────────────────
 *
 * Foundations declared it first, inline. Components now needs the same script:
 * its three viewport frames are documents of their own that resolve their
 * scheme by asking the hosting one, so a deep link the host never honours
 * reaches nothing. Two copies of one string are two things to keep in step,
 * and this file is already where a design-system page goes for what it shares.
 *
 * It is NOT in `withShell`, and that is a deferral rather than a verdict.
 * Lifting it would give all twenty-one console pages the behaviour in one line
 * — but the shell takes no `scripts` today, so it would have to merge with a
 * page's own, and Foundations declares one. A page emitting the script twice
 * still passes every scheme assertion there is, which is exactly the kind of
 * change that must not ride along inside another.
 */
export const SCHEME_DEEP_LINK_SCRIPT =
  "(function(){try{var s=new URLSearchParams(window.location.search).get('scheme');" +
  'var root=document.documentElement;' +
  "if(s==='dark'){root.classList.add('dark')}else if(s==='light'){root.classList.remove('dark')}" +
  '}catch(e){}})();'

/** The label the section root carries in every page's trail. */
const SECTION_LABEL = 'Design system'

/** The derived trail for one console page: the section, then its own noun. */
export const designSystemBreadcrumb = (
  slug: string,
  label: string
): Readonly<Record<string, string>> => ({ 'design-system': SECTION_LABEL, [slug]: label })
