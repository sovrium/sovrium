/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// Card chrome shared by the operator's own account surfaces.
//
// The three pages about YOU — My profile, My data, API keys — are one cluster
// split across three routes, and they read as one only while their cards are
// byte-identical. These class lists were literals repeated across the three
// TypeScript builders precisely so they could not drift; naming them once is the
// same guarantee with one copy instead of three.
//
// Deliberately NOT a `design.components` entry. That key restyles an ENGINE
// component type by name (`button`, `table`); these are compositions of a
// `container` and two `text` nodes, which no engine type describes.

/** Card frame: bordered, raised, rounded, evenly padded. */
export const CARD_CLASS =
  'border-border bg-background-raised flex flex-col gap-3 rounded-md border p-5'

// `CARD_HEADING` and `CARD_BODY` stood here and were DELETED when the console
// moved to `src/admin/` and Knip could see the tree for the first time: nothing
// had imported either since the account pages were rewritten. The heading rule
// they documented has not gone anywhere — a card heading is an `h2`, because
// the page title above it is the `h1` and skipping to `h3` is a WCAG 1.3.1
// structure failure independent of how the heading looks — so it is written
// here rather than lost with the constant.

/** The body column every account surface centres its cards in. */
export const ACCOUNT_COLUMN = 'flex max-w-3xl flex-col gap-6'
