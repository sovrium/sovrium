/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

import { Schema } from 'effect'
import { AiChatTypeLiteral, aiChatFields } from './ai'
import {
  TextTypeLiteral,
  textFields,
  IconTypeLiteral,
  iconFields,
  ImageTypeLiteral,
  imageFields,
  VideoTypeLiteral,
  videoFields,
  AudioTypeLiteral,
  audioFields,
  IframeTypeLiteral,
  iframeFields,
  CodeElementTypeLiteral,
  codeElementFields,
  TocTypeLiteral,
  tocFields,
  SearchInputTypeLiteral,
  searchInputFields,
} from './content'
import {
  CustomReactTypeLiteral,
  customReactFields,
  CustomHtmlTypeLiteral,
  customHtmlFields,
} from './custom'
import {
  DataTableTypeLiteral,
  dataTableFields,
  KanbanTypeLiteral,
  kanbanFields,
  CalendarTypeLiteral,
  calendarFields,
  ChartTypeLiteral,
  chartFields,
  KpiTypeLiteral,
  kpiFields,
  GalleryTypeLiteral,
  galleryFields,
  FormTypeLiteral,
  formFields,
  ListTypeLiteral,
  listFields,
} from './data'
import {
  StaticTableTypeLiteral,
  staticTableFields,
  EmptyStateTypeLiteral,
  emptyStateFields,
  CarouselTypeLiteral,
  carouselFields,
  CommandTypeLiteral,
  commandFields,
  ResizableTypeLiteral,
  resizableFields,
  ScrollAreaTypeLiteral,
  scrollAreaFields,
  AspectRatioTypeLiteral,
  aspectRatioFields,
  AccordionTypeLiteral,
  accordionFields,
  TabsTypeLiteral,
  tabsFields,
  TimelineTypeLiteral,
  timelineFields,
  ListItemTypeLiteral,
  listItemFields,
  SpeechBubbleTypeLiteral,
  speechBubbleFields,
} from './display'
import {
  SkeletonTypeLiteral,
  skeletonFields,
  ProgressTypeLiteral,
  progressFields,
  SpinnerTypeLiteral,
  spinnerFields,
} from './feedback'
import {
  InputTypeLiteral,
  inputFields,
  CheckboxTypeLiteral,
  checkboxFields,
  RadioGroupTypeLiteral,
  radioGroupFields,
  SelectTypeLiteral,
  selectFields,
  ComboboxTypeLiteral,
  comboboxFields,
  TextareaTypeLiteral,
  textareaFields,
  DatePickerTypeLiteral,
  datePickerFields,
  SliderTypeLiteral,
  sliderFields,
  InputOtpTypeLiteral,
  inputOtpFields,
  FieldTypeLiteral,
  fieldFields,
  ToggleTypeLiteral,
  toggleFields,
  ToggleGroupTypeLiteral,
  toggleGroupFields,
  SwitchTypeLiteral,
  switchFields,
} from './form-controls'
import {
  ButtonTypeLiteral,
  buttonFields,
  BadgeTypeLiteral,
  badgeFields,
  AlertTypeLiteral,
  alertFields,
  LinkTypeLiteral,
  linkFields,
  ButtonGroupTypeLiteral,
  buttonGroupFields,
} from './interactive'
import {
  ContainerTypeLiteral,
  containerFields,
  FlexTypeLiteral,
  flexFields,
  GridTypeLiteral,
  gridFields,
  ResponsiveGridTypeLiteral,
  responsiveGridFields,
  SidebarTypeLiteral,
  sidebarFields,
  TabPanelTypeLiteral,
  tabPanelFields,
  CardTypeLiteral,
  cardFields,
  HeroTypeLiteral,
  heroFields,
  ModalTypeLiteral,
  modalFields,
} from './layout'
import {
  BreadcrumbTypeLiteral,
  breadcrumbFields,
  DropdownMenuTypeLiteral,
  dropdownMenuFields,
  ContextMenuTypeLiteral,
  contextMenuFields,
  MenubarTypeLiteral,
  menubarFields,
  NavigationMenuTypeLiteral,
  navigationMenuFields,
  PaginationTypeLiteral,
  paginationFields,
  NotificationBellTypeLiteral,
  notificationBellFields,
} from './navigation'
import {
  AlertDialogTypeLiteral,
  alertDialogFields,
  DrawerTypeLiteral,
  drawerFields,
  PopoverTypeLiteral,
  popoverFields,
  TooltipTypeLiteral,
  tooltipFields,
  HoverCardTypeLiteral,
  hoverCardFields,
  ToastTypeLiteral,
  toastFields,
} from './overlays'
import {
  FileUploadTypeLiteral,
  fileUploadFields,
  WizardTypeLiteral,
  wizardFields,
  NumberInputTypeLiteral,
  numberInputFields,
  TimePickerTypeLiteral,
  timePickerFields,
  TagsTypeLiteral,
  tagsFields,
  AvatarGroupTypeLiteral,
  avatarGroupFields,
  StatusIndicatorTypeLiteral,
  statusIndicatorFields,
  ReorderableListTypeLiteral,
  reorderableListFields,
  LanguageSwitcherTypeLiteral,
  languageSwitcherFields,
} from './specialty'
import { DividerTypeLiteral, dividerFields, SpacerTypeLiteral, spacerFields } from './structural'

