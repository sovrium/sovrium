/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * The SVG drawing profile of the canonical sanitiser (`html-sanitization.ts`,
 * rule S2): what `sanitizeSvgDrawing` hands `sanitize-html`, and how it reads the
 * answer. It holds lists and judgements and parses nothing itself, so there is
 * still one sanitiser; it sits beside that module only for the file's length.
 *
 * An allowlist, read in XML mode with names as written: `viewBox` and
 * `linearGradient` stay what they are, and `<SCRIPT>`, `<svg:script>`, `ONLOAD`
 * or `xlink:HREF` are simply names the list does not hold. An element off the
 * list goes with everything under it, because a drawing's metadata and a
 * `<foreignObject>` both hold text the reader must not meet; `sanitize-html`
 * alone would keep it, so the element is kept long enough for `exclusiveFilter`
 * to drop its subtree. Comments, declarations and doctypes never reach the
 * output, and a doctype's entities are never expanded.
 */

import type sanitizeHtml from 'sanitize-html'

const words = (list: string): readonly string[] => list.trim().split(/\s+/)

/** Geometry and paint. Anything else, whatever its spelling, is removed with what it holds. */
const DRAWING_TAGS: ReadonlySet<string> = new Set(
  words(`
    svg g defs path rect circle ellipse line polyline polygon text tspan
    linearGradient radialGradient stop pattern clipPath mask marker filter
    feBlend feColorMatrix feComponentTransfer feComposite feConvolveMatrix feDiffuseLighting
    feDisplacementMap feDistantLight feDropShadow feFlood feFuncA feFuncB feFuncG feFuncR
    feGaussianBlur feMerge feMergeNode feMorphology feOffset fePointLight feSpecularLighting
    feSpotLight feTile feTurbulence
  `)
)

/** The element that goes and leaves its drawing: the link can go and the picture stay. */
const UNWRAPPED_TAG = 'a'

/** The elements whose own text is drawn. Text anywhere else in a drawing shows nothing. */
const DRAWING_TEXT_PARENTS: ReadonlySet<string> = new Set(['text', 'tspan', UNWRAPPED_TAG])

/** What a removed element is renamed to, so the pass reaches its close and drops its subtree. */
const REMOVED_TAG = 'sovrium-removed-node'

/** The presentation properties, on an attribute of that name or in a `style` declaration. */
const DRAWING_PAINT: ReadonlySet<string> = new Set(
  words(`
    clip-path clip-rule color display dominant-baseline fill fill-opacity fill-rule filter
    flood-color flood-opacity font-family font-size font-style font-weight letter-spacing
    lighting-color marker-end marker-mid marker-start mask opacity paint-order shape-rendering
    stop-color stop-opacity stroke stroke-dasharray stroke-dashoffset stroke-linecap
    stroke-linejoin stroke-miterlimit stroke-opacity stroke-width text-anchor vector-effect
    visibility
  `)
)

const DRAWING_ATTRIBUTES: ReadonlySet<string> = new Set([
  ...DRAWING_PAINT,
  ...words(`
    id style viewBox preserveAspectRatio width height x y x1 x2 y1 y2 cx cy r rx ry fx fy fr d
    points pathLength transform dx dy rotate textLength lengthAdjust offset gradientUnits
    gradientTransform spreadMethod patternUnits patternContentUnits patternTransform
    clipPathUnits maskUnits maskContentUnits markerWidth markerHeight markerUnits orient refX
    refY filterUnits primitiveUnits in in2 result stdDeviation type values mode operator k1 k2
    k3 k4 tableValues slope intercept amplitude exponent order kernelMatrix divisor bias
    targetX targetY edgeMode preserveAlpha surfaceScale diffuseConstant specularConstant
    specularExponent kernelUnitLength scale xChannelSelector yChannelSelector radius
    baseFrequency numOctaves seed stitchTiles azimuth elevation z pointsAtX pointsAtY pointsAtZ
    limitingConeAngle
  `),
])

/** The only CSS functions a value may call: none of them loads anything. */
const DRAWING_FUNCTIONS: ReadonlySet<string> = new Set(
  words(`
    var calc min max clamp rgb rgba hsl hsla hwb lab lch oklab oklch color color-mix light-dark
    translate translatex translatey rotate scale scalex scaley skewx skewy matrix blur
    brightness contrast drop-shadow grayscale hue-rotate invert opacity saturate sepia
  `)
)

