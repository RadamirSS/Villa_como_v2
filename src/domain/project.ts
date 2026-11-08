import raw from '../data/project.json'
import type { ProjectManifest } from './types'
export const project = raw as unknown as ProjectManifest
export const totalScheduledArea = project.floors.reduce((sum, f) => sum + f.scheduleAreaM2, 0)
export function assertProjectManifest(manifest: ProjectManifest): void {
  if (manifest.phase !== 3 || manifest.floors.length !== 4) throw new Error('Expected stage-3 project with four levels')
  const ids = new Set<string>()
  for (const floor of manifest.floors) {
    if (ids.has(floor.id)) throw new Error('Duplicate floor ' + floor.id)
    ids.add(floor.id)
    if (floor.status !== 'draft' || floor.geometry !== null) throw new Error('PDF vector traces are not yet verified semantic BIM: ' + floor.id)
    if (!Number.isFinite(floor.scheduleAreaM2) || floor.scheduleAreaM2 <= 0) throw new Error('Invalid area')
    if (!floor.sourceSheets.includes(floor.scheduleSheet)) throw new Error('Missing source sheet ' + floor.id)
  }
}
assertProjectManifest(project)
