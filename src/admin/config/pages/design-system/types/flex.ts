/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// `flex` — a row or a column, declared in classes.
//
// This type has NO schema keys of its own. Not a short list: none. Its direction,
// wrapping, gaps, alignment and justification are all Tailwind utilities in
// `props.className`, and what the type contributes is the `display: flex` and a
// name that says what the box is for.
//
// So the page draws it once. The reference draws it once too, and the reason is
// the same: a second drawing would differ only by a class an author writes on
// any box, which is documentation for Tailwind rather than for this component.
//
// When to reach for it over `container`: `flex` announces that the children are
// arranged with respect to each other. When the arrangement is a grid of equal
// cells, `grid` says so better and takes real keys for it.

import { genericBody } from './generic-body'

const flex = genericBody('flex')

export default flex
