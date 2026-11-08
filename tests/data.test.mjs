import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import test from 'node:test'
const manifest = JSON.parse(readFileSync(new URL('../src/data/project.json',import.meta.url),'utf8'))
const plans = JSON.parse(readFileSync(new URL('../src/data/architectural-plans.json',import.meta.url),'utf8'))
test('source inventory accounts for all four project levels',()=>{
  assert.equal(manifest.phase,1)
  assert.deepEqual(manifest.floors.map(f=>f.id),['garage','level-1','level-2','level-3'])
  assert.deepEqual(manifest.floors.map(f=>f.scheduleSheet),['A-18','A-19','A-20','A-21'])
})
test('published areas remain source values and not measured render areas',()=>{
  assert.equal(Math.round(manifest.floors.reduce((s,f)=>s+f.scheduleAreaM2,0)*100),71560)
  assert.equal(manifest.floors[2].terraceAreaM2,22.51)
  assert.equal(manifest.floors[2].relativeElevationMm,2930)
  assert(manifest.floors.every(f=>f.status==='draft'&&f.geometry===null))
})
test('room markers are placed from actual numbered furniture-plan labels',()=>{
  assert.equal(plans.floors['level-1'].rooms.length,19)
  assert.equal(plans.floors['level-2'].rooms.length,13)
  assert.equal(plans.floors['level-3'].rooms.length,5)
  assert.equal(plans.floors.garage.rooms.length,7)
  assert(plans.floors['level-1'].rooms.every(r=>r.marker!==null))
})
test('new partitions preserve construction sheet provenance',()=>{
  assert.equal(plans.floors['level-1'].installSheet,'A-11')
  assert.equal(plans.floors['level-2'].finalSheet,'A-16')
  assert(plans.floors['level-1'].newPartitionShapes.some(p=>p.kind==='block'))
})