// ─── Re-export all categories ──────────────────────────────────────────────

export * from './layout'
export * from './content'
export * from './data'
export * from './form-controls'
export * from './interactive'
export * from './navigation'
export * from './overlays'
export * from './display'
export * from './feedback'
export * from './specialty'
export * from './structural'
export * from './ai'
export * from './custom'
export * from './modules'

// ─── All component definitions as [TypeLiteral, fields] tuples ─────────────

const allComponents = [
  // Layout
  [ContainerTypeLiteral, containerFields],
  [FlexTypeLiteral, flexFields],
  [GridTypeLiteral, gridFields],
  [ResponsiveGridTypeLiteral, responsiveGridFields],
  [SidebarTypeLiteral, sidebarFields],
  [TabPanelTypeLiteral, tabPanelFields],
  [CardTypeLiteral, cardFields],
  [HeroTypeLiteral, heroFields],
  [ModalTypeLiteral, modalFields],
  // Content
  [TextTypeLiteral, textFields],
  [IconTypeLiteral, iconFields],
  [ImageTypeLiteral, imageFields],
  [VideoTypeLiteral, videoFields],
  [AudioTypeLiteral, audioFields],
  [IframeTypeLiteral, iframeFields],
  [CodeElementTypeLiteral, codeElementFields],
  [TocTypeLiteral, tocFields],
  [SearchInputTypeLiteral, searchInputFields],
  // Data
  [DataTableTypeLiteral, dataTableFields],
  [KanbanTypeLiteral, kanbanFields],
  [CalendarTypeLiteral, calendarFields],
  [ChartTypeLiteral, chartFields],
  [KpiTypeLiteral, kpiFields],
  [GalleryTypeLiteral, galleryFields],
  [FormTypeLiteral, formFields],
  [ListTypeLiteral, listFields],
  // Form Controls
  [InputTypeLiteral, inputFields],
  [CheckboxTypeLiteral, checkboxFields],
  [RadioGroupTypeLiteral, radioGroupFields],
  [SelectTypeLiteral, selectFields],
  [ComboboxTypeLiteral, comboboxFields],
  [TextareaTypeLiteral, textareaFields],
  [DatePickerTypeLiteral, datePickerFields],
  [SliderTypeLiteral, sliderFields],
  [InputOtpTypeLiteral, inputOtpFields],
  [FieldTypeLiteral, fieldFields],
  [ToggleTypeLiteral, toggleFields],
  [ToggleGroupTypeLiteral, toggleGroupFields],
  [SwitchTypeLiteral, switchFields],
  // Interactive
  [ButtonTypeLiteral, buttonFields],
  [BadgeTypeLiteral, badgeFields],
  [AlertTypeLiteral, alertFields],
  [LinkTypeLiteral, linkFields],
  [ButtonGroupTypeLiteral, buttonGroupFields],
  // Navigation
  [BreadcrumbTypeLiteral, breadcrumbFields],
  [DropdownMenuTypeLiteral, dropdownMenuFields],
  [ContextMenuTypeLiteral, contextMenuFields],
  [MenubarTypeLiteral, menubarFields],
  [NavigationMenuTypeLiteral, navigationMenuFields],
  [PaginationTypeLiteral, paginationFields],
  [NotificationBellTypeLiteral, notificationBellFields],
  // Overlays
  [AlertDialogTypeLiteral, alertDialogFields],
  [DrawerTypeLiteral, drawerFields],
  [PopoverTypeLiteral, popoverFields],
  [TooltipTypeLiteral, tooltipFields],
  [HoverCardTypeLiteral, hoverCardFields],
  [ToastTypeLiteral, toastFields],
  // Display
  [StaticTableTypeLiteral, staticTableFields],
  [EmptyStateTypeLiteral, emptyStateFields],
  [CarouselTypeLiteral, carouselFields],
  [CommandTypeLiteral, commandFields],
  [ResizableTypeLiteral, resizableFields],
  [ScrollAreaTypeLiteral, scrollAreaFields],
  [AspectRatioTypeLiteral, aspectRatioFields],
  [AccordionTypeLiteral, accordionFields],
  [TabsTypeLiteral, tabsFields],
  [TimelineTypeLiteral, timelineFields],
  [ListItemTypeLiteral, listItemFields],
  [SpeechBubbleTypeLiteral, speechBubbleFields],
  // Feedback
  [SkeletonTypeLiteral, skeletonFields],
  [ProgressTypeLiteral, progressFields],
  [SpinnerTypeLiteral, spinnerFields],
  // Specialty
  [FileUploadTypeLiteral, fileUploadFields],
  [WizardTypeLiteral, wizardFields],
  [NumberInputTypeLiteral, numberInputFields],
  [TimePickerTypeLiteral, timePickerFields],
  [TagsTypeLiteral, tagsFields],
  [AvatarGroupTypeLiteral, avatarGroupFields],
  [StatusIndicatorTypeLiteral, statusIndicatorFields],
  [ReorderableListTypeLiteral, reorderableListFields],
  [LanguageSwitcherTypeLiteral, languageSwitcherFields],
  // Structural
  [DividerTypeLiteral, dividerFields],
  [SpacerTypeLiteral, spacerFields],
  // AI
  [AiChatTypeLiteral, aiChatFields],
  // Custom
  [CustomReactTypeLiteral, customReactFields],
  [CustomHtmlTypeLiteral, customHtmlFields],
] as const

