import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const spatial = JSON.parse(readFileSync(new URL('../src/data/spatial-model.json',import.meta.url)))
const arch = JSON.parse(readFileSync(new URL('../src/data/architectural-plans.json',import.meta.url)))
const project = JSON.parse(readFileSync(new URL('../src/data/project.json',import.meta.url)))

test('stage 3 derives real source-wall polygons from all four clean-opening sheets',()=>{
  const refs={garage:'A-14','level-1':'A-15','level-2':'A-16','level-3':'A-17'}
  for(const [id,sheet] of Object.entries(refs)) {
    assert.equal(spatial.floors[id].sourceSheet,sheet)
    assert.equal(spatial.floors[id].sourcePage,arch.floors[id].finalPage)
    assert(spatial.floors[id].wallPolygonsPt.length>25)
  }
})
test('model geometry is derived from source PDF point space not false millimetre BIM',()=>{
  assert.equal(project.phase,3)
  assert.equal(spatial.calibration.approvedForConstruction,false)
  assert(project.floors.every(f=>f.geometry===null&&f.status==='draft'))
  assert.match(spatial.floors['level-1'].wallSource, /PDF/)
})
test('no fabricated roof or certified attic height / garage site position',()=>{
  assert.equal(spatial.displayAssumptions.roof,'not available')
  assert.match(spatial.displayAssumptions.garageLocation,/unknown/)
  assert.equal(project.floors[3].relativeElevationMm,null)
})
test('plans preserve identical common PDF sheet registration for overlay',()=>{
  for(const [id,fp] of Object.entries(arch.floors)) {
    const sv=spatial.floors[id].sourceViewport
    assert.deepEqual([sv.xPt,sv.yPt], fp.cropOriginPts)
    assert.equal(sv.widthPt,fp.viewport.width)
    assert.equal(sv.heightPt,fp.viewport.height)
  }
})
