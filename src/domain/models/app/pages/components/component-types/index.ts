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
  PageSearchTypeLiteral,
  pageSearchFields,
} from './content'
import { CustomHtmlTypeLiteral, customHtmlFields } from './custom'
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
  DataFormTypeLiteral,
  formFields,
  ListTypeLiteral,
  listFields,
  DataTimelineTypeLiteral,
  dataTimelineFields,
} from './data'
import {
  StaticTableTypeLiteral,
  staticTableFields,
  EmptyStateTypeLiteral,
  emptyStateFields,
  MarqueeTypeLiteral,
  marqueeFields,
  ScrollAreaTypeLiteral,
  scrollAreaFields,
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
  RecordFieldTypeLiteral,
  recordFieldFields,
} from './display'
import {
  SchemaJsonEditorTypeLiteral,
  schemaJsonEditorFields,
  SchemaYamlEditorTypeLiteral,
  schemaYamlEditorFields,
  SchemaFormEditorTypeLiteral,
  schemaFormEditorFields,
  SchemaAiAgentTypeLiteral,
  schemaAiAgentFields,
} from './editors'
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
  TextareaTypeLiteral,
  textareaFields,
  DatePickerTypeLiteral,
  datePickerFields,
  SliderTypeLiteral,
  sliderFields,
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
  ThemeToggleTypeLiteral,
  themeToggleFields,
} from './interactive'
import {
  ContainerTypeLiteral,
  containerFields,
  SplitPaneTypeLiteral,
  splitPaneFields,
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
} from './navigation'
import {
  AlertDialogTypeLiteral,
  alertDialogFields,
  DialogTypeLiteral,
  dialogFields,
  DrawerTypeLiteral,
  drawerFields,
  RecordDrawerTypeLiteral,
  recordDrawerFields,
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
  NumberInputTypeLiteral,
  numberInputFields,
  TimePickerTypeLiteral,
  timePickerFields,
  ReorderableListTypeLiteral,
  reorderableListFields,
  LanguageSwitcherTypeLiteral,
  languageSwitcherFields,
  CommentsTypeLiteral,
  commentsFields,
  CommentCountTypeLiteral,
  commentCountFields,
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
export * from './editors'
export * from './custom'
export * from './modules'

// ─── All component definitions as [TypeLiteral, fields] tuples ─────────────

const allComponents = [
  // Layout
  [ContainerTypeLiteral, containerFields],
  [SplitPaneTypeLiteral, splitPaneFields],
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
  [PageSearchTypeLiteral, pageSearchFields],
  // Data
  [DataTableTypeLiteral, dataTableFields],
  [KanbanTypeLiteral, kanbanFields],
  [CalendarTypeLiteral, calendarFields],
  [ChartTypeLiteral, chartFields],
  [KpiTypeLiteral, kpiFields],
  [GalleryTypeLiteral, galleryFields],
  [FormTypeLiteral, formFields],
  [DataFormTypeLiteral, formFields],
  [ListTypeLiteral, listFields],
  [DataTimelineTypeLiteral, dataTimelineFields],
  // Form Controls
  [InputTypeLiteral, inputFields],
  [CheckboxTypeLiteral, checkboxFields],
  [RadioGroupTypeLiteral, radioGroupFields],
  [SelectTypeLiteral, selectFields],
  [TextareaTypeLiteral, textareaFields],
  [DatePickerTypeLiteral, datePickerFields],
  [SliderTypeLiteral, sliderFields],
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
  [ThemeToggleTypeLiteral, themeToggleFields],
  // Navigation
  [BreadcrumbTypeLiteral, breadcrumbFields],
  [DropdownMenuTypeLiteral, dropdownMenuFields],
  [ContextMenuTypeLiteral, contextMenuFields],
  [MenubarTypeLiteral, menubarFields],
  [NavigationMenuTypeLiteral, navigationMenuFields],
  [PaginationTypeLiteral, paginationFields],
  // Overlays
  [AlertDialogTypeLiteral, alertDialogFields],
  [DialogTypeLiteral, dialogFields],
  [DrawerTypeLiteral, drawerFields],
  [RecordDrawerTypeLiteral, recordDrawerFields],
  [PopoverTypeLiteral, popoverFields],
  [TooltipTypeLiteral, tooltipFields],
  [HoverCardTypeLiteral, hoverCardFields],
  [ToastTypeLiteral, toastFields],
  // Display
  [StaticTableTypeLiteral, staticTableFields],
  [EmptyStateTypeLiteral, emptyStateFields],
  [MarqueeTypeLiteral, marqueeFields],
  [ScrollAreaTypeLiteral, scrollAreaFields],
  [AccordionTypeLiteral, accordionFields],
  [TabsTypeLiteral, tabsFields],
  [TimelineTypeLiteral, timelineFields],
  [ListItemTypeLiteral, listItemFields],
  [SpeechBubbleTypeLiteral, speechBubbleFields],
  [RecordFieldTypeLiteral, recordFieldFields],
  // Feedback
  [SkeletonTypeLiteral, skeletonFields],
  [ProgressTypeLiteral, progressFields],
  [SpinnerTypeLiteral, spinnerFields],
  // Specialty
  [FileUploadTypeLiteral, fileUploadFields],
  [NumberInputTypeLiteral, numberInputFields],
  [TimePickerTypeLiteral, timePickerFields],
  [ReorderableListTypeLiteral, reorderableListFields],
  [LanguageSwitcherTypeLiteral, languageSwitcherFields],
  [CommentsTypeLiteral, commentsFields],
  [CommentCountTypeLiteral, commentCountFields],
  // Structural
  [DividerTypeLiteral, dividerFields],
  [SpacerTypeLiteral, spacerFields],
  // AI
  [AiChatTypeLiteral, aiChatFields],
  // Editors (schema/config authoring) — islands deferred (red contract)
  [SchemaJsonEditorTypeLiteral, schemaJsonEditorFields],
  [SchemaYamlEditorTypeLiteral, schemaYamlEditorFields],
  [SchemaFormEditorTypeLiteral, schemaFormEditorFields],
  [SchemaAiAgentTypeLiteral, schemaAiAgentFields],
  // Custom
  [CustomHtmlTypeLiteral, customHtmlFields],
] as const

// ─── ComponentTypeSchema (reconstructed from all type literals) ────────────

/**
 * Component type enum reconstructed from all per-type literals.
 * Each component type is defined in its own file with only relevant properties.
 */
export const ComponentTypeSchema = Schema.Union(
  // Layout
  [
    ContainerTypeLiteral,
    SplitPaneTypeLiteral,
    FlexTypeLiteral,
    GridTypeLiteral,
    ResponsiveGridTypeLiteral,
    SidebarTypeLiteral,
    TabPanelTypeLiteral,
    CardTypeLiteral,
    HeroTypeLiteral,
    ModalTypeLiteral,
    TextTypeLiteral,
    IconTypeLiteral,
    ImageTypeLiteral,
    VideoTypeLiteral,
    AudioTypeLiteral,
    IframeTypeLiteral,
    CodeElementTypeLiteral,
    TocTypeLiteral,
    SearchInputTypeLiteral,
    PageSearchTypeLiteral,
    DataTableTypeLiteral,
    KanbanTypeLiteral,
    CalendarTypeLiteral,
    ChartTypeLiteral,
    KpiTypeLiteral,
    GalleryTypeLiteral,
    FormTypeLiteral,
    DataFormTypeLiteral,
    ListTypeLiteral,
    DataTimelineTypeLiteral,
    InputTypeLiteral,
    CheckboxTypeLiteral,
    RadioGroupTypeLiteral,
    SelectTypeLiteral,
    TextareaTypeLiteral,
    DatePickerTypeLiteral,
    SliderTypeLiteral,
    FieldTypeLiteral,
    ToggleTypeLiteral,
    ToggleGroupTypeLiteral,
    SwitchTypeLiteral,
    ButtonTypeLiteral,
    BadgeTypeLiteral,
    AlertTypeLiteral,
    LinkTypeLiteral,
    ButtonGroupTypeLiteral,
    ThemeToggleTypeLiteral,
    BreadcrumbTypeLiteral,
    DropdownMenuTypeLiteral,
    ContextMenuTypeLiteral,
    MenubarTypeLiteral,
    NavigationMenuTypeLiteral,
    PaginationTypeLiteral,
    AlertDialogTypeLiteral,
    DialogTypeLiteral,
    DrawerTypeLiteral,
    RecordDrawerTypeLiteral,
    PopoverTypeLiteral,
    TooltipTypeLiteral,
    HoverCardTypeLiteral,
    ToastTypeLiteral,
    StaticTableTypeLiteral,
    EmptyStateTypeLiteral,
    MarqueeTypeLiteral,
    ScrollAreaTypeLiteral,
    AccordionTypeLiteral,
    TabsTypeLiteral,
    TimelineTypeLiteral,
    ListItemTypeLiteral,
    SpeechBubbleTypeLiteral,
    RecordFieldTypeLiteral,
    SkeletonTypeLiteral,
    ProgressTypeLiteral,
    SpinnerTypeLiteral,
    FileUploadTypeLiteral,
    NumberInputTypeLiteral,
    TimePickerTypeLiteral,
    ReorderableListTypeLiteral,
    LanguageSwitcherTypeLiteral,
    CommentsTypeLiteral,
    CommentCountTypeLiteral,
    DividerTypeLiteral,
    SpacerTypeLiteral,
    AiChatTypeLiteral,
    SchemaJsonEditorTypeLiteral,
    SchemaYamlEditorTypeLiteral,
    SchemaFormEditorTypeLiteral,
    SchemaAiAgentTypeLiteral,
    CustomHtmlTypeLiteral,
  ]
).annotate({
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
  'split-pane',
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
  'data-form',
  'list',
  // Form-control composer (wraps a single input + label + description + error)
  'field',
  // Overlay containers
  'alert-dialog',
  'dialog',
  'drawer',
  'popover',
  'tooltip',
  'hover-card',
  // Display containers
  'empty-state',
  // A marquee scrolls its children, so it must be able to hold them
  'marquee',
  'scroll-area',
  'accordion',
  'tabs',
  'timeline',
  'list-item',
  // Reorderable list wraps list-item children for drag-and-drop reordering
  'reorderable-list',
  // Custom components (may need arbitrary children)
  'customHTML',
])

// ─── Derived component shape ────────────────────────────────────────────────

/**
 * Decoded shape of ONE component branch — its `type` literal plus every key its
 * `<name>Fields` record declares — derived MECHANICALLY from the same
 * `allComponents` tuple `buildComponentUnion` iterates.
 *
 * Deriving rather than hand-writing is the whole point: a hand-written mirror
 * of 89 component definitions is a second source of truth that drifts, which is
 * precisely the failure this type exists to end.
 */
type ComponentBranchType<D> = D extends readonly [infer TypeLiteral, infer Fields]
  ? Fields extends Schema.Struct.Fields
    ? { readonly type: Schema.Schema.Type<TypeLiteral> } & Schema.Struct.Type<Fields>
    : never
  : never

/**
 * Discriminated union of every component's decoded shape, keyed by `type`.
 *
 * Does NOT carry `children`: that field is injected per consumer by
 * {@link buildComponentUnion} and only onto `CONTAINER_TYPES`, so a consumer
 * intersects its own children shape onto this union. Today only `TypedComponent`
 * (`pages/components/index.ts`) does; `ComponentTemplateSchema` and
 * `ComponentChildElementSchema` are still annotated `Schema.Schema<any, …>` and
 * would each add their own children shape the same way.
 */
export type ComponentUnion = {
  readonly [I in keyof typeof allComponents]: ComponentBranchType<(typeof allComponents)[I]>
}[number]

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
  childrenField: Readonly<InjectableFields>,
  extraFields: InjectableFields = {}
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- huge discriminated union exceeds the .d.ts serialization limit (TS7056); every consumer already widens to Schema.Schema<any, any, never>
): Schema.Codec<any, any, never> {
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

  // Schema.Union requires at least 2 members.
  // v4 takes the members as ONE array — `branches` IS that array, so it is
  // passed directly. Wrapping it (`Union([branches])`) builds a one-member
  // union whose member is an Array rather than a Schema; the `as` cast makes
  // that type-check, and it throws only later inside `SchemaAST.toType`.
  return Schema.Union(branches as [(typeof branches)[0], (typeof branches)[0], ...typeof branches])
}
