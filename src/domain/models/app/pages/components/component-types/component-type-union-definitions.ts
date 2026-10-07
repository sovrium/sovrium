/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Every component type the engine declares, as `[TypeLiteral, fields]` tuples,
 * and the type enum rebuilt from their literals.
 *
 * The definitions live apart from the union builder in `component-type-union.ts`
 * so that each file stays inside its size ceiling; that file re-exports the
 * public names, so nothing imports this one directly but it.
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
  QrCodeTypeLiteral,
  qrCodeFields,
  CodeElementTypeLiteral,
  codeElementFields,
  TocTypeLiteral,
  tocFields,
  SearchInputTypeLiteral,
  searchInputFields,
  KbdTypeLiteral,
  kbdFields,
  FilePreviewTypeLiteral,
  filePreviewFields,
} from './content'
import { CustomHtmlTypeLiteral, customHtmlFields } from './custom'
import {
  TableTypeLiteral,
  tableFields,
  KanbanTypeLiteral,
  kanbanFields,
  MatrixTypeLiteral,
  matrixFields,
  GraphTypeLiteral,
  graphFields,
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
  FilterBarTypeLiteral,
  filterBarFields,
  MapTypeLiteral,
  mapFields,
  TreeTypeLiteral,
  treeFields,
} from './data'
import {
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
  RecordFieldTypeLiteral,
  recordFieldFields,
  SwatchTypeLiteral,
  swatchFields,
  AvatarTypeLiteral,
  avatarFields,
  DescriptionListTypeLiteral,
  descriptionListFields,
  StepperTypeLiteral,
  stepperFields,
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
  RecordPickerTypeLiteral,
  recordPickerFields,
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
  InputGroupTypeLiteral,
  inputGroupFields,
  DateRangePickerTypeLiteral,
  dateRangePickerFields,
  RichTextEditorTypeLiteral,
  richTextEditorFields,
  CodeEditorTypeLiteral,
  codeEditorFields,
  RatingTypeLiteral,
  ratingFields,
  SignaturePadTypeLiteral,
  signaturePadFields,
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
  SidebarTypeLiteral,
  sidebarFields,
  CardTypeLiteral,
  cardFields,
} from './layout'
import {
  BreadcrumbTypeLiteral,
  breadcrumbFields,
  CommandPaletteTypeLiteral,
  commandPaletteFields,
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
  SpecimenTypeLiteral,
  specimenFields,
  FieldSpecimenTypeLiteral,
  fieldSpecimenFields,
  PreviewTypeLiteral,
  previewFields,
} from './specialty'
import { DividerTypeLiteral, dividerFields, SpacerTypeLiteral, spacerFields } from './structural'

// ─── All component definitions as [TypeLiteral, fields] tuples ─────────────

// Layout and content.
const layoutAndContentComponents = [
  // Layout
  [ContainerTypeLiteral, containerFields],
  [SplitPaneTypeLiteral, splitPaneFields],
  [FlexTypeLiteral, flexFields],
  [GridTypeLiteral, gridFields],
  [SidebarTypeLiteral, sidebarFields],
  [CardTypeLiteral, cardFields],
  // Content
  [TextTypeLiteral, textFields],
  [IconTypeLiteral, iconFields],
  [ImageTypeLiteral, imageFields],
  [VideoTypeLiteral, videoFields],
  [AudioTypeLiteral, audioFields],
  [IframeTypeLiteral, iframeFields],
  [QrCodeTypeLiteral, qrCodeFields],
  [CodeElementTypeLiteral, codeElementFields],
  [TocTypeLiteral, tocFields],
  [SearchInputTypeLiteral, searchInputFields],
  [KbdTypeLiteral, kbdFields],
  [FilePreviewTypeLiteral, filePreviewFields],
] as const

