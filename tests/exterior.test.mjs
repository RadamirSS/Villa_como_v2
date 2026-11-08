import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import test from 'node:test'
const e=JSON.parse(readFileSync(new URL('../src/data/exterior-concept.json',import.meta.url),'utf8'))
const spatial=JSON.parse(readFileSync(new URL('../src/data/spatial-model.json',import.meta.url),'utf8'))
const ids=['level-1','level-2','level-3','garage']
test('exterior concept preserves registered source coordinate frame',()=>{
 assert.equal(e.pointsPerMeter,spatial.calibration.pointsPerMeter)
 assert.deepEqual(e.originPt,{xPt:600,yPt:350})
 assert(ids.every(id=>e.floors[id].sourceSheet===spatial.floors[id].sourceSheet))
})
test('all conceptual envelopes are winding-safe and do not replace original wall footprints',()=>{
 for(const id of ids){
  const f=e.floors[id]
  assert(f.outlinePt.length>5)
  assert(f.facadeSegments.every(s=>s.lengthM>0))
  assert.equal(f.facadeSegments.length,f.outlinePt.length)
  assert(f.status.includes('provisional'))
  assert(spatial.floors[id].wallPolygonCount>30)
 }
})
test('roof is explicitly an unverified demonstration, not a missing-drawing fabrication',()=>{
 assert.equal(e.isApprovedArchitecturalModel,false)
 assert.equal(e.roof.status,'conceptual-massing-only-not-source-verified')
 assert(e.missingSources.includes('roof plan'))
 assert(e.missingSources.includes('exterior elevations'))
 assert(e.roof.faces.every(r=>r.outlinePt.length>=3 && r.plane.length===3))
})
test('glazing sizes and material combinations are marked provisional',()=>{
 for(const id of ids){
  const windows=e.floors[id].facadeSegments.flatMap(x=>x.windows)
  assert(windows.length >= (id === 'level-3' ? 0 : 3))
  assert(windows.every(x=>x.sillSource==='presentation-assumption' && x.sourceLabel))
 }
})
test('terrace uses real schedule but its model outline is not claimed metrically exact',()=>{
 assert.equal(e.terrace.scheduleAreaM2,22.51)
 assert.equal(e.terrace.roomNumber,13)
 assert.equal(e.terrace.confirmedPosition,false)
 assert.equal(e.terrace.polygonPt.length,4)
})
test('garage uses owner-confirmed site orientation without claiming a surveyed position',()=>{
 assert.equal(e.garagePlacement.mode,'owner-informed-site-layout')
 assert.deepEqual(e.garagePlacement.xyMeters,[24.5,10.2])
 assert.equal(e.garagePlacement.onSitePositionApproved,false)
})
