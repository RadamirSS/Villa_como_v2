import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const geo = JSON.parse(readFileSync(new URL('../src/data/architectural-geometry.json', import.meta.url),'utf8'))
const spatial = JSON.parse(readFileSync(new URL('../src/data/spatial-model.json', import.meta.url),'utf8'))

test('architectural geometry source links all 33 actual door leaf symbols',()=>{
  const marks = Object.values(geo.floors).flatMap(f=>f.doors)
  assert.equal(marks.length,33)
  assert.equal(new Set(marks.map(m=>m.id)).size,33)
  assert(marks.every(m=>m.sourceConfidence==='source-vector-symbol-and-door-schedule'))
  assert(marks.every(m=>m.symbolMatchDistancePt<40))
})
test('source wall IDs stay uniquely attached to stage-3 polygon indices',()=>{
  const idList=[]
  for(const [id,plan] of Object.entries(geo.floors)){
    assert.equal(plan.sourceWalls.length,spatial.floors[id].wallPolygonsPt.length)
    for(const wall of plan.sourceWalls)idList.push(wall.id)
  }
  assert.equal(idList.length,368)
  assert.equal(new Set(idList).size,368)
})
test('the horizontal scale is independently checked rather than claimed exact',()=>{
  const checks=Object.values(geo.floors).flatMap(f=>f.calibrationChecks)
  assert.equal(checks.length,8)
  assert(checks.every(x=>Math.abs(x.residualAtDisplayScalePct)<2))
  assert(checks.every(x=>x.validation==='dimension-anchor-only-not-closed-chain'))
})
test('uncertain doors, slab surfaces, stairs and roof are not treated as verified',()=>{
  assert(Object.values(geo.floors).some(f=>f.openingCountUnresolved>0))
  assert(Object.values(geo.floors).every(f=>f.slabGeometry.status==='provisional-envelope'))
  assert(Object.values(geo.floors).every(f=>f.stairGeometry.status==='not-verified'))
  assert.equal(geo.levelElevationsMm['level-3'].confidence,'display-assumption-not-approved')
  assert(geo.unresolvedConstraints.some(x=>x.includes('facades/roof')))
})
