/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Adapted from shadcn/ui chart (https://ui.shadcn.com), registry commit c257f688cf4d.
 * Copyright (c) 2023 shadcn. MIT License: licenses/MIT-shadcn-ui.txt
 */

/**
 * The chart primitives every chart draws through: shadcn's `chart` anatomy
 * over recharts ([internal ref] D3). A chart names its series in a {@link ChartConfig},
 * {@link ChartContainer} sizes the plot and scopes one `--color-<key>` variable
 * per entry, and the marks paint `var(--color-<key>)`, so a colour is declared
 * once and every mark, the legend and the tooltip read it.
 *
 * Three departures from the upstream file, each forced by a contract the chart
 * already had:
 *
 *  - The `--color-<key>` variables are set on the container's `style` rather
 *    than written into a `<style>` element. An entry's colour can come from the
 *    app config (`series[].color`, an option's colour), and a declaration set
 *    through `style` cannot be closed early by the value it carries; a
 *    stylesheet string can. Upstream's light/dark `theme` entries need the
 *    stylesheet form and are not carried yet.
 *  - {@link ChartLegendContent} renders outside recharts, beside the container
 *    rather than inside it, because `legend.position` places the legend on a
 *    side of the plot and the container is the plot. It keeps the series
 *    toggle the chart has always had.
 *  - {@link ChartTooltipContent} writes the author's `tooltip.format` line when
 *    one is declared, and marks itself `data-chart-tooltip` with `role="tooltip"`.
 */

import { useId, useMemo } from 'react'
import { ResponsiveContainer, Tooltip } from 'recharts'
import {
  computeChartLegendChipClasses,
  computeChartLegendChipSwatchClasses,
  computeChartLegendClasses,
} from '@/presentation/design/chart-default-classes'
import { cn } from '@/presentation/design/class-merge'
import { LucideGlyph } from '@/presentation/design/lucide-glyph'
import type { ComponentProps, CSSProperties, ReactElement, ReactNode } from 'react'
import type { TooltipContentProps, TooltipPayloadEntry } from 'recharts'

/** One series or category of a chart: the name it is shown under and its paint. */
export type ChartConfig = Readonly<
  Record<string, { readonly label?: string; readonly color?: string }>
>

/** The size the container draws at before it has measured itself. */
const INITIAL_DIMENSION = { width: 320, height: 200 } as const

const CHART_CONTAINER_CLASSES = [
  'flex justify-center text-xs',
  '[&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground',
  "[&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50",
  '[&_.recharts-curve.recharts-tooltip-cursor]:stroke-border',
  "[&_.recharts-dot[stroke='#fff']]:stroke-transparent",
  '[&_.recharts-layer]:outline-hidden',
  "[&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border",
  '[&_.recharts-radial-bar-background-sector]:fill-muted',
  '[&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted',
  "[&_.recharts-reference-line_[stroke='#ccc']]:stroke-border",
  '[&_.recharts-sector]:outline-hidden',
  "[&_.recharts-sector[stroke='#fff']]:stroke-transparent",
  '[&_.recharts-surface]:outline-hidden',
].join(' ')

/** One `--color-<key>` declaration per config entry that names a colour. */
function chartStyle(config: ChartConfig): CSSProperties {
  return Object.fromEntries(
    Object.entries(config).flatMap(([key, entry]) =>
      entry.color === undefined ? [] : [[`--color-${key}`, entry.color]]
    )
  ) as CSSProperties
}

/**
 * The plot: sizes itself from its classes, scopes the config's colours, and
 * hands recharts its measured width and height.
 */
export function ChartContainer({
  config,
  className,
  children,
  ...props
}: Omit<ComponentProps<'div'>, 'children' | 'style'> & {
  readonly config: ChartConfig
  readonly children: ReactNode
}): ReactElement {
  const chartId = `chart-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const style = useMemo(() => chartStyle(config), [config])
  return (
    <div
      data-slot="chart"
      data-chart={chartId}
      className={cn(CHART_CONTAINER_CLASSES, className)}
      style={style}
      {...props}
    >
      <ResponsiveContainer initialDimension={INITIAL_DIMENSION}>{children}</ResponsiveContainer>
    </div>
  )
}

export const ChartTooltip = Tooltip

/**
 * One callout row: the author's `tooltip.format` line as written, or shadcn's
 * anatomy — the entry's name, and its value at the far end.
 */
export type ChartTooltipRow =
  { readonly text: string } | { readonly name: string; readonly value: string }

/** The row one payload entry draws, or nothing to skip it. */
export type ChartTooltipLine = (
  entry: TooltipPayloadEntry,
  label: string
) => ChartTooltipRow | undefined

/** The mark beside each value: shadcn/ui's three tooltip indicators. */
export type ChartTooltipIndicator = 'dot' | 'line' | 'dashed'

const INDICATOR_CLASSES: Readonly<Record<ChartTooltipIndicator, string>> = {
  dot: 'size-2.5 shrink-0 rounded-[2px] bg-(--color-bg)',
  line: 'w-1 shrink-0 rounded-[2px] bg-(--color-bg)',
  dashed: 'w-0 shrink-0 border-[1.5px] border-dashed border-(--color-border) bg-transparent',
}

function TooltipRowContent({ row }: { readonly row: ChartTooltipRow }): ReactElement {
  if ('text' in row) return <span className="text-foreground">{row.text}</span>
  return (
    <div className="flex flex-1 items-center justify-between gap-4 leading-none">
      <span className="text-muted-foreground">{row.name}</span>
      <span className="text-foreground font-mono font-medium tabular-nums">{row.value}</span>
    </div>
  )
}

/**
 * The hover callout: an optional heading, then one row per hovered entry, each
 * beside its colour's indicator unless `hideIndicator`.
 */
export function ChartTooltipContent({
  active,
  payload,
  label,
  line,
  heading,
  indicator = 'dot',
  hideIndicator = false,
}: Partial<TooltipContentProps<number, string>> & {
  readonly line: ChartTooltipLine
  /** The callout heading for the hovered payload; nothing draws none. */
  readonly heading?: (payload: readonly TooltipPayloadEntry[]) => string | undefined
  readonly indicator?: ChartTooltipIndicator
  readonly hideIndicator?: boolean
}): ReactElement | undefined {
  if (active !== true || payload === undefined || payload.length === 0) return undefined
  const rows = payload.flatMap((entry, index) => {
    const row = line(entry, String(label ?? ''))
    return row === undefined
      ? []
      : [{ id: `${String(entry.dataKey)}-${String(index)}`, row, entry }]
  })
  if (rows.length === 0) return undefined
  const title = heading?.(payload)
  return (
    <div
      data-slot="chart-tooltip"
      data-chart-tooltip="true"
      role="tooltip"
      className="border-border/50 bg-background grid min-w-32 items-start gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl"
    >
      {title === undefined ? undefined : <div className="font-medium">{title}</div>}
      {rows.map(({ id, row, entry }) => (
        <div
          key={id}
          className={cn(
            'flex w-full gap-2',
            indicator === 'dot' ? 'items-center' : 'items-stretch'
          )}
        >
          {hideIndicator ? undefined : (
            <span
              aria-hidden="true"
              data-indicator={indicator}
              className={INDICATOR_CLASSES[indicator]}
              style={{ '--color-bg': entry.color, '--color-border': entry.color } as CSSProperties}
            />
          )}
          <TooltipRowContent row={row} />
        </div>
      ))}
    </div>
  )
}

/** One legend entry: what it is called, its paint, and whether its series is hidden. */
export interface ChartLegendEntry {
  readonly id: string
  readonly label: string
  readonly color: string
  readonly hidden?: boolean
  /** A Lucide icon's server-resolved geometry, drawn instead of the swatch. */
  readonly iconNode?: unknown
}

const CHIP_CLASSES = computeChartLegendChipClasses()
const CHIP_HIDDEN_CLASSES = computeChartLegendChipClasses({ hidden: true })
const SWATCH_CLASSES = computeChartLegendChipSwatchClasses()
const LEGEND_CLASSES = computeChartLegendClasses()
const LEGEND_COLUMN_CLASSES = computeChartLegendClasses({ column: true })

function LegendSwatch({
  id,
  color,
  iconNode,
}: {
  readonly id: string
  readonly color: string
  readonly iconNode?: unknown
}): ReactElement {
  if (iconNode !== undefined)
    return (
      <LucideGlyph
        iconNode={iconNode}
        className="size-3 shrink-0"
        aria-hidden="true"
      />
    )
  return (
    <span
      className={SWATCH_CLASSES}
      data-legend-swatch={id}
      // eslint-disable-next-line react-perf/jsx-no-new-object-as-prop -- per-entry swatch colour is dynamic; React Compiler not yet enabled in Bun
      style={{ backgroundColor: color }}
      aria-hidden="true"
    />
  )
}

function ToggleItem({
  entry,
  onToggle,
}: {
  readonly entry: ChartLegendEntry
  readonly onToggle: (id: string) => void
}): ReactElement {
  const hidden = entry.hidden === true
  const handleClick = useMemo(() => () => onToggle(entry.id), [onToggle, entry.id])
  return (
    <li className="chart-series-item">
      <button
        type="button"
        className={hidden ? CHIP_HIDDEN_CLASSES : CHIP_CLASSES}
        data-legend-field={entry.id}
        aria-pressed={!hidden}
        onClick={handleClick}
      >
        <LegendSwatch
          id={entry.id}
          color={entry.color}
          iconNode={entry.iconNode}
        />
        <span>{entry.label}</span>
      </button>
    </li>
  )
}

/**
 * The legend: one button per series toggling it when `onToggle` is given,
 * else one plain entry per slice.
 */
export function ChartLegendContent({
  entries,
  onToggle,
  column = false,
}: {
  readonly entries: readonly ChartLegendEntry[]
  readonly onToggle?: (id: string) => void
  readonly column?: boolean
}): ReactElement {
  return (
    <ul
      className={`chart-legend ${column ? LEGEND_COLUMN_CLASSES : LEGEND_CLASSES}`}
      data-slot="chart-legend"
      data-chart-legend="true"
    >
      {entries.map((entry) =>
        onToggle === undefined ? (
          <li
            key={`legend-${entry.id}`}
            className={`chart-series-item ${CHIP_CLASSES}`}
          >
            <LegendSwatch
              id={entry.id}
              color={entry.color}
              iconNode={entry.iconNode}
            />
            <span>{entry.label}</span>
          </li>
        ) : (
          <ToggleItem
            key={`legend-${entry.id}`}
            entry={entry}
            onToggle={onToggle}
          />
        )
      )}
    </ul>
  )
}
