/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

// What each type page draws for itself, and nothing else.
//
// One module per type, because the alternative is one file carrying every
// drawing on the catalogue and a reviewer who cannot tell which type a diff
// touched.
//
// A type ABSENT from this map draws its variant sections from the axis the
// schema publishes and stops — which is what `button` and `alert` do, and why
// neither has a module here any more. A type present supplies what the schema
// cannot: its resting `drawings`, an option showcase, or the one size ladder
// written on a key `sizeCount` never sees. See `body-shape.ts`.

import accordion from './accordion'
import aiChat from './ai-chat'
import alertDialog from './alert-dialog'
import avatar from './avatar'
import badge from './badge'
import breadcrumb from './breadcrumb'
import buttonGroup from './button-group'
import calendar from './calendar'
import card from './card'
import chart from './chart'
import checkbox from './checkbox'
import code from './code'
import codeEditor from './code-editor'
import commandPalette from './command-palette'
import comments from './comments'
import container from './container'
import contextMenu from './context-menu'
import datePicker from './date-picker'
import dateRangePicker from './date-range-picker'
import descriptionList from './description-list'
import dialog from './dialog'
import divider from './divider'
import drawer from './drawer'
import dropdownMenu from './dropdown-menu'
import emptyState from './empty-state'
import field from './field'
import fieldSpecimen from './field-specimen'
import fileUpload from './file-upload'
import filterBar from './filter-bar'
import flex from './flex'
import form from './form'
import gallery from './gallery'
import { genericBody } from './generic-body'
import grid from './grid'
import hoverCard from './hover-card'
import input from './input'
import inputGroup from './input-group'
import kanban from './kanban'
import kbd from './kbd'
import kpi from './kpi'
import languageSwitcher from './language-switcher'
import link from './link'
import list from './list'
import listItem from './list-item'
import marquee from './marquee'
import menubar from './menubar'
import navigationMenu from './navigation-menu'
import numberInput from './number-input'
import pagination from './pagination'
import popover from './popover'
import preview from './preview'
import progress from './progress'
import qrCode from './qr-code'
import radioGroup from './radio-group'
import recordField from './record-field'
import recordPicker from './record-picker'
import reorderableList from './reorderable-list'
import richTextEditor from './rich-text-editor'
import searchInput from './search-input'
import select from './select'
import sidebar from './sidebar'
import skeleton from './skeleton'
import slider from './slider'
import spacer from './spacer'
import specimen from './specimen'
import spinner from './spinner'
import splitPane from './split-pane'
import swatch from './swatch'
import aSwitch from './switch'
import table from './table'
import tabs from './tabs'
import text from './text'
import textarea from './textarea'
import themeToggle from './theme-toggle'
import timePicker from './time-picker'
import timeline from './timeline'
import toast from './toast'
import toc from './toc'
import toggle from './toggle'
import toggleGroup from './toggle-group'
import tooltip from './tooltip'
import type { TypePageBody } from './body-shape'

/**
 * The types whose only drawing is themselves.
 *
 * Each publishes no variant axis and has one appearance: an icon is an icon, a
 * video is a video. They author a single resting drawing rather than a list, so
 * the page shows it bare, under the section's own heading.
 *
 * `image` was here until it stopped being true: it publishes `default avatar
 * thumbnail hero`, so its page derives four sections and drew one.
 */
const GENERIC_TYPES = ['audio', 'icon', 'iframe', 'scroll-area', 'video'] as const

/**
 * The types the catalogue REPORTS, and that have no drawing to author yet.
 *
 * `genericBody` renders whichever half the page record calls for, so a refused
 * type reaching it states its reason in the one card where the drawing would
 * have been — the shape `[internal ref]` pins on `iframe`, which is
 * refused too and is listed above only because it ALSO has one appearance of
 * its own the day a console can hold it.
 *
 * These two are here rather than absent because absence is not a third answer.
 * A type in neither list draws its derived variant sections and stops — and
 * `graph` and `matrix` publish no variant axis, so "and stops" was the whole
 * page: no drawing, no reason, nothing for a reader to act on. That is the
 * fall-through `[internal ref]` exists to catch, and naming them here
 * is what turns it into a stated refusal.
 *
 * Why they are refused at all is the catalogue's to say, not this file's: both
 * read a nodes-and-edges envelope, the platform's specimen fixture publishes
 * rows, and the one graph an instance holds is the operator's own access map.
 * The sentence a reader sees comes from the catalogue record itself
 * (`catalog-specimens.ts`), bound through `$record.refusalReason`, so the
 * console cannot drift into inventing its own.
 */
const REPORTED_TYPES = ['graph', 'matrix'] as const

/** Type name → its authored body. */
export const TYPE_BODIES: Readonly<Record<string, TypePageBody>> = {
  ...Object.fromEntries(GENERIC_TYPES.map((t) => [t, genericBody(t)])),
  ...Object.fromEntries(REPORTED_TYPES.map((t) => [t, genericBody(t)])),
  'qr-code': qrCode,
  marquee,
  'ai-chat': aiChat,
  card,
  'file-upload': fileUpload,
  grid,
  'language-switcher': languageSwitcher,
  'number-input': numberInput,
  'reorderable-list': reorderableList,
  'time-picker': timePicker,
  accordion,
  avatar,
  code,
  'description-list': descriptionList,
  'empty-state': emptyState,
  kbd,
  'list-item': listItem,
  'search-input': searchInput,
  swatch,
  tabs,
  text,
  timeline,
  'alert-dialog': alertDialog,
  badge,
  breadcrumb,
  'button-group': buttonGroup,
  'command-palette': commandPalette,
  'context-menu': contextMenu,
  dialog,
  divider,
  drawer,
  'dropdown-menu': dropdownMenu,
  'hover-card': hoverCard,
  link,
  menubar,
  'navigation-menu': navigationMenu,
  pagination,
  popover,
  progress,
  skeleton,
  spacer,
  spinner,
  'theme-toggle': themeToggle,
  toast,
  toc,
  checkbox,
  'code-editor': codeEditor,
  'date-picker': datePicker,
  'date-range-picker': dateRangePicker,
  field,
  input,
  'input-group': inputGroup,
  'radio-group': radioGroup,
  'record-picker': recordPicker,
  'rich-text-editor': richTextEditor,
  select,
  slider,
  switch: aSwitch,
  textarea,
  toggle,
  'toggle-group': toggleGroup,
  calendar,
  chart,
  comments,
  'filter-bar': filterBar,
  form,
  gallery,
  kanban,
  kpi,
  list,
  table,
  container,
  flex,
  sidebar,
  'split-pane': splitPane,
  'field-specimen': fieldSpecimen,
  preview,
  specimen,
  'record-field': recordField,
  tooltip,
}
