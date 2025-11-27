/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Re-export from element-renderers directory
 *
 * This file maintains backward compatibility with existing imports.
 * The actual implementation has been split into:
 * - html-element-renderer.tsx (renderHTMLElement, renderHeading, renderTextElement)
 * - text-content-renderers.tsx (renderParagraph, renderCode, renderPre)
 * - media-renderers.tsx (renderImage, renderVideo, renderAudio, etc.)
 * - interactive-renderers.tsx (renderButton, renderLink, renderForm, etc.)
 *
 * @see src/presentation/components/sections/renderers/element-renderers/
 */
export {
  // Types
  type ElementProps,
  type HTMLElementConfig,
  // HTML element renderers
  renderHTMLElement,
  renderHeading,
  renderTextElement,
  // Text content renderers
  renderParagraph,
  renderCode,
  renderPre,
  // Media renderers
  renderImage,
  renderAvatar,
  renderThumbnail,
  renderHeroImage,
  renderVideo,
  renderAudio,
  renderIframe,
  // Interactive renderers
  renderButton,
  renderLink,
  renderForm,
  renderInput,
  renderIcon,
  renderCustomHTML,
  // Specialized renderers
  renderLanguageSwitcher,
  renderAlert,
  renderList,
  renderUnorderedList,
  renderListItem,
} from './element-renderers/'