// Data and form controls.
const dataAndFormComponents = [
  // Data
  [TableTypeLiteral, tableFields],
  [KanbanTypeLiteral, kanbanFields],
  [MatrixTypeLiteral, matrixFields],
  [GraphTypeLiteral, graphFields],
  [CalendarTypeLiteral, calendarFields],
  [ChartTypeLiteral, chartFields],
  [KpiTypeLiteral, kpiFields],
  [GalleryTypeLiteral, galleryFields],
  [FormTypeLiteral, formFields],
  [ListTypeLiteral, listFields],
  [FilterBarTypeLiteral, filterBarFields],
  [MapTypeLiteral, mapFields],
  [TreeTypeLiteral, treeFields],
  // Form Controls
  [InputTypeLiteral, inputFields],
  [CheckboxTypeLiteral, checkboxFields],
  [RadioGroupTypeLiteral, radioGroupFields],
  [RecordPickerTypeLiteral, recordPickerFields],
  [SelectTypeLiteral, selectFields],
  [TextareaTypeLiteral, textareaFields],
  [DatePickerTypeLiteral, datePickerFields],
  [SliderTypeLiteral, sliderFields],
  [FieldTypeLiteral, fieldFields],
  [ToggleTypeLiteral, toggleFields],
  [ToggleGroupTypeLiteral, toggleGroupFields],
  [SwitchTypeLiteral, switchFields],
  [InputGroupTypeLiteral, inputGroupFields],
  [DateRangePickerTypeLiteral, dateRangePickerFields],
  [RichTextEditorTypeLiteral, richTextEditorFields],
  [CodeEditorTypeLiteral, codeEditorFields],
  [RatingTypeLiteral, ratingFields],
  [SignaturePadTypeLiteral, signaturePadFields],
] as const

// Interactive, navigation, overlays and display.
const interactionAndDisplayComponents = [
  // Interactive
  [ButtonTypeLiteral, buttonFields],
  [BadgeTypeLiteral, badgeFields],
  [AlertTypeLiteral, alertFields],
  [LinkTypeLiteral, linkFields],
  [ButtonGroupTypeLiteral, buttonGroupFields],
  [ThemeToggleTypeLiteral, themeToggleFields],
  // Navigation
  [BreadcrumbTypeLiteral, breadcrumbFields],
  [CommandPaletteTypeLiteral, commandPaletteFields],
  [DropdownMenuTypeLiteral, dropdownMenuFields],
  [ContextMenuTypeLiteral, contextMenuFields],
  [MenubarTypeLiteral, menubarFields],
  [NavigationMenuTypeLiteral, navigationMenuFields],
  [PaginationTypeLiteral, paginationFields],
  // Overlays
  [AlertDialogTypeLiteral, alertDialogFields],
  [DialogTypeLiteral, dialogFields],
  [DrawerTypeLiteral, drawerFields],
  [PopoverTypeLiteral, popoverFields],
  [TooltipTypeLiteral, tooltipFields],
  [HoverCardTypeLiteral, hoverCardFields],
  [ToastTypeLiteral, toastFields],
  // Display
  [EmptyStateTypeLiteral, emptyStateFields],
  [MarqueeTypeLiteral, marqueeFields],
  [ScrollAreaTypeLiteral, scrollAreaFields],
  [AccordionTypeLiteral, accordionFields],
  [TabsTypeLiteral, tabsFields],
  [TimelineTypeLiteral, timelineFields],
  [ListItemTypeLiteral, listItemFields],
  [RecordFieldTypeLiteral, recordFieldFields],
  [SwatchTypeLiteral, swatchFields],
  [AvatarTypeLiteral, avatarFields],
  [DescriptionListTypeLiteral, descriptionListFields],
  [StepperTypeLiteral, stepperFields],
] as const

// Feedback, specialty, structural, AI and custom.
const feedbackAndSpecialtyComponents = [
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
  // Design-system specimens — the surfaces that DOCUMENT a design system
  // rather than build a feature. Catalogued like any other specialty type: any
  // app may draw its own kit page from them, so an operator reading the kit
  // index has to be able to find them.
  [SpecimenTypeLiteral, specimenFields],
  [FieldSpecimenTypeLiteral, fieldSpecimenFields],
  // The Configuration half of the same story: `specimen` draws a type, and
  // `preview` draws one of its OPTIONS set to one value.
  [PreviewTypeLiteral, previewFields],
  // Structural
  [DividerTypeLiteral, dividerFields],
  [SpacerTypeLiteral, spacerFields],
  // AI
  [AiChatTypeLiteral, aiChatFields],
  // Custom
  [CustomHtmlTypeLiteral, customHtmlFields],
] as const

