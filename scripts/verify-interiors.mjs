import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
import { gunzipSync } from 'node:zlib'
const read = (name) => JSON.parse(readFileSync(`src/data/${name}.json`,'utf8'))
const furniture=read('furniture-vectors')
const details=read('plumbing-vectors')
const groups=read('plumbing-register')
const plans=read('architectural-plans').floors
const project=read('project')
const expected={garage:'A-18','level-1':'A-19','level-2':'A-20','level-3':'A-21'}
function verifySvg(data,sheet){
  assert(typeof data==='string' && data.length>1000,`Missing SVG ${sheet}`)
  const svg=gunzipSync(Buffer.from(data,'base64')).toString('utf8')
  assert(svg.startsWith('<svg '),`Invalid SVG ${sheet}`)
  assert(svg.includes('data-source-art="not-millimetre-BIM"'))
  assert(!/<script|<foreignObject|<image\b/i.test(svg),'Source PDF media or executable markup forbidden: '+sheet)
  assert(!svg.includes('Italy, Como')&&!svg.includes('МÈTRE'),'Do not redistribute PDF title block')
  return svg
}
for(const floor of project.floors){
  const svg=verifySvg(furniture[floor.id],expected[floor.id])
  assert(svg.includes(`data-source-page="${Number(expected[floor.id].slice(2))}"`))
  const viewBox = /viewBox="0 0 ([0-9.]+) ([0-9.]+)"/.exec(svg)
  assert(viewBox && Math.abs(Number(viewBox[1]) - plans[floor.id].viewport.width) < .002 && Math.abs(Number(viewBox[2]) - plans[floor.id].viewport.height) < .002,'Floor plan image not registered to architecture viewport')
  assert.equal(floor.geometry,null,'Do not claim vector furniture art is semantic millimetre placement')
  assert.equal(floor.status,'draft')
}
assert.deepEqual(Object.keys(groups),['A-22','A-23','A-24','A-25','A-26','A-27','A-28','A-29'])
const all=Object.values(groups).flatMap(g=>g.fixtures)
assert.equal(all.length,75,'All numbered source marks, including unresolved 54, must be accounted for')
assert.equal(all.reduce((s,v)=>s+(v.quantity??0),0),78,'Exact sum of specified quantities')
assert.equal(new Set(all.map(v=>v.mark)).size,all.length,'Fixture marks must be unique')
assert.deepEqual([...new Set(all.map(v=>Number.parseInt(v.mark,10)))].sort((a,b)=>a-b),Array.from({length:75},(_,i)=>i+1))
for(const [sheet,g] of Object.entries(groups)){
  const svg=verifySvg(details[sheet],sheet)
  assert(svg.includes(`data-source-page="${g.page}"`))
  const level=plans[g.floor]
  assert(level,'Unknown floor referenced by '+sheet)
  for(const room of g.rooms)assert(level.rooms.some(r=>r.number===room),'Plumbing source must map to actual room '+sheet+'/'+room)
  for(const item of g.fixtures){assert.equal(item.sheet,sheet);assert(['specified','unresolved-row'].includes(item.status))}
}
const missing=all.filter(x=>x.status==='unresolved-row')
assert.deepEqual(missing.map(x=>x.mark),['54'],'Missing spec row must remain visibly unresolved')
console.log('Stage 2 verified: 4 source-registered furniture SVGs, 8 plumbing plans, 75 marks (1 unresolved), 78 specified fixtures, no fabricated per-item geometry.')
