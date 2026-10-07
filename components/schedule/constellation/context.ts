'use client'

import { createContext, useContext } from 'react'

export type ConstellationUi = {
  /** Node/edge ids connected to the hovered element; null when nothing is hovered. */
  highlighted: Set<string> | null
  dropTargetId: string | null
  selectedId: string | null
  showEdgeLabels: boolean
  onAddSession: (therapistId: string) => void
  onSelectPair: (pairKey: string) => void
}

export const ConstellationUiContext = createContext<ConstellationUi>({
  highlighted: null,
  dropTargetId: null,
  selectedId: null,
  showEdgeLabels: true,
  onAddSession: () => {},
  onSelectPair: () => {},
})

export const useConstellationUi = () => useContext(ConstellationUiContext)

export const THERAPIST_NODE = { w: 232, h: 94 }
export const CLIENT_NODE = { w: 196, h: 60 }
export const TRAY_NODE = { w: 176, h: 52 }

export const therapistNodeId = (id: string) => `t:${id}`
export const clientNodeId = (id: string) => `c:${id}`
export const edgeId = (pairKey: string) => `e:${pairKey}`