// ─── ComponentTypeSchema (reconstructed from all type literals) ────────────

/**
 * Component type enum reconstructed from all per-type literals.
 * Each component type is defined in its own file with only relevant properties.
 */
export const ComponentTypeSchema = Schema.Union(
  // Layout
  ContainerTypeLiteral,
  FlexTypeLiteral,
  GridTypeLiteral,
  ResponsiveGridTypeLiteral,
  SidebarTypeLiteral,
  TabPanelTypeLiteral,
  CardTypeLiteral,
  HeroTypeLiteral,
  ModalTypeLiteral,
  // Content
  TextTypeLiteral,
  IconTypeLiteral,
  ImageTypeLiteral,
  VideoTypeLiteral,
  AudioTypeLiteral,
  IframeTypeLiteral,
  CodeElementTypeLiteral,
  TocTypeLiteral,
  SearchInputTypeLiteral,
  // Data
  DataTableTypeLiteral,
  KanbanTypeLiteral,
  CalendarTypeLiteral,
  ChartTypeLiteral,
  KpiTypeLiteral,
  GalleryTypeLiteral,
  FormTypeLiteral,
  ListTypeLiteral,
  // Form Controls
  InputTypeLiteral,
  CheckboxTypeLiteral,
  RadioGroupTypeLiteral,
  SelectTypeLiteral,
  ComboboxTypeLiteral,
  TextareaTypeLiteral,
  DatePickerTypeLiteral,
  SliderTypeLiteral,
  InputOtpTypeLiteral,
  FieldTypeLiteral,
  ToggleTypeLiteral,
  ToggleGroupTypeLiteral,
  SwitchTypeLiteral,
  // Interactive
  ButtonTypeLiteral,
  BadgeTypeLiteral,
  AlertTypeLiteral,
  LinkTypeLiteral,
  ButtonGroupTypeLiteral,
  // Navigation
  BreadcrumbTypeLiteral,
  DropdownMenuTypeLiteral,
  ContextMenuTypeLiteral,
  MenubarTypeLiteral,
  NavigationMenuTypeLiteral,
  PaginationTypeLiteral,
  NotificationBellTypeLiteral,
  // Overlays
  AlertDialogTypeLiteral,
  DrawerTypeLiteral,
  PopoverTypeLiteral,
  TooltipTypeLiteral,
  HoverCardTypeLiteral,
  ToastTypeLiteral,
  // Display
  StaticTableTypeLiteral,
  EmptyStateTypeLiteral,
  CarouselTypeLiteral,
  CommandTypeLiteral,
  ResizableTypeLiteral,
  ScrollAreaTypeLiteral,
  AspectRatioTypeLiteral,
  AccordionTypeLiteral,
  TabsTypeLiteral,
  TimelineTypeLiteral,
  ListItemTypeLiteral,
  SpeechBubbleTypeLiteral,
  // Feedback
  SkeletonTypeLiteral,
  ProgressTypeLiteral,
  SpinnerTypeLiteral,
  // Specialty
  FileUploadTypeLiteral,
  WizardTypeLiteral,
  NumberInputTypeLiteral,
  TimePickerTypeLiteral,
  TagsTypeLiteral,
  AvatarGroupTypeLiteral,
  StatusIndicatorTypeLiteral,
  ReorderableListTypeLiteral,
  LanguageSwitcherTypeLiteral,
  // Structural
  DividerTypeLiteral,
  SpacerTypeLiteral,
  // AI
  AiChatTypeLiteral,
  // Custom
  CustomReactTypeLiteral,
  CustomHtmlTypeLiteral
).annotations({
  title: 'Component Type',
  description: 'Component type for page building',
})