/** `url(#id)`, the one address a drawing keeps: it names something in the drawing itself. */
const FRAGMENT_URL = /url\(\s*(['"]?)#([\w.:-]+)\1\s*\)/gi

/**
 * A value with its `url(#id)` prefixed, or `undefined` when it could load
 * something: a backslash (a CSS escape can spell `url(`), a comment, or any call
 * but the listed functions, which takes in `url()` to anywhere else and
 * `image-set()` alike. Matched after the parser decoded entities.
 */
const drawingValue = (value: string, idPrefix: string): string | undefined => {
  if (value.includes('\\') || value.includes('/*')) return undefined
  const calls = value.replace(FRAGMENT_URL, '').match(/[^\s(),;:]*\(/g) ?? []
  return calls.every((call) => DRAWING_FUNCTIONS.has(call.slice(0, -1).toLowerCase()))
    ? value.replace(FRAGMENT_URL, (_match, _quote, id: string) => `url(#${idPrefix}${id})`)
    : undefined
}

/** A `style` attribute reduced to its paint: each declaration is judged alone. */
const drawingStyle = (style: string, idPrefix: string): string =>
  style
    .split(';')
    .flatMap((declaration) => {
      const colon = declaration.indexOf(':')
      const property = declaration.slice(0, Math.max(colon, 0)).trim().toLowerCase()
      const value = drawingValue(declaration.slice(colon + 1).trim(), idPrefix)
      if (!DRAWING_PAINT.has(property) || value === undefined || value === '') return []
      return property !== 'font-family' && /["']/.test(value) ? [] : [`${property}: ${value}`]
    })
    .join('; ')

/** One attribute of a kept element, as a drawing keeps it, or `undefined` when it goes. */
const drawingAttribute = (name: string, value: string, idPrefix: string): string | undefined => {
  if (!DRAWING_ATTRIBUTES.has(name)) return undefined
  if (name === 'id') return `${idPrefix}${value}`
  if (name === 'style') return drawingStyle(value, idPrefix)
  return drawingValue(value, idPrefix)
}

const drawingAttributes = (
  attributes: Readonly<Record<string, string>>,
  idPrefix: string
): Readonly<Record<string, string>> =>
  Object.fromEntries(
    Object.entries(attributes).flatMap(([name, value]) => {
      const kept = drawingAttribute(name, value, idPrefix)
      return kept === undefined || kept === '' ? [] : [[name, kept]]
    })
  )

/** Whether sanitised markup is one element from its first character to its last. */
const isOneDrawing = (html: string): boolean => {
  const { depth: _depth, rootEnds } = [...html.matchAll(/<(\/?)svg\b/g)].reduce<{
    readonly depth: number
    readonly rootEnds: number
  }>(
    (state, match) => {
      const depth = state.depth + (match[1] === '/' ? -1 : 1)
      return { depth, rootEnds: depth === 0 ? state.rootEnds + 1 : state.rootEnds }
    },
    { depth: 0, rootEnds: 0 }
  )
  return (
    html.startsWith('<svg') &&
    html.endsWith('</svg>') &&
    rootEnds === 1 &&
    !html.includes(REMOVED_TAG)
  )
}

/** One drawing: the attributes of its root, and the markup inside it. */
export interface SvgDrawing {
  readonly attributes: Readonly<Record<string, string>>
  readonly markup: string
}

/** The first element a parse opened. */
interface DrawingRoot {
  readonly tag: string
  readonly attributes: Readonly<Record<string, string>>
}

/**
 * The options of one parse, and what it saw of the root once it has run: the
 * options are mutable by the library's design and observe this one parse, so each
 * parse takes its own.
 */
export const svgDrawingProfile = (
  idPrefix: string
): { readonly options: sanitizeHtml.IOptions; readonly root: () => DrawingRoot | undefined } => {
  // eslint-disable-next-line functional/prefer-immutable-types -- an observation of this one parse, written once by the transform below
  const opened: { root?: DrawingRoot } = {}
  return {
    root: () => opened.root,
    options: {
      allowedTags: [...DRAWING_TAGS, REMOVED_TAG],
      allowedAttributes: { '*': [...DRAWING_ATTRIBUTES] },
      selfClosing: [],
      nonTextTags: [],
      parseStyleAttributes: false,
      parser: {
        xmlMode: true,
        lowerCaseTags: false,
        lowerCaseAttributeNames: false,
        decodeEntities: true,
      },
      transformTags: {
        '*': (tagName, attribs) => {
          const attributes = DRAWING_TAGS.has(tagName) ? drawingAttributes(attribs, idPrefix) : {}
          if (opened.root === undefined) {
            // eslint-disable-next-line functional/immutable-data, functional/no-expression-statements -- an observation of this one parse, local to the call
            Object.assign(opened, { root: { tag: tagName, attributes } })
          }
          const removed = !DRAWING_TAGS.has(tagName) && tagName !== UNWRAPPED_TAG
          return { tagName: removed ? REMOVED_TAG : tagName, attribs: { ...attributes } }
        },
      },
      textFilter: (text, tagName) => (DRAWING_TEXT_PARENTS.has(tagName) ? text : ''),
      exclusiveFilter: (frame) => !DRAWING_TAGS.has(frame.tag),
    },
  }
}

/** The drawing a parse produced, or `undefined` when the file's root is not one `<svg>`. */
export const readSvgDrawing = (
  html: string,
  root: DrawingRoot | undefined
): SvgDrawing | undefined =>
  root?.tag === 'svg' && isOneDrawing(html)
    ? {
        attributes: root.attributes,
        markup: html.slice(html.indexOf('>') + 1, -'</svg>'.length),
      }
    : undefined
