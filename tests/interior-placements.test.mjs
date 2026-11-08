import test from 'node:test'
import assert from 'node:assert/strict'
import{readFileSync}from'node:fs'
import{build}from'esbuild'
const d=JSON.parse(readFileSync(new URL('../src/data/interior-placements.json',import.meta.url)))
const register=JSON.parse(readFileSync(new URL('../src/data/plumbing-register.json',import.meta.url)))
const out=await build({entryPoints:[new URL('../src/components/Interior3D.ts',import.meta.url).pathname],bundle:true,platform:'node',format:'esm',write:false})
const{createInterior3D}=await import('data:text/javascript;base64,'+Buffer.from(out.outputFiles[0].text).toString('base64'))
test('all placed objects use explicit source symbols, positive footprints and stable IDs',()=>{
 assert(d.items.length>=170);assert.equal(new Set(d.items.map(i=>i.id)).size,d.items.length)
 for(const i of d.items){assert(i.sourceBBoxPx.length===4);assert(i.sizeM.every(v=>v>0));assert(i.centrePt.every(Number.isFinite));assert(i.room>0)}
})
test('every plumbing schedule mark has an assembly binding, including unresolved 54',()=>{
 for(const[sheet,group]of Object.entries(register))for(const f of group.fixtures){
 const placed=d.items.filter(i=>i.specSheet===sheet&&i.specMarks.includes(f.mark))
 assert(placed.length>0,`${sheet} ${f.mark} missing`)
 if(f.quantity)assert.equal(placed.length,f.quantity,`${sheet} ${f.mark} quantity differs`)
 }
 assert(d.unresolved.some(i=>i.mark==='54'))
})
test('all four floors build actual 3D geometry with room and source bindings',()=>{
 for(const floor of ['garage','level-1','level-2','level-3']){
 const g=createInterior3D(floor);assert(g.children.length>0)
 for(const part of g.children){assert(part.userData.placementId);assert(part.children.some(c=>c.isMesh));part.traverse(m=>{if(m.isMesh)for(const n of m.geometry.attributes.position.array)assert(Number.isFinite(n))})}
 }
})

test('kitchens use their distinct PDF finish palettes and keep source identities',()=>{
 const named=(root)=>{const names=new Set();root.traverse(obj=>{if(obj.isMesh)names.add(obj.material.name)});return names}
 const main=createInterior3D('level-2',false),staff=createInterior3D('level-1',false)
 const a=named(main),b=named(staff)
 assert(a.has('A-119-grey-front'));assert(a.has('A-119-blush-terrazzo'))
 assert(b.has('A-94-grey-front'));assert(b.has('light-natural-timber'))
 assert(!b.has('A-119-blush-terrazzo'))
 for(const g of main.children.filter(g=>g.userData.roomNumber===12)){
  assert(g.userData.designSheets.includes('A-119'));assert(g.userData.placementId)
 }
})
test('kitchen detail restores full-height units without changing registered placements',()=>{
 const overview=createInterior3D('level-2',true),detail=createInterior3D('level-2',true,12)
 const overviewItems=new Map(overview.children.map(g=>[g.userData.placementId,g]))
 let fullHeight=false
 for(const g of detail.children){
  assert.deepEqual(g.position.toArray(),overviewItems.get(g.userData.placementId).position.toArray())
  if(g.userData.roomNumber===12){g.traverse(m=>{if(m.isMesh){m.geometry.computeBoundingBox();if(m.geometry.boundingBox.max.y>2.4)fullHeight=true}})}
 }
 assert(fullHeight)
})
