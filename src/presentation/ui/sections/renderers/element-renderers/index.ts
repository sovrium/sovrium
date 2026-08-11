/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
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
  renderStatusBadge,
} from './html-element-renderer'
export type { ElementProps, HTMLElementConfig, StatusBadgeConfig } from './html-element-renderer'

// Text content renderers
export { renderParagraph, renderCode, renderPre, renderBlockquote } from './text-content-renderers'

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
  renderFileUpload,
  renderIcon,
  renderCustomHTML,
  renderSearchInput,
  renderPageSearch,
} from './interactive-renderers'

// Form-control renderers (time-picker, number-input, date-picker, file-upload island)
export {
  renderFileUploadIsland,
  renderTimePicker,
  renderNumberInputIsland,
  renderDatePickerIsland,
} from './form-control-renderers'

// Field-composer + textarea renderers
export {
  renderField,
  renderTextarea,
  extractFirstChildId,
  type RenderFieldConfig,
  type RenderTextareaConfig,
} from './field-renderer'

// Re-export specialized renderers for backward compatibility
export {
  renderLanguageSwitcher,
  renderAlert,
  renderList,
  renderListItem,
} from '../specialized-renderers'
