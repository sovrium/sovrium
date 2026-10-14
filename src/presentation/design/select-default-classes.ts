/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Adapted from shadcn/ui select, combobox, input-group and native-select (https://ui.shadcn.com), registry commit 30a58d4498f270af1c1e981a7d78a15cf5740841.
 * Copyright (c) 2023 shadcn. MIT License: licenses/MIT-shadcn-ui.txt
 */

/**
 * Prestyled-by-default class computer for the `select`, `combobox` and
 * `native-select` components, drawn on shadcn/ui's anatomy (base-nova): the
 * `Select`, `Combobox` and `NativeSelect` class recipes, verbatim.
 *
 * Base UI exposes interactive state as data attributes (open, highlighted,
 * selected, disabled, placeholder), so one class list per part covers every
 * state its primitive can enter.
 *
 * Two departures, both because the schema has no key for what shadcn composes:
 * - an ungrouped option list carries the group's own padding (`SelectGroup`'s),
 *   since shadcn's popup draws its items inside a group;
 * - the visible caption above a control is shadcn's `Label`, since Base UI's
 *   `Select.Label` and `Combobox.Label` name the control the way `FieldLabel`
 *   would.
 *
 * The part names an author restyles through `design.components.select.parts`
 * are unchanged: `label`, `trigger`, `icon`, `list`.
 */

/** shadcn/ui `SelectTrigger`, default size. */
export const computeSelectTriggerClasses = (): string =>
  "flex w-fit items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-sm whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 data-disabled:cursor-not-allowed data-disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-placeholder:text-muted-foreground data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 dark:bg-input/30 dark:hover:bg-input/50 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"

/** shadcn/ui `SelectValue`. */
export const computeSelectValueClasses = (): string => 'flex flex-1 text-left'

/** shadcn/ui `SelectContent`'s positioner. */
export const computeSelectPositionerClasses = (): string => 'isolate z-50'

/** shadcn/ui `SelectContent`: the popup surface and its open/close motion. */
export const computeSelectPopupClasses = (): string =>
  'relative isolate z-50 max-h-(--available-height) w-(--anchor-width) min-w-36 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-[align-trigger=true]:animate-none data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95'

/** The option list inside the popup: shadcn/ui `SelectGroup`'s padding (see above). */
export const computeSelectListClasses = (): string => 'scroll-my-1 p-1'

/** shadcn/ui `SelectItem`. */
export const computeSelectItemClasses = (): string =>
  "relative flex w-full cursor-default items-center gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground data-highlighted:bg-accent data-highlighted:text-accent-foreground not-data-[variant=destructive]:focus:**:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2"

/** shadcn/ui `SelectItem`'s text. */
export const computeSelectItemTextClasses = (): string =>
  'flex flex-1 shrink-0 gap-2 whitespace-nowrap'

/** shadcn/ui `SelectItem`'s check, pinned to the row's end. */
export const computeSelectItemIndicatorClasses = (): string =>
  'pointer-events-none absolute right-2 flex size-4 items-center justify-center'

/** shadcn/ui `SelectScrollUpButton` / `SelectScrollDownButton`. */
export const computeSelectScrollArrowClasses = (edge: 'top' | 'bottom'): string =>
  `${edge === 'top' ? 'top-0' : 'bottom-0'} z-10 flex w-full cursor-default items-center justify-center bg-popover py-1 [&_svg:not([class*='size-'])]:size-4`

/** The trigger's chevron, shadcn/ui's `Select.Icon` glyph. */
export const computeSelectIconClasses = (): string =>
  'pointer-events-none size-4 text-muted-foreground'

/** shadcn/ui `Label`, as the caption above a select or a combobox. */
export const computeSelectLabelClasses = (): string =>
  'mb-2 flex w-fit items-center gap-2 text-sm leading-snug font-medium select-none'

/** shadcn/ui `InputGroup`, the box a combobox's input and trigger share (`w-auto` as `ComboboxInput` sets it). */
export const computeComboboxInputGroupClasses = (): string =>
  'group/input-group relative flex h-8 w-auto min-w-0 items-center rounded-lg border border-input transition-colors outline-none in-data-[slot=combobox-content]:focus-within:border-inherit in-data-[slot=combobox-content]:focus-within:ring-0 has-disabled:bg-input/50 has-disabled:opacity-50 has-[[data-slot=input-group-control]:focus-visible]:border-ring has-[[data-slot=input-group-control]:focus-visible]:ring-3 has-[[data-slot=input-group-control]:focus-visible]:ring-ring/50 has-[[data-slot][aria-invalid=true]]:border-destructive has-[[data-slot][aria-invalid=true]]:ring-3 has-[[data-slot][aria-invalid=true]]:ring-destructive/20 dark:bg-input/30 dark:has-disabled:bg-input/80 dark:has-[[data-slot][aria-invalid=true]]:ring-destructive/40 has-[>[data-align=inline-end]]:[&>input]:pr-1.5'

/** shadcn/ui `InputGroupInput`: the `Input` recipe with its own border and ring taken off. */
export const computeComboboxInputClasses = (): string =>
  'h-8 w-full min-w-0 flex-1 rounded-none border-0 bg-transparent px-2.5 py-1 text-base shadow-none ring-0 transition-colors outline-none placeholder:text-muted-foreground focus-visible:ring-0 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-transparent aria-invalid:ring-0 md:text-sm dark:bg-transparent dark:disabled:bg-transparent'

/** shadcn/ui `InputGroupAddon`, inline-end: where the combobox trigger sits. */
export const computeComboboxAddonClasses = (): string =>
  "flex h-auto cursor-text items-center justify-center gap-2 py-1.5 text-sm font-medium text-muted-foreground select-none group-data-[disabled=true]/input-group:opacity-50 [&>kbd]:rounded-[calc(var(--radius)-5px)] [&>svg:not([class*='size-'])]:size-4 order-last pr-2 has-[>button]:mr-[-0.3rem] has-[>kbd]:mr-[-0.15rem]"

/** shadcn/ui `ComboboxTrigger` rendered as an `InputGroupButton` (ghost, `icon-xs`). */
export const computeComboboxTriggerClasses = (): string =>
  "group/button inline-flex size-6 shrink-0 items-center justify-center gap-2 rounded-[calc(var(--radius)-3px)] border border-transparent bg-clip-padding p-0 text-sm font-medium whitespace-nowrap shadow-none transition-all outline-none select-none hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-expanded:bg-muted aria-expanded:text-foreground data-pressed:bg-transparent dark:hover:bg-muted/50 has-[>svg]:p-0 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"

/** shadcn/ui `ComboboxContent`. */
export const computeComboboxPopupClasses = (): string =>
  'group/combobox-content relative max-h-(--available-height) w-(--anchor-width) max-w-(--available-width) min-w-[calc(var(--anchor-width)+--spacing(7))] origin-(--transform-origin) overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95'

/** shadcn/ui `ComboboxList`. */
export const computeComboboxListClasses = (): string =>
  'no-scrollbar max-h-[min(calc(--spacing(72)---spacing(9)),calc(var(--available-height)---spacing(9)))] scroll-py-1 overflow-y-auto overscroll-contain p-1 data-empty:p-0'

/** shadcn/ui `ComboboxItem`. */
export const computeComboboxItemClasses = (): string =>
  "relative flex w-full cursor-default items-center gap-2 rounded-md py-1 pr-8 pl-1.5 text-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground not-data-[variant=destructive]:data-highlighted:**:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"

/** shadcn/ui `ComboboxEmpty`: shown only while the list has no match. */
export const computeComboboxEmptyClasses = (): string =>
  'hidden w-full justify-center py-2 text-center text-sm text-muted-foreground group-data-empty/combobox-content:flex'

/** shadcn/ui `NativeSelect` wrapper (default size). */
export const computeNativeSelectWrapperClasses = (): string =>
  'group/native-select relative w-fit has-[select:disabled]:opacity-50'

/** shadcn/ui `NativeSelect`'s `<select>`. */
export const computeNativeSelectClasses = (): string =>
  'h-8 w-full min-w-0 appearance-none rounded-lg border border-input bg-transparent py-1 pr-8 pl-2.5 text-sm transition-colors outline-none select-none selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] data-[size=sm]:py-0.5 dark:bg-input/30 dark:hover:bg-input/50 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40'

/** shadcn/ui `NativeSelect`'s chevron. */
export const computeNativeSelectIconClasses = (): string =>
  'pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground select-none'

/** shadcn/ui `NativeSelectOption`. */
export const computeNativeSelectOptionClasses = (): string => 'bg-[Canvas] text-[CanvasText]'

/** shadcn/ui `SelectLabel`: the muted heading of a `SelectGroup`, which is no option. */
export const computeSelectGroupLabelClasses = (): string =>
  'px-1.5 py-1 text-xs text-muted-foreground'

/** The clear control of a `clearable` select, drawn over the trigger's end before its chevron. */
export const computeSelectClearClasses = (): string =>
  'absolute top-1/2 right-8 inline-flex size-5 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 [&_svg]:size-3.5'

/** shadcn/ui `ComboboxChips`: the field holding the chosen chips and the text input. */
export const computeComboboxChipsClasses = (): string =>
  'flex min-h-8 flex-wrap items-center gap-1 rounded-lg border border-input bg-transparent bg-clip-padding px-2.5 py-1 text-sm transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 has-aria-invalid:border-destructive has-aria-invalid:ring-3 has-aria-invalid:ring-destructive/20 has-data-[slot=combobox-chip]:px-1 dark:bg-input/30 dark:has-aria-invalid:border-destructive/50 dark:has-aria-invalid:ring-destructive/40'

/** shadcn/ui `ComboboxChip`: one chosen value. */
export const computeComboboxChipClasses = (): string =>
  'flex h-[calc(--spacing(5.25))] w-fit items-center justify-center gap-1 rounded-sm bg-muted px-1.5 text-xs font-medium whitespace-nowrap text-foreground has-disabled:pointer-events-none has-disabled:cursor-not-allowed has-disabled:opacity-50 has-data-[slot=combobox-chip-remove]:pr-0'

/** shadcn/ui `ComboboxChip` remove control: a ghost `icon-xs` button. */
export const computeComboboxChipRemoveClasses = (): string =>
  '-ml-1 inline-flex size-6 items-center justify-center rounded-sm opacity-50 outline-none hover:bg-muted hover:opacity-100 focus-visible:ring-[3px] focus-visible:ring-ring/50'

/** shadcn/ui `ComboboxChipsInput`. */
export const computeComboboxChipInputClasses = (): string =>
  'min-w-16 flex-1 bg-transparent outline-none'
