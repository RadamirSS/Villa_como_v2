import fs from 'node:fs'
import path from 'node:path'

const data = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'src/data/project.json'), 'utf8'))
function fail(message) { throw new Error('[Villa Como data] ' + message) }

if (data.id !== 'villa-como-v2' || data.phase !== 0) fail('Unexpected project/version/stage')
if (data.source.pdfPages !== 94) fail('Unexpected PDF page count')
if (!Array.isArray(data.floors) || data.floors.length !== 4) fail('Expected garage and three levels')
const expected = [
  ['garage',138.72,7,'A-18'],['level-1',247.85,19,'A-19'],
  ['level-2',262.24,13,'A-20'],['level-3',66.79,5,'A-21']
]
for (const [index, spec] of expected.entries()) {
  const floor = data.floors[index]
  if (floor.id !== spec[0] || floor.scheduleAreaM2 !== spec[1] ||
      floor.scheduleRooms !== spec[2] || floor.scheduleSheet !== spec[3])
    fail('Schedule mismatch: ' + spec[0])
  if (!floor.sourceSheets.includes(floor.scheduleSheet)) fail('Missing source: ' + floor.id)
  if (floor.status !== 'not-digitized' || floor.geometry !== null)
    fail('Stage 0 cannot contain undocumented geometry: ' + floor.id)
  if (floor.relativeElevationMm !== null && !Number.isInteger(floor.relativeElevationMm))
    fail('Elevation must be integer millimetres: ' + floor.id)
}
if (data.floors[2].terraceAreaM2 !== 22.51) fail('A-20 terrace mismatch')
if (data.floors[2].relativeElevationMm !== 2930) fail('A-05 second-floor elevation mismatch')
const hundredths = data.floors.reduce((sum,f) => sum + Math.round(f.scheduleAreaM2 * 100), 0)
if (hundredths !== 71560) fail('Scheduled area total mismatch')
console.log('Stage 0 validated: source register, four floors, areas, elevation, and zero fabricated geometry.')
