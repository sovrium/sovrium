/**
 * Copyright (c) 2025-2026 ESSENTIAL SERVICES
 *
 * This source code is licensed under the Business Source License 1.1
 * found in the LICENSE.md file in the root directory of this source tree.
 */

/**
 * A minimal fake of the Figma Plugin API, for the unit tests. No real Figma is
 * available to the test suite, so this models the behaviours the plugin's
 * correctness rests on, each taken from the pinned typings
 *:
 *
 * - `HUG` only on an auto-layout frame or a text, `FILL` and `ABSOLUTE` only
 *   inside an auto-layout parent — anything else THROWS, as the typings' remark
 *   above line 7500 says;
 * - a text's `characters` cannot be set before its font is loaded;
 * - an instance's sublayers are copies of its main component's, with ids
 *   `I<instance>;<main layer>`, and — the worst case, which the plugin must
 *   survive — they carry NO plugin data of their own;
 * - an instance's component properties are named `<name>#<n>`;
 * - binding a variable sets the field to the variable's value.
 *
 * Every write to a node is counted in `mutations`, so a test can prove that
 * the export and the check change nothing.
 */

import type {
  FigmaPort,
  PortBaseNode,
  PortFontName,
  PortSceneNode,
  PortVariable,
} from './figma-port'

type Value = unknown

/** One fake layer. Fields are plain values behind a counting proxy. */
export interface FakeNode {
  id: string
  type: string
  name: string
  locked: boolean
  x: number
  y: number
  width: number
  height: number
  parent: FakeNode | FakePage | undefined
  children: FakeNode[]
  fills: unknown[]
  pluginData: Map<string, string>
  boundVariables: Record<string, { type: 'VARIABLE_ALIAS'; id: string }>
  componentPropertyDefinitions: Record<string, string>
  mainComponent: FakeNode | undefined
  getPluginData(key: string): string
  [field: string]: Value
}

/** The fake's current page. */
export interface FakePage {
  readonly type: 'PAGE'
  readonly children: FakeNode[]
  selection: readonly PortSceneNode[]
  appendChild(child: PortSceneNode): void
}

/** The fake Plugin API, the port plus the handles a test inspects. */
export interface FakeFigma extends FigmaPort {
  readonly page: FakePage
  readonly mutations: { count: number }
  /** Every node ever created, by id. */
  readonly nodes: Map<string, FakeNode>
}

const AUTO_LAYOUT_TYPES = new Set(['FRAME', 'COMPONENT', 'INSTANCE'])
const CONTAINER_TYPES = new Set([...AUTO_LAYOUT_TYPES, 'GROUP'])

const hasAutoLayout = (node: FakeNode | FakePage | undefined): boolean =>
  node !== undefined &&
  node.type !== 'PAGE' &&
  typeof (node as FakeNode)['layoutMode'] === 'string' &&
  (node as FakeNode)['layoutMode'] !== 'NONE'

/** A seeded variable: its name, its collection and its value in the collection's default mode. */
export interface FakeVariableSeed {
  readonly name: string
  readonly value: number
  readonly collection?: string
}

