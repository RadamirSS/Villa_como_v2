import fs from 'node:fs'
import assert from 'node:assert/strict'
const project = JSON.parse(fs.readFileSync('src/data/project.json', 'utf8'))
assert.equal(project.id, 'villa-como-v2')
assert.equal(project.phase, 3)
assert.equal(project.source.pdfPages, 94)
const expected = [['garage',138.72,7,'A-18'],['level-1',247.85,19,'A-19'],['level-2',262.24,13,'A-20'],['level-3',66.79,5,'A-21']]
assert.deepEqual(project.floors.map(f=>[f.id,f.scheduleAreaM2,f.scheduleRooms,f.scheduleSheet]),expected)
for (const floor of project.floors){
  assert.equal(floor.status,'draft')
  assert.equal(floor.geometry,null,'PDF vector traces do not count as verified semantic floor geometry')
  assert(floor.sourceSheets.includes(floor.scheduleSheet))
}
assert.equal(project.floors[2].terraceAreaM2,22.51)
assert.equal(project.floors[2].relativeElevationMm,2930)
assert.equal(Math.round(project.floors.reduce((sum,f)=>sum+f.scheduleAreaM2,0)*100),71560)
console.log('Project v2 stage 3: source areas, status, provenance and elevations verified.')
