import * as THREE from 'three'
import type {SecurityState} from '../domain/security'
import {virtualCameras} from '../domain/security'
export function createSecurityObjects(){
 const root=new THREE.Group();root.name='security-demo-objects'
 const body=new THREE.MeshStandardMaterial({color:'#546d73',roughness:.32,metalness:.6}),glass=new THREE.MeshStandardMaterial({color:'#1b343b',roughness:.2,metalness:.65}),rubber=new THREE.MeshStandardMaterial({color:'#252a29',roughness:.9}),metal=new THREE.MeshStandardMaterial({color:'#b4b9b0',metalness:.7,roughness:.35}),white=new THREE.MeshStandardMaterial({color:'#e3ded1',roughness:.6})
 const car=new THREE.Group();car.userData={securityMotion:'car'};root.add(car)
 const box=(g:THREE.Group,w:number,h:number,d:number,x:number,y:number,z:number,m:THREE.Material)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;g.add(mesh);return mesh}
 // Bevelled silhouette rather than an imported heavy asset. Forward direction is -Z.
 const shape=new THREE.Shape();shape.moveTo(-.94,-2.1);shape.lineTo(.94,-2.1);shape.lineTo(.99,1.8);shape.quadraticCurveTo(0,2.3,-.99,1.8);shape.closePath()
 const geo=new THREE.ExtrudeGeometry(shape,{depth:.55,bevelEnabled:true,bevelThickness:.12,bevelSize:.1,bevelSegments:3,steps:1});geo.rotateX(-Math.PI/2)
 const shell=new THREE.Mesh(geo,body);shell.position.y=.4;shell.castShadow=true;car.add(shell)
 box(car,1.65,.7,2.15,0,1.13,.05,glass);box(car,1.7,.1,1.8,0,1.52,.1,body)
 for(const x of [-1,1])for(const z of [-1.35,1.35]){const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.34,.34,.20,12),rubber);wheel.rotation.z=Math.PI/2;wheel.position.set(x,.32,z);car.add(wheel);const hub=new THREE.Mesh(new THREE.CylinderGeometry(.21,.21,.215,8),metal);hub.rotation.z=Math.PI/2;hub.position.copy(wheel.position);car.add(hub)}
 const lamp=new THREE.MeshBasicMaterial({color:'#fff1c4'}),tail=new THREE.MeshBasicMaterial({color:'#b94a34'})
 for(const x of [-.68,.68]){box(car,.35,.12,.03,x,.72,-2.2,lamp);box(car,.35,.12,.03,x,.72,2.1,tail)}
 const road=box(root,6,.09,6,34,-.19,38.8,new THREE.MeshStandardMaterial({color:'#686c65',roughness:1}));road.userData={securityAccessApron:true}
 for(const camera of virtualCameras){const g=new THREE.Group();g.position.set(camera.position[0],camera.position[1],camera.position[2]);g.userData={securityCamera:camera.id};const direction=new THREE.Vector3(...camera.target).sub(g.position).normalize();g.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,-1),direction);box(g,.25,.22,.5,0,0,0,white);box(g,.16,.13,.03,0,0,-.27,glass);root.add(g);const zone=new THREE.Mesh(new THREE.RingGeometry(1.5,1.6,24),new THREE.MeshBasicMaterial({color:'#7ecab1',transparent:true,opacity:.35,depthWrite:false,side:THREE.DoubleSide}));zone.rotation.x=-Math.PI/2;zone.position.set(camera.target[0],.04,camera.target[2]);zone.userData={securityZone:camera.id};zone.visible=false;root.add(zone)}
 const indicator=box(root,.17,.08,.08,30.53,1.45,35.6,new THREE.MeshBasicMaterial({color:'#78a88d'}));indicator.userData={securityIndicator:true}
 return root
}
const carRoute=new THREE.CatmullRomCurve3([[34,38.9],[34,30.2],[30.5,26],[20.8,24.7],[15.8,22.5],[15.6,16],[18.8,11.7],[23.5,11.7]].map(([x,z])=>new THREE.Vector3(x,0,z)),false,'centripetal')
export function carPose(progress:number){const t=THREE.MathUtils.clamp(progress,0,1),p=carRoute.getPointAt(t),d=carRoute.getTangentAt(t);return{x:p.x,z:p.z,yaw:Math.atan2(-d.x,-d.z)}}
export function updateSecurityObjects(root:THREE.Object3D,s:SecurityState){
 root.traverse(o=>{
  if(o.userData.accessMotion==='gate')o.position.x=(o.userData.direction??-1)*(o.userData.travel??6.15)*s.gate
  if(o.userData.accessMotion==='garage'){o.scale.y=1-.94*s.garage;o.position.y=o.userData.liftHeight*.94*s.garage}
  if(o.userData.securityMotion==='car'){const p=carPose(s.car);o.position.set(p.x,0,p.z);o.rotation.y=p.yaw}
  if(o.userData.securityZone&&o instanceof THREE.Mesh){o.visible=s.mode!=='disarmed';(o.material as THREE.MeshBasicMaterial).color.set(s.alarm&&o.userData.securityZone==='gate'?'#ff4c35':'#7ecab1')}
  if(o.userData.securityIndicator&&o instanceof THREE.Mesh)(o.material as THREE.MeshBasicMaterial).color.set(s.alarm?'#ff4c35':s.mode==='disarmed'?'#78a88d':'#e3ba6a')
 })
}
