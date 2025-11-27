/**
 * Copyright (c) 2025 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import * as Renderers from '../../renderers/element-renderers'
import { convertBadgeProps } from '../component-registry-helpers'
import type { ComponentRenderer } from '../component-dispatch-config'
import type { Component } from '@/domain/models/app/page/sections'

/**
 * Interactive components (button, link, form, input, icon, badge, etc.)
 *
 * These components render interactive elements and form controls.
 */
export const interactiveComponents: Partial<Record<Component['type'], ComponentRenderer>> = {
  button: ({ elementProps, content, renderedChildren, interactions }) =>
    Renderers.renderButton(elementProps, content, renderedChildren, interactions),

  link: ({ elementProps, content, renderedChildren }) =>
    Renderers.renderLink(elementProps, content, renderedChildren),

  a: ({ elementProps, content, renderedChildren }) =>
    Renderers.renderLink(elementProps, content, renderedChildren),

  alert: ({ elementProps, content, renderedChildren, theme }) =>
    Renderers.renderAlert(elementProps, content, renderedChildren, theme),

  form: ({ elementProps, renderedChildren }) =>
    Renderers.renderForm(elementProps, renderedChildren),

  input: ({ elementProps }) => Renderers.renderInput(elementProps),

  icon: ({ elementProps, renderedChildren }) =>
    Renderers.renderIcon(elementProps, renderedChildren),

  badge: ({ elementProps, content, renderedChildren, interactions }) => {
    const badgeProps = convertBadgeProps(elementProps)
    return Renderers.renderHTMLElement({
      type: 'span',
      props: badgeProps,
      content: content,
      children: renderedChildren,
      interactions: interactions,
    })
  },

  customHTML: ({ elementProps }) => Renderers.renderCustomHTML(elementProps),

  'language-switcher': ({ elementProps, languages }) =>
    Renderers.renderLanguageSwitcher(elementProps, languages),
}
