export type ConstructionKind = 'block' | 'gypsum' | 'infill'
export type DoorSwing = 'left' | 'right' | 'double'
export interface VectorViewport { width: number; height: number }
export interface PlanRoom {
  number: number
  name: string
  areaM2: number
  marker: [number, number] | null
}
export interface DoorSpecification {
  mark: string
  openingWidthMm: number
  openingHeightMm: number
  leafWidthMm: number
  leafHeightMm: number
  swing: DoorSwing
  count: number
}
export interface ControlDimension {
  label: string
  sheet: string
  mm?: number
  m2?: number
}
export interface PartitionRegion {
  x: number
  y: number
  width: number
  height: number
  kind: ConstructionKind
}
export interface ArchitecturalPlan {
  finalSheet: string
  finalPage: number
  installSheet: string
  installPage: number
  furnitureSheet: string
  furniturePage: number
  measuredSheet: string
  measuredPage: number
  sourceShift: [number, number]
  constructionShift: [number, number]
  viewport: VectorViewport
  cropOriginPts: [number, number]
  rooms: PlanRoom[]
  doorSpecification: DoorSpecification[]
  controlDimensions: ControlDimension[]
  newPartitionShapes: PartitionRegion[]
  evidence: Record<string, string>
}
export interface ArchitecturalPlanSet {
  units: 'source-pdf-points'
  geometryMeaning: string
  sourceDocument: string
  floors: Record<'garage' | 'level-1' | 'level-2' | 'level-3', ArchitecturalPlan>
}
