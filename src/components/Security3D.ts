import * as THREE from 'three'
import {cameraStations,type SecurityState} from '../domain/security'

/** Entirely synthetic showroom equipment. The scene contains no live camera or actuator connection. */
export interface SecurityMotion {gate:number;garage:number;car:number}
export const createSecurityMotion=():SecurityMotion=>({gate:0,garage:0,car:0})
const route=new THREE.CatmullRomCurve3([
 new THREE.Vector3(34,0,38.9),new THREE.Vector3(34,0,30.2),
 new THREE.Vector3(30.5,0,26.0),new THREE.Vector3(20.8,0,24.7),
 new THREE.Vector3(15.8,0,22.5),new THREE.Vector3(15.6,0,16),
 new THREE.Vector3(18.8,0,11.7),new THREE.Vector3(23.5,0,11.7)
],false,'centripetal',.35)
const bodyMat=new THREE.MeshStandardMaterial({color:'#b9beb8',metalness:.58,roughness:.31})
const glassMat=new THREE.MeshStandardMaterial({color:'#283e41',metalness:.28,roughness:.22})
const tireMat=new THREE.MeshStandardMaterial({color:'#222a2b',roughness:.93})
const trimMat=new THREE.MeshStandardMaterial({color:'#28322e',metalness:.43,roughness:.38})

export function createSecurityDevices(){
 const root=new THREE.Group();root.name='synthetic-smart-security'
 root.userData={showroomDemo:true,hardwareConnected:false}
 const cameraShell=new THREE.MeshStandardMaterial({color:'#e4e1d7',roughness:.44,metalness:.2})
 const cameraDark=new THREE.MeshStandardMaterial({color:'#263832',metalness:.35,roughness:.4})
 for(const station of cameraStations){
  const cam=new THREE.Group()
  cam.name='virtual-camera-'+station.id;cam.position.set(station.position[0],station.position[1],station.position[2])
  const dir=new THREE.Vector3(...station.target).sub(new THREE.Vector3(...station.position)).normalize()
  const mount=new THREE.Mesh(new THREE.CylinderGeometry(.055,.055,.3,8),cameraDark)
  mount.rotation.z=Math.PI/2;mount.position.y=-.13;cam.add(mount)
  const shell=new THREE.Mesh(new THREE.BoxGeometry(.38,.22,.31),cameraShell)
  shell.userData={securityCameraId:station.id,simulated:true}
  cam.add(shell)
  const lens=new THREE.Mesh(new THREE.CylinderGeometry(.085,.085,.035,12),cameraDark)
  lens.rotation.x=Math.PI/2;lens.position.z=.17;lens.userData={securityCameraId:station.id,simulated:true};cam.add(lens)
  const led=new THREE.Mesh(new THREE.SphereGeometry(.045,8,6),new THREE.MeshBasicMaterial({color:'#75a68a'}))
  led.position.set(.15,.1,.1);led.userData={securityRole:'camera-led',securityCameraId:station.id};cam.add(led)
  cam.lookAt(cam.position.clone().add(dir))
  root.add(cam)
  const ring=new THREE.Mesh(new THREE.RingGeometry(1.9,2.02,40),new THREE.MeshBasicMaterial({color:'#7ecab1',side:THREE.DoubleSide,transparent:true,opacity:.44,depthWrite:false}))
  ring.rotation.x=-Math.PI/2;ring.position.set(station.target[0],.035,station.target[2])
  ring.userData={securityRole:'motion-zone',securityCameraId:station.id}
  ring.visible=false;root.add(ring)
 }
 const car=new THREE.Group();car.name='demo-electric-sedan';car.userData={securityRole:'vehicle',simulated:true}
 const add=(geometry:THREE.BufferGeometry,material:THREE.Material,x:number,y:number,z:number)=>{
   const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.castShadow=true;car.add(mesh);return mesh
 }
 add(new THREE.BoxGeometry(1.92,.38,4.1),bodyMat,0,.65,0)
 add(new THREE.BoxGeometry(1.77,.28,3.9),bodyMat,0,.91,0)
 add(new THREE.BoxGeometry(1.62,.48,2.15),glassMat,0,1.25,-.10)
 add(new THREE.BoxGeometry(1.55,.09,1.86),bodyMat,0,1.53,-.13)
 for(const x of [-1,1])for(const z of [-1.30,1.30]){
  const wheel=add(new THREE.CylinderGeometry(.39,.39,.20,16),tireMat,x,.40,z)
  wheel.rotation.z=Math.PI/2
  const cap=add(new THREE.CylinderGeometry(.20,.20,.205,12),trimMat,x+(x>0?.012:-.012),.40,z)
  cap.rotation.z=Math.PI/2
 }
 const white=new THREE.MeshBasicMaterial({color:'#f9e8be'})
 const red=new THREE.MeshBasicMaterial({color:'#a83730'})
 for(const x of [-.69,.69]){add(new THREE.BoxGeometry(.4,.14,.05),white,x,.76,2.09);add(new THREE.BoxGeometry(.42,.12,.055),red,x,.75,-2.09)}
 car.position.copy(route.getPoint(0));root.add(car)
 return root
}
const approach=(value:number,target:number,delta:number)=>Math.abs(value-target)<=delta?target:value+Math.sign(target-value)*delta

/** Applies every visual state to the current scene without rebuilding the house or camera. */
export function animateSecurityVisuals(scene:THREE.Object3D,state:SecurityState,motion:SecurityMotion,dtSeconds:number){
 const g=approach(motion.gate,state.gateOpen?1:0,dtSeconds/2.0)
 const h=approach(motion.garage,state.garageOpen?1:0,dtSeconds/2.6)
 const canMove=state.gateOpen&&state.garageOpen&&g>.88&&h>.88
 const c=approach(motion.car,state.vehicleInside?1:0,canMove?dtSeconds/9.5:0)
 const moved=g!==motion.gate||h!==motion.garage||c!==motion.car
 motion.gate=g;motion.garage=h;motion.car=c
 scene.traverse(obj=>{
  if(obj.userData.gateLeaf&&obj instanceof THREE.Mesh){
   obj.position.x=obj.userData.gateBaseX+(obj.userData.gateLeaf==='left'?-3.05:3.05)*g
  }
  if(obj.userData.openingId==='garage-entry'){
   // The source-informed opening stays open; only its synthetic shutter retracts.
   obj.scale.y=Math.max(.015,1-h);obj.position.y=2.34*h
  }
  if(obj.userData.securityRole==='vehicle'&&obj instanceof THREE.Group){
   obj.position.copy(route.getPoint(c))
   const tangent=route.getTangent(Math.min(.9999,c)).normalize()
   obj.rotation.y=Math.atan2(tangent.x,tangent.z)
  }
  if(obj.userData.securityRole==='motion-zone'&&obj instanceof THREE.Mesh){
   obj.visible=state.armed
   ;(obj.material as THREE.MeshBasicMaterial).color.set(state.triggered&&obj.userData.securityCameraId==='gate'?'#f37063':'#7ecab1')
  }
  if(obj.userData.securityRole==='camera-led'&&obj instanceof THREE.Mesh){
   ;(obj.material as THREE.MeshBasicMaterial).color.set(state.triggered&&obj.userData.securityCameraId==='gate'?'#ff443b':state.cameraId===obj.userData.securityCameraId?'#f6d88f':'#75a68a')
  }
 })
 return moved
}
