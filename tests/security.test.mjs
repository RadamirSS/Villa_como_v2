import test from 'node:test'
import assert from 'node:assert/strict'
import {build} from 'esbuild'
import * as THREE from 'three'

const built=await build({entryPoints:['src/components/Security3D.ts'],bundle:true,platform:'node',format:'esm',write:false})
const lib=await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'))
const state={gateOpen:false,garageOpen:false,vehicleInside:false,armed:false,triggered:false,cameraId:null,nightVision:false,event:'demo'}

test('six virtual cameras and a sedan are actual 3D objects, never live feeds',()=>{
 const root=lib.createSecurityDevices()
 const ids=[];let car=null;let rings=0
 root.traverse(o=>{
  if(o.userData.securityCameraId&&o.userData.simulated)ids.push(o.userData.securityCameraId)
  if(o.userData.securityRole==='vehicle')car=o
  if(o.userData.securityRole==='motion-zone')rings++
 })
 assert.equal(new Set(ids).size,6)
 assert.equal(rings,6)
 assert(car)
 assert.equal(root.userData.hardwareConnected,false)
})

test('both gates animate independently and a vehicle cannot move through closed gates',()=>{
 const root=lib.createSecurityDevices()
 const slider=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial())
 slider.position.x=31;slider.userData={gateLeaf:'left',gateBaseX:31};root.add(slider)
 const shutter=new THREE.Group();shutter.userData={openingId:'garage-entry'};root.add(shutter)
 const motion=lib.createSecurityMotion()
 lib.animateSecurityVisuals(root,{...state,vehicleInside:true},motion,4)
 assert.equal(motion.car,0)
 lib.animateSecurityVisuals(root,{...state,gateOpen:true,garageOpen:true,vehicleInside:true},motion,3)
 assert.equal(motion.gate,1);assert.equal(motion.garage,1)
 assert(motion.car>0&&motion.car<1)
 assert(slider.position.x<31)
 assert(shutter.scale.y<.1)
 lib.animateSecurityVisuals(root,{...state,gateOpen:false,garageOpen:false},motion,3)
 assert.equal(motion.gate,0);assert.equal(motion.garage,0)
 assert.equal(slider.position.x,31)
})

test('arming highlights zones and simulated alarm highlights the entrance zone',()=>{
 const root=lib.createSecurityDevices(),motion=lib.createSecurityMotion()
 lib.animateSecurityVisuals(root,{...state,armed:true,triggered:true,cameraId:'gate'},motion,0)
 const rings=[];root.traverse(o=>{if(o.userData.securityRole==='motion-zone')rings.push(o)})
 assert(rings.every(o=>o.visible))
 assert(rings.some(o=>o.userData.securityCameraId==='gate'&&o.material.color.getHexString()==='f37063'))
 lib.animateSecurityVisuals(root,state,motion,0)
 assert(rings.every(o=>!o.visible))
})
