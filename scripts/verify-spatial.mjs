import assert from 'node:assert/strict'
import fs from 'node:fs'
const model = JSON.parse(fs.readFileSync('src/data/spatial-model.json', 'utf8'))
const project = JSON.parse(fs.readFileSync('src/data/project.json', 'utf8'))
const plans = JSON.parse(fs.readFileSync('src/data/architectural-plans.json', 'utf8'))
assert.equal(project.phase, 3)
assert.equal(model.schema, 'villa-como-v2/visual-3d/1')
assert.equal(model.coordinateSpace, 'source PDF points, common page registration, converted only for visual Three.js display')
assert.equal(model.calibration.approvedForConstruction, false)
assert(model.calibration.pointsPerMeter > 20 && model.calibration.pointsPerMeter < 60)
assert.equal(model.displayAssumptions.garageLocation.startsWith('unknown'), true)
assert.equal(model.displayAssumptions.roof, 'not available')
assert.deepEqual(Object.keys(model.floors).sort(), ['garage','level-1','level-2','level-3'].sort())
let wallCount = 0, rings = 0
for(const [id, floor] of Object.entries(model.floors)) {
  const source = plans.floors[id]
  assert.equal(floor.sourceSheet, source.finalSheet)
  assert.equal(floor.sourcePage, source.finalPage)
  assert.equal(floor.sourceViewport.xPt, source.cropOriginPts[0])
  assert.equal(floor.sourceViewport.yPt, source.cropOriginPts[1])
  assert(Math.abs(floor.sourceViewport.widthPt - source.viewport.width)<.01)
  assert(Math.abs(floor.sourceViewport.heightPt - source.viewport.height)<.01)
  assert(floor.wallPolygonsPt.length >= 25, `${id} no derived wall footprints`)
  assert.equal(floor.wallPolygonCount, floor.wallPolygonsPt.length)
  assert(floor.slabEnvelopePt.length >= 1)
  assert.equal(floor.status, 'source-derived-provisional')
  for(const polygon of floor.wallPolygonsPt) {
    assert(polygon.outer.length >= 3)
    for(const ring of [polygon.outer,...polygon.holes]) {
      assert(ring.length >= 3)
      rings++
      for(const p of ring) {
        assert.equal(p.length,2)
        assert(p.every(Number.isFinite))
        assert(p[0] >= floor.sourceViewport.xPt-1 && p[0] <= floor.sourceViewport.xPt+floor.sourceViewport.widthPt+1,
          `${id} wall vertex outside registered drawing viewport`)
        assert(p[1] >= floor.sourceViewport.yPt-1 && p[1] <= floor.sourceViewport.yPt+floor.sourceViewport.heightPt+1)
      }
    }
  }
  wallCount+=floor.wallPolygonsPt.length
  assert(project.floors.find(x=>x.id===id).geometry===null, 'Do not label source trace as verified BIM')
}
assert(wallCount>=300)
console.log(`Stage 3 visual spatial geometry verified: ${wallCount} PDF-derived wall polygons, ${rings} contours, 4 floors. Provisional scale, roof and heights explicitly unapproved.`)
