/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * Adapted from shadcn/ui carousel (https://ui.shadcn.com), registry commit 3464245c4513.
 * Copyright (c) 2023 shadcn. MIT License: licenses/MIT-shadcn-ui.txt
 */

/**
 * The carousel shadcn's `carousel` is: Embla's track ([internal ref] D3) with
 * previous / next controls and the arrow keys.
 *
 * Three departures from the upstream file, each a rule the track already kept:
 *
 *  - The track is a LIST (`ul` / `li`), not a run of `group`s: the cards are a
 *    collection, and a list tells a screen reader how many there are and where
 *    in them the reader is.
 *  - The two controls sit in a strip of their own under the track rather than
 *    over its first and last slide, so they never cover the content they page.
 *  - No `Button`, no `cn`: the controls carry base-nova's outline icon-button
 *    classes directly, and class lists are joined.
 *
 * Every slide is rendered, whatever is in view: a track that drew only the
 * visible slide would cut a bound list without telling the reader.
 */

import useEmblaCarousel from 'embla-carousel-react'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ComponentProps,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
} from 'react'

type CarouselApi = ReturnType<typeof useEmblaCarousel>[1]

interface CarouselContextValue {
  readonly carouselRef: ReturnType<typeof useEmblaCarousel>[0]
  readonly scrollPrev: () => void
  readonly scrollNext: () => void
  readonly canScrollPrev: boolean
  readonly canScrollNext: boolean
}

const CarouselContext = createContext<CarouselContextValue | undefined>(undefined)

function useCarousel(): CarouselContextValue {
  const context = useContext(CarouselContext)
  if (context === undefined) throw new Error('useCarousel must be used within a <Carousel />')
  return context
}

const join = (...classes: ReadonlyArray<string | false | undefined>): string =>
  classes.filter(Boolean).join(' ')

/** Whether the track can move either way, read from Embla on every change. */
function useScrollState(api: CarouselApi): readonly [boolean, boolean] {
  const [state, setState] = useState<readonly [boolean, boolean]>([false, false])
  useEffect(() => {
    if (!api) return undefined
    const read = (): void => setState([api.canScrollPrev(), api.canScrollNext()])
    read()
    api.on('reInit', read)
    api.on('select', read)
    return () => {
      api.off('reInit', read)
      api.off('select', read)
    }
  }, [api])
  return state
}

/** The carousel: Embla's track, its controls, and ArrowLeft / ArrowRight. */
export function Carousel({ className, children, ...props }: ComponentProps<'div'>): ReactElement {
  const [carouselRef, api] = useEmblaCarousel({ align: 'start' })
  const [canScrollPrev, canScrollNext] = useScrollState(api)
  const scrollPrev = useCallback(() => api?.scrollPrev(), [api])
  const scrollNext = useCallback(() => api?.scrollNext(), [api])
  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        scrollPrev()
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        scrollNext()
      }
    },
    [scrollPrev, scrollNext]
  )
  const value = useMemo(
    () => ({ carouselRef, scrollPrev, scrollNext, canScrollPrev, canScrollNext }),
    [carouselRef, scrollPrev, scrollNext, canScrollPrev, canScrollNext]
  )
  return (
    <CarouselContext.Provider value={value}>
      <div
        onKeyDownCapture={onKeyDown}
        className={join('relative', className)}
        role="region"
        aria-roledescription="carousel"
        data-slot="carousel"
        {...props}
      >
        {children}
      </div>
    </CarouselContext.Provider>
  )
}

/** The viewport and the list of slides it moves. */
export function CarouselContent({ className, ...props }: ComponentProps<'ul'>): ReactElement {
  const { carouselRef } = useCarousel()
  return (
    <div
      ref={carouselRef}
      className="overflow-hidden"
      data-slot="carousel-content"
    >
      <ul
        className={join('m-0 -ml-4 flex list-none p-0', className)}
        {...props}
      />
    </div>
  )
}

/** One slide. */
export function CarouselItem({ className, ...props }: ComponentProps<'li'>): ReactElement {
  return (
    <li
      aria-roledescription="slide"
      data-slot="carousel-item"
      className={join('min-w-0 shrink-0 grow-0 basis-full pl-4', className)}
      {...props}
    />
  )
}

const CONTROL = [
  'inline-flex size-7 shrink-0 touch-manipulation items-center justify-center rounded-full border',
  'border-border bg-background text-sm transition-all outline-none select-none',
  'hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-3',
  'focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50',
  'dark:border-input dark:bg-input/30 dark:hover:bg-input/50',
].join(' ')

function Chevron({ path }: { readonly path: string }): ReactElement {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="size-4"
    >
      <path d={path} />
    </svg>
  )
}

/** One step back. */
export function CarouselPrevious({
  label = 'Previous',
}: {
  readonly label?: string
}): ReactElement {
  const { scrollPrev, canScrollPrev } = useCarousel()
  return (
    <button
      type="button"
      data-slot="carousel-previous"
      aria-label={label}
      disabled={!canScrollPrev}
      onClick={scrollPrev}
      className={CONTROL}
    >
      <Chevron path="m15 18-6-6 6-6" />
    </button>
  )
}

/** One step forward. */
export function CarouselNext({ label = 'Next' }: { readonly label?: string }): ReactElement {
  const { scrollNext, canScrollNext } = useCarousel()
  return (
    <button
      type="button"
      data-slot="carousel-next"
      aria-label={label}
      disabled={!canScrollNext}
      onClick={scrollNext}
      className={CONTROL}
    >
      <Chevron path="m9 18 6-6-6-6" />
    </button>
  )
}

/**
 * A whole track from a list of slides, the shape a lazily-loaded consumer can
 * mount in one piece: the slides, then the controls in a strip under them.
 */
export default function CarouselTrack({
  slides,
  slideClassName,
}: {
  readonly slides: ReadonlyArray<{ readonly key: string; readonly node: ReactNode }>
  readonly slideClassName?: string
}): ReactElement {
  return (
    <Carousel className="w-full">
      <CarouselContent>
        {slides.map((slide) => (
          <CarouselItem
            key={slide.key}
            className={slideClassName}
          >
            {slide.node}
          </CarouselItem>
        ))}
      </CarouselContent>
      <div
        data-slot="carousel-controls"
        className="flex justify-end gap-2 pt-2"
      >
        <CarouselPrevious />
        <CarouselNext />
      </div>
    </Carousel>
  )
}
