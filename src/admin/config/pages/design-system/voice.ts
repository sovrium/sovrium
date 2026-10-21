/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// VOICE — the half of a design system that tokens cannot carry.
//
// An operator who can see every colour and still does not know that this app
// never uses exclamation marks has not been shown its design system. Every line
// on this page is the operator's own, read from the same document an agent is
// handed.
//
// ─── THE SPLIT IS SERVER-SIDE, AND IT HAS TO BE ────────────────────────────
//
// `design.voice.prefer` is an array of bare strings, and every entry is written
// as an instruction followed by its reason. Separating the two is a quote-aware
// splitter — a naive cut on the first period falls inside
// `…"Sovrium runs the application. On your own infrastructure."` — and a config
// page has no string operations at all. So `/guidance` publishes both halves,
// and this page's only job is to set them in two registers.
//
// The invariant the whole claim rests on is that the two REJOIN to the
// declaration exactly, with one space between them. That is why every rule row
// carries the instruction, the reason, and NOTHING ELSE: an ordinal or a
// repeated label inside the row would break a rejoin that is asserted against
// the row's own text.
//
// ─── THE TRAILING SPACE IS LOAD-BEARING ────────────────────────────────────
//
// The two registers are separate blocks, so `textContent` concatenates them
// with no separator — `…with its verb.A verb tells…` — and the declared line
// stops being findable on the page as the operator wrote it. A reader searching
// this page for their own rule has to find it.
//
// ─── ONE PAGE RECORD, SPENT ON THE ONE GATE THAT NEEDS IT ──────────────────
//
// `visibility.record` has no length operator and no presence operator, so
// "this app declared no tone" is not askable of a rows binding. The page
// therefore binds `?kind=voice.tone` as its RECORD and gates the tone empty
// state on that response's own `total` — the same shape the type page uses for
// `pageCount` beside `routes`. Every other `$record.` on this page sits under a
// `dataSource`, whose children the page-record pass deliberately leaves alone.

import designSystemVoice from './design-system-voice.page.json'
import type { Page as PageConfig } from '@/domain/models/app'

export default designSystemVoice as PageConfig
