'use client'

import { Children, cloneElement, createContext, Fragment, isValidElement, useContext, type ReactElement, type ReactNode } from 'react'
import { normaliseLayout } from '@/lib/layout-order.mjs'

export type LayoutSettings = { moduleOrder: string[]; featureOrder: Record<string, string[]> }
const Context = createContext<LayoutSettings>(normaliseLayout(null))
export const useLayoutOrder = () => useContext(Context)
export function FeatureSlot({ children }: { children: ReactNode; 'data-feature': string }) { return <>{children}</> }
export function LayoutOrderProvider({ layout, children }: { layout: LayoutSettings; children: ReactNode }) {
  return <Context.Provider value={layout}>{children}</Context.Provider>
}

/** Reorder annotated siblings, preserving headings, semantic parents and unrelated content. */
export function orderFeatureChildren(children: ReactNode, order: string[]): ReactNode {
  const flatten = (items: ReactNode, prefix = ''): ReactNode[] => Children.toArray(items).flatMap((node, index) => {
    if (!isValidElement(node)) return [node]
    const element = node as ReactElement<{ children?: ReactNode }>
    const key = `${prefix}${element.key ?? index}`
    return element.type === Fragment ? flatten(element.props.children, `${key}/`) : [cloneElement(element, { key })]
  })
  const nodes = flatten(children).map(node => {
    if (!isValidElement(node)) return node
    const element = node as ReactElement<{ children?: ReactNode; 'data-feature'?: string }>
    return element.props.children === undefined ? element : cloneElement(element, undefined, orderFeatureChildren(element.props.children, order))
  })
  const id = (node: ReactNode) => isValidElement(node) ? (node.props as { 'data-feature'?: string })['data-feature'] : undefined
  const ordered = nodes.filter(node => id(node) !== undefined).sort((a, b) => {
    const rank = (node: ReactNode) => { const index = order.indexOf(id(node)!); return index < 0 ? order.length : index }
    return rank(a) - rank(b)
  })
  let index = 0
  return nodes.map(node => id(node) === undefined ? node : ordered[index++])
}
export default function FeatureLayout({ module, children }: { module: string; children: ReactNode }) {
  const layout = useContext(Context)
  return <>{orderFeatureChildren(children, layout.featureOrder[module] ?? [])}</>
}
