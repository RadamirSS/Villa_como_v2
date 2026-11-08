export type Confidence = 'drawing' | 'owner-confirmed' | 'assumed' | 'needs-verification'
export type DigitizationStatus = 'not-digitized' | 'draft' | 'verified'
export interface SourceEvidence { sheet: string; confidence: Confidence; comment?: string }
export interface Point2Mm { xMm: number; zMm: number }
export interface Point3Mm extends Point2Mm { yMm: number }
export interface WallSegment { id: string; start: Point2Mm; end: Point2Mm; thicknessMm: number; baseElevationMm: number; heightMm: number; source: SourceEvidence }
export interface Opening { id: string; wallId: string; offsetFromStartMm: number; widthMm: number; sillMm: number; heightMm: number; kind: 'door' | 'window' | 'passage'; source: SourceEvidence }
export interface Room { id: string; name: string; boundary: Point2Mm[]; scheduleAreaM2: number | null; source: SourceEvidence }
export interface ElementPlacement { id: string; catalogId: string; roomId: string; position: Point3Mm; rotationDegrees: number; widthMm: number; depthMm: number; heightMm: number; source: SourceEvidence }
export interface FloorGeometry { coordinateFrameId: string; footprint: Point2Mm[]; walls: WallSegment[]; openings: Opening[]; rooms: Room[]; furniture: ElementPlacement[]; plumbing: ElementPlacement[]; lighting: ElementPlacement[] }
export interface FloorRecord {
 id: 'garage' | 'level-1' | 'level-2' | 'level-3'; title: string; shortTitle: string; scheduleAreaM2: number; scheduleRooms: number; scheduleSheet: string; terraceAreaM2: number | null; relativeElevationMm: number | null; elevationBasis: string; sourceSheets: string[]; status: DigitizationStatus; geometry: FloorGeometry | null; description: string
}
export interface ProjectManifest { id: string; title: string; phase: number; source: { studio: string; document: string; pdfPages: number; filenameDate: string }; floors: FloorRecord[]; warnings: string[] }
