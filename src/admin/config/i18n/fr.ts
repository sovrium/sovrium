/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// The console's French catalogue, at exact key parity with `chrome.ts`,
// `console.ts`, `data.ts` and `developers.ts`, in that order.
//
// ─── FOUR FILES, ONE PER ENGLISH FILE ──────────────────────────────────────
//
// The English table is split by area because several migrations append to it at
// once, and one shared object is a merge conflict per commit. French was kept in
// one file for the opposite reason — its only real failure mode is falling out
// of PARITY with English — until it outgrew the file-size ceiling. It is now
// split along the SAME seam, one twin per English file (`fr-chrome.ts` beside
// `chrome.ts`, and so on), each in the English file's key order, so a missing key
// is still visible by reading two files side by side, and this file merges the
// four in the order the English table is merged. `design-system.ts` is
// deliberately NOT mirrored — that file is being authored concurrently, and
// translating a moving target is how a catalogue acquires a stale half.
//
// ─── IT IS WIRED, AND THE SERVER NOW COMPOSES IT (re-measured 2026-09-19) ───
//
// Founder decision of 2026-09-18: the operator console ships French. The choice
// is a row on `/profile` — a `select` posting `{ language }` to
// `POST /api/auth/update-user` — and NOT the sidebar `language-switcher`, which
// was removed on 2026-09-19 by a second founder decision.
//
// The switch of medium is the whole story, and it retires what this block used
// to say. The old note recorded that a mounted request carried no locale, so the
// SERVER always rendered `en-US` and French was a client-side repaint that
// reached `content` strings only — leaving the sidebar navigation, every grid
// caption and every landmark name in English. That limit is GONE: the signed-in
// operator's saved language outranks the `sovrium_language` cookie and the
// console is composed in it server-side. Measured on `/_admin/profile` with the
// account set to `fr` and again to `fr-FR`: `<html lang="fr-FR">` and the
// breadcrumb reads `Mon profil`, sidebar group captions included. That path is
// the MOUNTED console's; in the standalone preview (`bun run app:admin`,
// `admin: false`) the console is the root app and the page is `/profile`.
//
// Two consequences worth keeping:
//
//   1. ASSERT THROUGH THE SERVED BYTES, NEVER THE HYDRATED DOM. Every keyed
//      text node still ships `data-translations` carrying EVERY locale, so
//      `html.includes('Bienvenue')` is true of an English render too. Read the
//      first element of a tag out of a `page.request.get(...)` response.
//   2. IT COSTS +5-6% ON EVERY PAGE. Measured over eight pages: `/` +758 B,
//      `/env` +1,048 B, `/footprint` +2,423 B, 154 KB → 164 KB — one repeat of
//      each string per declared language. That payload is now the price of a
//      feature that works rather than dead weight.
//
// Two things that were feared and did NOT happen, recorded so nobody re-argues
// them: `<html lang>` is byte-identical with and without the table on an ENGLISH
// server render (checked on four pages), and `hreflang` links are NOT emitted.
//
// `bun run app:admin` still serves the console standalone, where the ordinary
// `/{lang}/` routing applies and `http://localhost:5005/fr/` renders the whole
// console in French. It remains the cheapest way to review a translation
// without signing in.
//
// The catalogue is authored NOW rather than after the seam because the cheap
// moment to name a string is while the page it belongs to is being written.
// Retrofitting 250 translations onto a finished console means reading all 28
// pages again.
//
// ─── VOICE ─────────────────────────────────────────────────────────────────
//
// `tu`, the house rule (`apps/website/config/design.ts` → `voice.pronoun`), of
// which only the Partner app has an exception and for a client-services reason
// the console does not share.
//
// The English carries a deliberate split of person that the French keeps: the
// ACCOUNT cluster speaks in the first person, because those pages are about the
// reader's own record ("Mon profil", "Mes données", "Mon identité"), while
// guidance speaks in the second ("ton app", "tes tables"). Collapsing the two
// would make "Export or erase my data" read as an instruction from the console
// rather than as the reader's own action.
//
// [internal ref] D4 and BRAND §6 hold verbatim: state, do not sell; say what happened,
// not how you feel about it; name the next action, and only when there is one.
// No exclamation mark anywhere.
//
// ─── TYPOGRAPHY: THE NO-BREAK SPACES ARE DELIBERATE ────────────────────────
//
// French sets a space before `:` `;` `?` `!` and inside `« »`. Those are U+00A0
// (no-break space), so the punctuation cannot wrap to the next line. They are
// invisible in a diff and easy to mistake for a stray character — they are not.
// Do not "clean" them, and do not replace them with an ordinary space: a French
// operator reads `Erreur: …` as machine translation.

import frChrome from './fr-chrome'
import frConsole from './fr-console'
import frData from './fr-data'
import frDevelopers from './fr-developers'

export default {
  ...frChrome,
  ...frConsole,
  ...frData,
  ...frDevelopers,
} as const
