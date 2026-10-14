/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * `@shadcn/react`, shadcn's own unstyled primitives ([internal ref] D3). Each
 * subpath is adopted by its own port: `message-scroller` by the
 * `message-scroller` type and the conversation views, `questionnaire` by the
 * `questionnaire` type.
 *
 * Today this module is a stub consumer (shadcn parity plan §9.1) of the
 * `message-scroller` subpath, reached only through
 * `loadMessageScrollerPrimitives` in the console's agent-conversations
 * island. The `questionnaire` subpath gets its own lazy module in its port.
 */
export { MessageScroller } from '@shadcn/react/message-scroller'
