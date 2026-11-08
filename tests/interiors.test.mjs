import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
const read=name=>JSON.parse(readFileSync(new URL(`../src/data/${name}.json`,import.meta.url)))
const specs=read('plumbing-register')
const furniture=read('furniture-vectors')
const docs=read('architectural-plans').floors

test('furniture sheets retain original viewports of architecture overlays',()=>{
 for(const [id,plan] of Object.entries(docs)){
   const svg=gunzipSync(Buffer.from(furniture[id],'base64')).toString()
   assert.match(svg,/data-source-art="not-millimetre-BIM"/)
   const match=/viewBox="0 0 ([0-9.]+) ([0-9.]+)"/.exec(svg)
   assert(match && Math.abs(Number(match[1])-plan.viewport.width)<.002)
   assert(!/<text\b/.test(svg),'Furniture tracing must not reproduce source title or room schedules')
 }
})
test('plumbing source mapping is explicit at level and room granularity',()=>{
 for(const sheet of Object.keys(specs)){
   const group=specs[sheet]
   for(const room of group.rooms){
     assert(docs[group.floor].rooms.some(v=>v.number===room),sheet+' has unknown room '+room)
   }
 }
})
test('the ambiguous mark 54 is not silently invented as a sink',()=>{
 const mark54=specs['A-27'].fixtures.find(v=>v.mark==='54')
 assert.equal(mark54.status,'unresolved-row')
 assert.equal(mark54.name,null)
 assert.equal(mark54.quantity,null)
})
test('sanitary specs retain vendor identifiers from source',()=>{
 const all=Object.values(specs).flatMap(x=>x.fixtures)
 assert(all.some(x=>/Villeroy Boch o.nuovo/.test(x.name||'')))
 assert(all.some(x=>/Gessi Venti20/.test(x.name||'')))
 assert(all.some(x=>/Hansgrohe/.test(x.name||'')))
 assert(all.some(x=>/Geberit/.test(x.name||'')))
 assert.equal(all.reduce((s,v)=>s+(v.quantity??0),0),78)
})
