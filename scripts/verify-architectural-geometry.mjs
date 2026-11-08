import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const geo = JSON.parse(readFileSync('src/data/architectural-geometry.json', 'utf8'))
const spatial = JSON.parse(readFileSync('src/data/spatial-model.json', 'utf8'))
const sheets = JSON.parse(readFileSync('src/data/architectural-plans.json', 'utf8')).floors
const expected = {garage: 3, 'level-1': 15, 'level-2': 10, 'level-3': 5}
assert.equal(geo.schema,'villa-como-v2/architectural-geometry/1')
assert.equal(geo.displayPointsPerMeter, spatial.calibration.pointsPerMeter)
assert.match(geo.sourcePdfSha256,/^[0-9a-f]{64}$/)
let wallCount = 0, doorCount = 0, apertureCount = 0
const allIds = []
for (const [fid,wanted] of Object.entries(expected)) {
  const f = geo.floors[fid], stage3 = spatial.floors[fid], spec = sheets[fid].doorSpecification
  assert.equal(f.sourceSheet,stage3.sourceSheet)
  assert.equal(f.sourceWalls.length,stage3.wallPolygonsPt.length)
  assert.equal(f.doors.length,wanted)
  assert.equal(f.calibrationChecks.length,2)
  for (const a of f.calibrationChecks) {
    assert(a.observedLengthPt > 0 && a.dimensionMm > 0)
    assert(Math.abs(a.residualAtDisplayScalePct) < 2,'revisit dimension anchor '+fid+' '+a.sheet)
    assert(a.validation.includes('not-closed-chain'))
  }
  assert.equal(f.stairGeometry.status,'not-verified')
  assert.equal(f.slabGeometry.status,'provisional-envelope')
  for (const [i,wall] of f.sourceWalls.entries()) {
    assert.equal(wall.sourcePolygonIndex,i)
    assert(wall.id.startsWith('wall-'+fid+'-'))
    assert.equal(wall.verticalGeometryVerified,false)
    allIds.push(wall.id)
  }
  for (const door of f.doors) {
    const doorSpec = spec.find(s=>s.mark===door.mark)
    assert(doorSpec,'missing source door mark: '+door.id)
    assert.deepEqual([door.openingWidthMm,door.openingHeightMm,door.leafWidthMm,door.leafHeightMm],
      [doorSpec.openingWidthMm,doorSpec.openingHeightMm,doorSpec.leafWidthMm,doorSpec.leafHeightMm])
    assert(door.id.startsWith(fid+'/') && door.symbolMatchDistancePt<=40)
    assert.equal(door.sourceSheet,f.sourceSheet)
    assert.equal(door.sourceLeafSegmentPt.length,2)
    const [[ax,ay],[bx,by]]=door.sourceLeafSegmentPt
    assert(Math.hypot(bx-ax,by-ay)>10,'door leaf absent from source drawing '+door.id)
    assert(door.aperture.status==='unresolved' || door.aperture.status==='source-gap-correlated-not-construction-approved')
    if (door.aperture.status!=='unresolved') {
      assert.equal(door.aperture.heightMmFromDoorSchedule,true)
      apertureCount++
    }
    allIds.push(door.id)
  }
  assert.equal(f.openingCountResolved+f.openingCountUnresolved,wanted)
  wallCount += f.sourceWalls.length
  doorCount += wanted
}
assert.equal(new Set(allIds).size, allIds.length)
assert.equal(wallCount,368)
assert.equal(doorCount,33)
assert.equal(apertureCount,geo.floors.garage.openingCountResolved+geo.floors['level-1'].openingCountResolved+geo.floors['level-2'].openingCountResolved+geo.floors['level-3'].openingCountResolved)
assert.equal(geo.levelElevationsMm['level-2'].value,2930)
assert.equal(geo.levelElevationsMm['level-3'].confidence,'display-assumption-not-approved')
assert(geo.unresolvedConstraints.includes('verified stair treads and rise/run'))
console.log(`Architectural package A: ${wallCount} stable source wall IDs, ${doorCount} vector-matched doors, ${apertureCount} correlated apertures, ${doorCount-apertureCount} unresolved portals; eight cross-checked dimensions (not closed-chain BIM).`)
