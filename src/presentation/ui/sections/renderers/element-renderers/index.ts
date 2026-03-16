/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Element renderers barrel export
 *
 * This module exports all element renderer functions organized by category:
 * - HTML element renderers (structural elements, headings, text)
 * - Text content renderers (paragraph, code, pre)
 * - Media renderers (image, video, audio, iframe)
 * - Interactive renderers (button, link, form, input, icon)
 * - Specialized renderers (alert, list, language-switcher)
 */

// HTML element renderers
export {
  renderHTMLElement,
  renderHeading,
  renderTextElement,
  type ElementProps,
  type HTMLElementConfig,
} from './html-element-renderer'

// Text content renderers
export { renderParagraph, renderCode, renderPre } from './text-content-renderers'

// Media renderers
export {
  renderImage,
  renderAvatar,
  renderThumbnail,
  renderHeroImage,
  renderVideo,
  renderAudio,
  renderIframe,
} from './media-renderers'

// Interactive renderers
export {
  renderButton,
  renderLink,
  renderForm,
  renderInput,
  renderIcon,
  renderCustomHTML,
} from './interactive-renderers'

// Re-export specialized renderers for backward compatibility
export {
  renderLanguageSwitcher,
  renderAlert,
  renderList,
  renderUnorderedList,
  renderListItem,
} from '../specialized-renderers'