/** @public */
export type ComponentType = Schema.Schema.Type<typeof ComponentTypeSchema>

// ─── Container Types (components that support children nesting) ─────────────

/**
 * Whitelist of component types that support `children` nesting.
 *
 * Only container/wrapper components should accept children. Data-driven components
 * (data-table, chart, kanban, etc.), leaf elements (icon, divider, spinner, etc.),
 * form controls, and content components (which use `content` field instead) do NOT
 * support children.
 *
 * New components default to NO children — add here only if they genuinely
 * wrap arbitrary child components.
 */
const CONTAINER_TYPES: ReadonlySet<string> = new Set([
  // Layout containers
  'container',
  'flex',
  'grid',
  'responsive-grid',
  'sidebar',
  'tab-panel',
  'card',
  'hero',
  'modal',
  // Text elements (wrap inline text/component children, e.g. <h1>Welcome</h1>)
  'text',
  // Interactive containers (wrap icon + text children, e.g. <Button><Icon /> Submit</Button>)
  'button',
  'badge',
  'link',
  'alert',
  'button-group',
  // Data containers (wrap child components like form fields)
  'form',
  'list',
  // Form-control composer (wraps a single input + label + description + error)
  'field',
  // Overlay containers
  'alert-dialog',
  'drawer',
  'popover',
  'tooltip',
  'hover-card',
  // Display containers
  'empty-state',
  'carousel',
  'command',
  'resizable',
  'scroll-area',
  'aspect-ratio',
  'accordion',
  'tabs',
  'timeline',
  'list-item',
  // Specialty containers
  'wizard',
  // Custom components (may need arbitrary children)
  'custom-react',
  'customHTML',
])

// ─── Union Builder ──────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Generic fields injected per consumer (children, name, etc.)
type InjectableFields = Record<string, any>

/**
 * Build a discriminated union of component schemas.
 *
 * Each consumer (page components, template components, child elements)
 * calls this with its own `children` field definition, since the children
 * type differs per context (page children support $ref, template children don't).
 *
 * Children are only injected into container types listed in CONTAINER_TYPES.
 * Data components, leaf elements, form controls, and content components
 * do NOT receive children — they use structured config or `content` instead.
 *
 * Each component type gets ONLY the shared field modules it opts into,
 * plus its own type-specific properties. A spacer gets only `props`,
 * while a data-table gets `props + responsive + visibility + i18n + dataBound`.
 *
 * @param childrenField - Object with a `children` key (Schema.optional(...))
 * @param extraFields - Additional fields to add to every branch (e.g. `name` for templates)
 */
export function buildComponentUnion(
  childrenField: InjectableFields,
  extraFields: InjectableFields = {}
) {
  const branches = allComponents.map(([typeLiteral, fields]) => {
    // Extract the type string from the Schema.Literal AST to check container membership
    const { ast } = typeLiteral
    const isContainer =
      ast._tag === 'Literal' && typeof ast.literal === 'string' && CONTAINER_TYPES.has(ast.literal)

    return Schema.Struct({
      type: typeLiteral,
      ...(isContainer ? childrenField : {}),
      ...fields,
      ...extraFields,
    })
  })

  // Schema.Union requires at least 2 members
  return Schema.Union(
    ...(branches as [(typeof branches)[0], (typeof branches)[0], ...typeof branches])
  )
}