/**
 * Every component definition, as `[TypeLiteral, fields]` tuples.
 *
 * Declared in four groups and annotated with their `typeof` rather than left
 * inferred: the inferred tuple of every component is longer than the
 * declaration emitter will serialise (TS7056), while a type written in terms of
 * the four group names stays short and keeps the exact tuple for the types
 * derived from it below.
 */
export const allComponents: readonly [
  ...typeof layoutAndContentComponents,
  ...typeof dataAndFormComponents,
  ...typeof interactionAndDisplayComponents,
  ...typeof feedbackAndSpecialtyComponents,
] = [
  ...layoutAndContentComponents,
  ...dataAndFormComponents,
  ...interactionAndDisplayComponents,
  ...feedbackAndSpecialtyComponents,
]

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
    SidebarTypeLiteral,
    CardTypeLiteral,
    TextTypeLiteral,
    IconTypeLiteral,
    ImageTypeLiteral,
    VideoTypeLiteral,
    AudioTypeLiteral,
    IframeTypeLiteral,
    QrCodeTypeLiteral,
    CodeElementTypeLiteral,
    TocTypeLiteral,
    SearchInputTypeLiteral,
    KbdTypeLiteral,
    FilePreviewTypeLiteral,
    TableTypeLiteral,
    KanbanTypeLiteral,
    MatrixTypeLiteral,
    GraphTypeLiteral,
    CalendarTypeLiteral,
    ChartTypeLiteral,
    KpiTypeLiteral,
    GalleryTypeLiteral,
    FormTypeLiteral,
    ListTypeLiteral,
    FilterBarTypeLiteral,
    MapTypeLiteral,
    TreeTypeLiteral,
    InputTypeLiteral,
    CheckboxTypeLiteral,
    RadioGroupTypeLiteral,
    RecordPickerTypeLiteral,
    SelectTypeLiteral,
    TextareaTypeLiteral,
    DatePickerTypeLiteral,
    SliderTypeLiteral,
    FieldTypeLiteral,
    ToggleTypeLiteral,
    ToggleGroupTypeLiteral,
    SwitchTypeLiteral,
    InputGroupTypeLiteral,
    DateRangePickerTypeLiteral,
    RichTextEditorTypeLiteral,
    CodeEditorTypeLiteral,
    RatingTypeLiteral,
    SignaturePadTypeLiteral,
    ButtonTypeLiteral,
    BadgeTypeLiteral,
    AlertTypeLiteral,
    LinkTypeLiteral,
    ButtonGroupTypeLiteral,
    ThemeToggleTypeLiteral,
    BreadcrumbTypeLiteral,
    CommandPaletteTypeLiteral,
    DropdownMenuTypeLiteral,
    ContextMenuTypeLiteral,
    MenubarTypeLiteral,
    NavigationMenuTypeLiteral,
    PaginationTypeLiteral,
    AlertDialogTypeLiteral,
    DialogTypeLiteral,
    DrawerTypeLiteral,
    PopoverTypeLiteral,
    TooltipTypeLiteral,
    HoverCardTypeLiteral,
    ToastTypeLiteral,
    EmptyStateTypeLiteral,
    MarqueeTypeLiteral,
    ScrollAreaTypeLiteral,
    AccordionTypeLiteral,
    TabsTypeLiteral,
    TimelineTypeLiteral,
    ListItemTypeLiteral,
    RecordFieldTypeLiteral,
    SwatchTypeLiteral,
    AvatarTypeLiteral,
    DescriptionListTypeLiteral,
    StepperTypeLiteral,
    SkeletonTypeLiteral,
    ProgressTypeLiteral,
    SpinnerTypeLiteral,
    FileUploadTypeLiteral,
    NumberInputTypeLiteral,
    TimePickerTypeLiteral,
    ReorderableListTypeLiteral,
    LanguageSwitcherTypeLiteral,
    CommentsTypeLiteral,
    SpecimenTypeLiteral,
    FieldSpecimenTypeLiteral,
    PreviewTypeLiteral,
    DividerTypeLiteral,
    SpacerTypeLiteral,
    AiChatTypeLiteral,
    CustomHtmlTypeLiteral,
  ]
).annotate({
  title: 'Component Type',
  description: 'Component type for page building',
})

/** @public */
export type ComponentType = Schema.Schema.Type<typeof ComponentTypeSchema>
