/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Shared sidebar glyph keys for the Native Admin Dashboard.
 *
 * Config is code-only: the dashboard is a pure operational Data console with a
 * Data-only sidebar, so the per-family config taxonomy (zones, Tier-A/Tier-B
 * affordances, per-element draft CRUD) has been removed. This module now only
 * declares the inline-SVG glyph key set shared between the sidebar Data nav
 * (`admin-sidebar-data-nav.ts`) and the glyph renderer (`admin-sidebar-icon.tsx`).
 */

/**
 * Family icon keys — map to the inline-SVG glyph set in `admin-sidebar-icon.tsx`
 * (Lucide-derived, stroke 1.5, 16px). Each Data destination carries one so the
 * sidebar reads as a scannable two-column list (glyph + label).
 */
export type FamilyIcon =
  | 'table'
  | 'page'
  | 'automation'
  | 'form'
  | 'bucket'
  | 'agent'
  | 'auth'
  | 'theme'
  | 'language'
  | 'component'
  | 'action'
  | 'connection'
  | 'link'
  | 'notification'
  | 'script'
  | 'env'
  | 'version'
  | 'activity'
  | 'admin'
  | 'ai'