export const createFakeFigma = (seeds: readonly FakeVariableSeed[] = []): FakeFigma => {
  const nodes = new Map<string, FakeNode>()
  const mutations = { count: 0 }
  const fonts = new Set<string>()
  const ids = { next: 1 }
  const nextId = () => `${ids.next++}:1`

  const detach = (child: FakeNode) => {
    const siblings = child.parent?.children
    if (siblings === undefined) return
    const index = siblings.indexOf(child)
    if (index >= 0) siblings.splice(index, 1)
  }

  const page: FakePage = {
    type: 'PAGE',
    children: [],
    selection: [],
    appendChild(child) {
      const node = child as unknown as FakeNode
      detach(node)
      node.parent = page
      page.children.push(node)
    },
  }

  const guard = (target: FakeNode, field: string, value: Value) => {
    if (field === 'layoutSizingHorizontal' || field === 'layoutSizingVertical') {
      if (value === 'HUG' && !(target.type === 'TEXT' || hasAutoLayout(target))) {
        throw new Error(`HUG is only valid on auto-layout frames and text (${target.name})`)
      }
      if (value === 'FILL' && !hasAutoLayout(target.parent)) {
        throw new Error(`FILL is only valid on auto-layout children (${target.name})`)
      }
    }
    if (field === 'layoutPositioning' && value === 'ABSOLUTE' && !hasAutoLayout(target.parent)) {
      throw new Error(`ABSOLUTE is only valid inside auto layout (${target.name})`)
    }
    if (field === 'characters' && !fonts.has('Inter Regular')) {
      throw new Error('Cannot write to a text node before its font is loaded')
    }
  }

  const counted = (node: FakeNode): FakeNode =>
    new Proxy(node, {
      set(target, field: string, value: Value) {
        if (field !== 'parent') {
          guard(target, field, value)
          mutations.count += 1
          // A raw value written over a bound field unbinds it, as in Figma.
          if (field in target.boundVariables) {
            const { [field]: _unbound, ...rest } = target.boundVariables
            target.boundVariables = rest
          }
        }
        ;(target as Record<string, Value>)[field] = value
        return true
      },
    })

  const create = (type: string, fields: Record<string, Value> = {}): FakeNode => {
    const raw: FakeNode = {
      id: nextId(),
      type,
      name: type.toLowerCase(),
      locked: false,
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      parent: undefined,
      children: [],
      fills: [{ type: 'SOLID' }],
      pluginData: new Map(),
      boundVariables: {},
      componentPropertyDefinitions: {},
      mainComponent: undefined,
      // Replaced by `methodsOf` below, once the proxy exists to close over.
      getPluginData: () => '',
      ...(AUTO_LAYOUT_TYPES.has(type)
        ? {
            layoutMode: 'NONE',
            itemSpacing: 0,
            paddingTop: 0,
            paddingRight: 0,
            paddingBottom: 0,
            paddingLeft: 0,
            primaryAxisAlignItems: 'MIN',
            counterAxisAlignItems: 'MIN',
            primaryAxisSizingMode: 'FIXED',
            counterAxisSizingMode: 'FIXED',
            layoutSizingHorizontal: 'FIXED',
            layoutSizingVertical: 'FIXED',
          }
        : {}),
      ...(type === 'TEXT'
        ? { characters: '', layoutSizingHorizontal: 'HUG', layoutSizingVertical: 'HUG' }
        : {}),
      ...(type === 'RECTANGLE' || type === 'VECTOR' || type === 'GROUP'
        ? { layoutSizingHorizontal: 'FIXED', layoutSizingVertical: 'FIXED' }
        : {}),
      layoutPositioning: 'AUTO',
      ...fields,
    }
    const node = counted(raw)
    Object.assign(raw, methodsOf(node, raw))
    nodes.set(raw.id, node)
    page.appendChild(node as unknown as PortSceneNode)
    return node
  }

  const variables: PortVariable[] = seeds.map((seed, index) => ({
    id: `VariableID:${index + 1}`,
    name: seed.name,
    resolvedType: 'FLOAT',
    variableCollectionId: seed.collection ?? 'collection:1',
    valuesByMode: { 'mode:1': seed.value },
  }))

  /** A deep copy of a main component's layers, as an instance's sublayers. */
  const mirror = (layer: FakeNode, instanceId: string): FakeNode => {
    const { id, parent, children, pluginData, mainComponent, ...fields } = layer
    const copy = create(layer.type, {
      ...Object.fromEntries(
        Object.entries(fields).filter(([, value]) => typeof value !== 'function')
      ),
      id: `I${instanceId};${id.replace(/^I/, '')}`,
      boundVariables: { ...layer.boundVariables },
    })
    nodes.set(copy.id, copy)
    children.forEach((child) => appendTo(copy, mirror(child, instanceId)))
    return copy
  }

  const appendTo = (parent: FakeNode, child: FakeNode) => {
    detach(child)
    child.parent = parent
    parent.children.push(child)
  }

  function methodsOf(node: FakeNode, raw: FakeNode): Record<string, Value> {
    return {
      getPluginData: (key: string) => node.pluginData.get(key) ?? '',
      setPluginData: (key: string, value: string) => {
        mutations.count += 1
        if (value === '') node.pluginData.delete(key)
        else node.pluginData.set(key, value)
      },
      ...(CONTAINER_TYPES.has(raw.type)
        ? {
            appendChild: (child: PortSceneNode) => {
              mutations.count += 1
              appendTo(node, child as unknown as FakeNode)
            },
          }
        : {}),
      resize: (width: number, height: number) => {
        mutations.count += 1
        node.width = width
        node.height = height
        if (hasAutoLayout(node)) node.layoutSizingHorizontal = 'FIXED'
      },
      setBoundVariable: (field: string, variable: PortVariable | null) => {
        mutations.count += 1
        if (variable === null) {
          delete node.boundVariables[field]
          return
        }
        node.boundVariables = {
          ...node.boundVariables,
          [field]: { type: 'VARIABLE_ALIAS', id: variable.id },
        }
        const value = variable.valuesByMode['mode:1']
        if (typeof value === 'number') (raw as Record<string, Value>)[field] = value
      },
      addComponentProperty: (name: string, _type: 'TEXT', value: string) => {
        mutations.count += 1
        const key = `${name}#${Object.keys(node.componentPropertyDefinitions).length + 1}:0`
        node.componentPropertyDefinitions = { ...node.componentPropertyDefinitions, [key]: value }
        return key
      },
      createInstance: () => {
        const { id, parent, children, pluginData, mainComponent, ...fields } = raw
        const inherited = Object.fromEntries(
          Object.entries(fields).filter(
            ([field, value]) =>
              typeof value !== 'function' &&
              ![
                'type',
                'x',
                'y',
                'locked',
                'layoutSizingHorizontal',
                'layoutSizingVertical',
                'layoutPositioning',
              ].includes(field)
          )
        )
        const instance = create('INSTANCE', {
          ...inherited,
          boundVariables: { ...raw.boundVariables },
          mainComponent: node,
          componentProperties: Object.fromEntries(
            Object.entries(raw.componentPropertyDefinitions).map(([key, value]) => [
              key,
              { type: 'TEXT', value },
            ])
          ),
        })
        children.forEach((child) => appendTo(instance, mirror(child, instance.id)))
        return instance
      },
    }
  }

  const port: FakeFigma = {
    page,
    mutations,
    nodes,
    get currentPage() {
      return page
    },
    createFrame: () => create('FRAME') as never,
    createText: () => create('TEXT') as never,
    createComponent: () => create('COMPONENT') as never,
    createRectangle: () => create('RECTANGLE') as never,
    createVector: () => create('VECTOR') as never,
    group: (members: readonly PortBaseNode[], parent: PortBaseNode) => {
      const container = parent as unknown as FakeNode
      const layers = members as unknown as FakeNode[]
      const index = Math.min(...layers.map((layer) => container.children.indexOf(layer)))
      const group = create('GROUP')
      detach(group)
      group.parent = container
      container.children.splice(index, 0, group)
      layers.forEach((layer) => appendTo(group, layer))
      return group as never
    },
    loadFontAsync: async (font: PortFontName) => {
      fonts.add(`${font.family} ${font.style}`)
    },
    getNodeByIdAsync: async (id: string) => (nodes.get(id) as unknown as PortBaseNode) ?? null,
    variables: {
      getLocalVariablesAsync: async () => [...variables],
      getVariableByIdAsync: async (id: string) =>
        variables.find((variable) => variable.id === id) ?? null,
      getVariableCollectionByIdAsync: async () => ({ defaultModeId: 'mode:1' }),
    },
  }
  return port
}

/** Every layer under a list, depth first. */
export const allLayers = (layers: readonly FakeNode[]): readonly FakeNode[] =>
  layers.flatMap((layer) => [layer, ...allLayers(layer.children)])
