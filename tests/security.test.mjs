import test from 'node:test'
import assert from 'node:assert/strict'
import {build} from 'esbuild'
const bundle=await build({stdin:{contents:`export * from './src/domain/security';export * from './src/components/Security3D';export {createExteriorContext,createPlacedGarage} from './src/components/ExteriorConcept'`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',write:false})
const m=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'))
const advance=(state,n=100)=>{for(let i=0;i<n;i++)state=m.securityReducer(state,{type:'tick',dt:.1});return state}
test('car waits for both openings, holds passage interlocks, finishes and can exit',()=>{
 let s=m.securityReducer(m.initialSecurity(),{type:'car',target:1})
 s=m.securityReducer(s,{type:'tick',dt:.1});assert.equal(s.car,0)
 s=advance(s,40);assert(s.car>0);assert.equal(s.gate,1);assert.equal(s.garage,1)
 const blocked=m.securityReducer(s,{type:'gate',open:false});assert.equal(blocked.gateTarget,true)
 s=m.securityReducer(s,{type:'car',target:null});assert.equal(s.carTarget,null)
 assert.equal(m.securityReducer(s,{type:'garage',open:false}).garageTarget,true)
 s=advance(m.securityReducer(s,{type:'car',target:1}),200);assert.equal(s.car,1);assert.equal(s.carTarget,null)
 s=advance(m.securityReducer(s,{type:'car',target:0}),200);assert.equal(s.car,0)
})
test('security requires closed access; armed commands are blocked and demo alarm is explicit',()=>{
 let s=advance(m.securityReducer(m.initialSecurity(),{type:'gate',open:true}))
 assert.equal(m.securityReducer(s,{type:'arm',mode:'away'}).mode,'disarmed')
 s=advance(m.securityReducer(s,{type:'gate',open:false}));s=m.securityReducer(s,{type:'arm',mode:'away'});assert.equal(s.mode,'away')
 assert.equal(m.securityReducer(s,{type:'gate',open:true}).gateTarget,false)
 s=m.securityReducer(s,{type:'motion'});assert.equal(s.alarm,true)
 s=m.securityReducer(s,{type:'ack'});assert.equal(s.alarm,false);assert.equal(s.mode,'away')
 s=m.securityReducer(s,{type:'arm',mode:'disarmed'});assert.equal(m.securityReducer(s,{type:'motion'}).alarm,false)
 for(let i=0;i<30;i++)s=m.securityReducer(s,{type:'motion'});assert(s.events.length<=12)
})
test('actual existing entrance and garage geometry remains animated after batching',()=>{
 const roots=[m.createExteriorContext(),m.createPlacedGarage()];let gate,garage
 for(const root of roots)root.traverse(o=>{if(o.userData.accessMotion==='gate')gate=o;if(o.userData.accessMotion==='garage')garage=o})
 assert(gate);assert(garage);const geometry=garage.children[0].geometry
 for(const root of roots)m.updateSecurityObjects(root,{...m.initialSecurity(),gate:1,garage:1})
 assert.equal(gate.position.x,3.05);assert(garage.scale.y<.1);assert.equal(garage.children[0].geometry,geometry)
})
test('car route is continuous and scene geometry finite with four virtual camera identities',()=>{
 let previous=m.carPose(0)
 for(let t=.01;t<=1;t+=.01){const next=m.carPose(t);assert(Math.hypot(next.x-previous.x,next.z-previous.z)<.6);assert(Number.isFinite(next.yaw));previous=next}
 assert(Math.abs(m.carPose(1).x-23.5)<1e-8);assert(Math.abs(m.carPose(1).z-11.7)<1e-8)
 const root=m.createSecurityObjects();let car=0,cameras=0
 root.traverse(o=>{if(o.userData.securityMotion==='car')car++;if(o.userData.securityCamera)cameras++;if(o.isMesh)for(const n of o.geometry.attributes.position.array)assert(Number.isFinite(n))})
 assert.equal(car,1);assert.equal(cameras,6)
})
test('arrival closes entrance only after clearance and schedules exactly two minutes',()=>{
 let s=m.securityReducer(m.initialSecurity(),{type:'car',target:1}),now=100000
 for(let i=0;i<200&&s.carTarget!==null;i++){
  now+=100;s=m.securityReducer(s,{type:'tick',dt:.1,now})
  if(s.car>0&&s.car<.24)assert.equal(s.gateTarget,true)
  if(s.car>=.24)assert.equal(s.gateTarget,false)
 }
 assert.equal(s.car,1);assert.equal(s.garageTarget,true);assert.equal(s.garageCloseAt,now+120000)
 const deadline=s.garageCloseAt
 s=m.securityReducer(s,{type:'tick',dt:.1,now:deadline-1});assert.equal(s.garageTarget,true)
 s=m.securityReducer(s,{type:'tick',dt:.1,now:deadline});assert.equal(s.garageTarget,false);assert.equal(s.garageCloseAt,null)
})
test('exit closes entrance after the rear of the car clears it; manual garage close cancels timer',()=>{
 let s={...m.initialSecurity(),car:1,garage:1,garageTarget:true}
 s=m.securityReducer(s,{type:'car',target:0});let now=200000
 for(let i=0;i<220&&s.carTarget!==null;i++){
  now+=100;s=m.securityReducer(s,{type:'tick',dt:.1,now})
  if(s.car>0)assert.equal(s.gateTarget,true)
 }
 assert.equal(s.car,0);assert.equal(s.gateTarget,false);assert.equal(s.garageCloseAt,now+120000)
 s=m.securityReducer(s,{type:'garage',open:false});assert.equal(s.garageCloseAt,null);assert.equal(s.garageTarget,false)
})
test('six camera installations have ground-connected mount geometry',()=>{
 const root=m.createSecurityObjects();const cameras=[]
 root.traverse(o=>{if(o.userData.securityCamera)cameras.push(o)})
 for(const installation of cameras){assert.equal(typeof installation.userData.mountBase,'number');assert(installation.children.some(o=>o.isMesh&&o.geometry.type==='CylinderGeometry'));assert(installation.children.some(o=>o.isGroup))}
})
