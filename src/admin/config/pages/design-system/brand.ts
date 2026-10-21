/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// BRAND — the identity this app declared, as opposed to the values it renders
// with.
//
// Foundations owns the token VALUES; this page owns what they are FOR: the
// mark, the roles the colours play, the pictures this app permits, and the
// zone each route family belongs to.
//
// ─── FOUR ROW SOURCES, AND NOT ONE OF THEM IS JOINED ───────────────────────
//
// The mark's renderings and its geometry come from `/brand`, the declared
// SENTENCES from `/guidance`, the route map from `/zones`, and every empty
// state's gate from `/coverage`. A config page cannot join two arrays, so each
// block binds exactly one — which is why the mark's `alt` rides on the
// rendering row as well as on the geometry row, and why `hasVoiceOverride` is a
// boolean here rather than the override itself.
//
// ─── THE EMPTY STATES ARE GATED ON `coverage`, NOT ON A ROW COUNT ──────────
//
// `visibility.record` has neither a length nor a presence operator, so "this app
// declares no colour roles" is unaskable of a rows binding: zero rows render
// zero rows and there is nothing left to gate. `/coverage?key=` answers exactly
// that question as a ROW — one row carrying `declared` and the `configPath` an
// author would write — so each block binds its own layer and gates the
// disclosure on the row's own boolean. The page record is spent on `/brand`,
// which is the one gate the mark needs and the one no rows source could answer.
//
// ─── A LABEL THAT MUST APPEAR ONCE RIDES ON `index eq 0` ───────────────────
//
// A heading over a rows block cannot sit outside the binding without rendering
// over an empty list, and cannot sit inside it without repeating per row. Every
// guidance row publishes its zero-based `index` within its own kind, so the
// heading is a row child gated on the first one: present exactly when there is
// something to head, and exactly once.

import designSystemBrand from './design-system-brand.page.json'
import type { Page as PageConfig } from '@/domain/models/app'

export default designSystemBrand as PageConfig
