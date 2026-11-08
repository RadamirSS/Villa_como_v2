import test from 'node:test'
import assert from 'node:assert/strict'
import{build}from'esbuild'
const bundle=await build({stdin:{contents:`export * from './src/domain/lighting';export * from './src/components/Lighting3D';export * from './src/components/ExteriorConcept'`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false})
const m=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'))
const{lightingPlan:p,emptyLightState,setRoomLights,toggleTargets,applyLightScenario,lightScenarios,createLightingLayer,updateLightingVisuals,createExteriorConcept}=m
const roomKeys=new Set(p.rooms.map(r=>r.id)),groupIds=new Set(p.groups.map(g=>g.id))
test('all 44 rooms have explicit lighting state and source/uncertainty, not invented project circuits',()=>{
 assert.equal(roomKeys.size,44);assert.equal(groupIds.size,p.groups.length)
 for(const room of p.rooms)assert(room.fillPolygonsPt.length>0)
 for(const g of p.groups){assert(roomKeys.has(`${g.floor}:${g.room}`));assert(g.pointsPt.length>0);assert(g.pointsPt.flat().every(Number.isFinite));assert.equal(g.dimmable,false)}
 const unresolved=p.groups.filter(g=>g.evidence==='demo-unresolved');assert(unresolved.some(g=>g.floor==='level-1'&&g.room===3))
 for(const c of p.controls)for(const id of c.groups)assert(groupIds.has(id),id)
 assert(p.controls.some(c=>c.floor==='level-2'&&c.groups.includes('level-1:10.1')))
})
test('room controls, multi-group switches and scenarios share one deterministic state',()=>{
 let state=emptyLightState();state=setRoomLights(state,'level-2',12,true)
 assert.equal(p.groups.filter(g=>g.floor==='level-2'&&g.room===12&&state[g.id]).length,3)
 assert.equal(state['garage:ceiling'],false)
 const ids=['level-2:12.1','level-2:12.2'];state=toggleTargets(state,ids);assert(ids.every(id=>!state[id]));assert.equal(state['level-2:12.3'],true)
 state=toggleTargets(state,ids);assert(ids.every(id=>state[id]))
 for(const s of lightScenarios){const result=applyLightScenario(s.id);assert.deepEqual(Object.keys(result).filter(id=>result[id]).sort(),[...s.groups].sort())}
 assert(!Object.values(applyLightScenario('away')).some(Boolean));assert.equal(applyLightScenario('arrival')['garage:ceiling'],true)
})
test('all lighting meshes stay finite and on/off state changes visible room fills and emitters',()=>{
 for(const floor of ['garage','level-1','level-2','level-3']){
  const root=createLightingLayer(floor,true,true);updateLightingVisuals(root,emptyLightState())
  let fills=0;root.traverse(o=>{if(o.isMesh)for(const n of o.geometry.attributes.position.array)assert(Number.isFinite(n));if(o.userData.lightRole==='room-glow'){assert.equal(o.visible,false);fills++}})
  assert(fills>0)
  const room=p.rooms.find(r=>r.floor===floor);updateLightingVisuals(root,setRoomLights(emptyLightState(),floor,room.number,true))
  root.traverse(o=>{if(o.userData.lightRoomKey===room.id)assert.equal(o.visible,true)})
 }
})
test('individual facade panes respond to their room and garage without sharing materials or rebuilding geometry',()=>{
 const root=createExteriorConcept({floors:['level-1','level-2','level-3'],roof:true,windows:true,terrace:true,garage:true,assembled:true})
 const panes=[];root.traverse(o=>{if(o.isMesh&&o.userData.lightingRoomKey)panes.push(o)})
 assert(panes.some(o=>o.userData.lightingRoomKey==='level-2:12'))
 assert(panes.some(o=>o.userData.lightingRoomKey.startsWith('garage:')))
 const geometry=panes.map(p=>p.geometry),position=panes.map(p=>p.position.toArray())
 let state=setRoomLights(emptyLightState(),'level-2',12,true);updateLightingVisuals(root,state)
 assert(panes.filter(o=>o.userData.lightOn).every(o=>o.userData.lightingRoomKey==='level-2:12'))
 state=setRoomLights(state,'garage',3,true);state=setRoomLights(state,'garage',1,true);updateLightingVisuals(root,state)
 assert(panes.some(o=>o.userData.lightOn&&o.userData.lightingRoomKey==='garage:3'))
 let threshold=false;root.traverse(o=>{if(o.userData.lightRole==='exterior-spill')threshold=o.visible});assert(threshold)
 panes.forEach((p,i)=>{assert.equal(p.geometry,geometry[i]);assert.deepEqual(p.position.toArray(),position[i])})
 updateLightingVisuals(root,emptyLightState());assert(panes.every(o=>!o.userData.lightOn))
})
