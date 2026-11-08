import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
const source = JSON.parse(fs.readFileSync('src/data/architectural-plans.json','utf8'))
const project = JSON.parse(fs.readFileSync('src/data/project.json','utf8'))
const encoded = JSON.parse(fs.readFileSync('src/data/source-traces.json','utf8'))
assert.equal(source.units,'source-pdf-points')
const expected = {garage:['A-14','A-10','A-18',7,3], 'level-1':['A-15','A-11','A-19',19,15], 'level-2':['A-16','A-12','A-20',13,10], 'level-3':['A-17','A-13','A-21',5,5]}
let roomsTotal=0,doorsTotal=0
for (const floor of project.floors) {
  const plan=source.floors[floor.id]
  assert(plan,'Missing plan for '+floor.id)
  const [sourceSheet,mountSheet,furnitureSheet,roomCount,doorCount]=expected[floor.id]
  assert.deepEqual([plan.finalSheet,plan.installSheet,plan.furnitureSheet],[sourceSheet,mountSheet,furnitureSheet])
  assert.equal(plan.rooms.length,roomCount)
  assert.equal(plan.doorSpecification.reduce((s,d)=>s+d.count,0),doorCount)
  assert.equal(new Set(plan.rooms.map(r=>r.number)).size,roomCount)
  assert.equal(new Set(plan.doorSpecification.map(d=>d.mark)).size,plan.doorSpecification.length)
  assert(plan.newPartitionShapes.length>0)
  assert(plan.rooms.every(room=>room.marker&&room.marker.length===2))
  for(const room of plan.rooms){
    assert(room.marker[0]>=0&&room.marker[0]<=plan.viewport.width,'Out-of-bounds room '+floor.id+'/'+room.number)
    assert(room.marker[1]>=0&&room.marker[1]<=plan.viewport.height,'Out-of-bounds room '+floor.id+'/'+room.number)
    assert(room.areaM2>0)
  }
  const sum=plan.rooms.reduce((s,r)=>s+Math.round(r.areaM2*100),0)/100
  assert(Math.abs(sum-floor.scheduleAreaM2)<=.011,'Room schedule sum mismatch on '+floor.id)
  for(const door of plan.doorSpecification){
    assert(door.openingWidthMm>=door.leafWidthMm && door.openingHeightMm>=door.leafHeightMm,'Invalid opening '+door.mark)
    assert(Number.isInteger(door.openingWidthMm)&&Number.isInteger(door.leafWidthMm))
    assert(['left','right','double'].includes(door.swing))
  }
  const svg=gunzipSync(Buffer.from(encoded[floor.id],'base64')).toString('utf8')
  const path='source-traces/'+floor.id
  assert(svg.includes('<svg')&&svg.includes('viewBox=')&&svg.includes('source-wall')&&svg.includes('source-finish'),'Missing source wall/finish vectors '+path)
  assert(svg.includes('data-source="'+sourceSheet+'"'),'Wrong sheet in SVG '+path)
  assert(!svg.includes('<image')&&!svg.includes('MÈTRE')&&!svg.includes('<script')&&!svg.includes('<foreignObject'),'Source logo/title/unsafe tags should not be redistributed')
  roomsTotal+=roomCount;doorsTotal+=doorCount
}
assert.equal(roomsTotal,44)
assert.equal(doorsTotal,33)
console.log('PDF-derived SVG floor traces confirmed: 4 levels, 44 numbered rooms, 33 documented door positions, source metadata and overlays.')
