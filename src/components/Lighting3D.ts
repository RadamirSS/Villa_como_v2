import * as THREE from 'three'
import{lightingPlan,lightColours,roomGroups,roomIsOn,type LightingFloor,type LightKind,type LightState}from'../domain/lighting'
const ppm=36.4
const xyz=(p:number[],y=0)=>new THREE.Vector3((p[0]-600)/ppm,y,(p[1]-350)/ppm)
export function createLightingLayer(floor:LightingFloor,cutaway:boolean,wiring:boolean,exterior=false){
 const root=new THREE.Group();root.name='lighting-'+floor
 const rooms=lightingPlan.rooms.filter(r=>r.floor===floor&&(!exterior||(floor==='level-2'&&r.number===13)))
 for(const room of rooms)for(const polygon of room.fillPolygonsPt){
  const shape=new THREE.Shape();polygon.outer.forEach((p,i)=>{const v=xyz(p);i?shape.lineTo(v.x,-v.z):shape.moveTo(v.x,-v.z)});shape.closePath()
  for(const hole of polygon.holes){const path=new THREE.Path();hole.forEach((p,i)=>{const v=xyz(p);i?path.lineTo(v.x,-v.z):path.moveTo(v.x,-v.z)});path.closePath();shape.holes.push(path)}
  const geometry=new THREE.ShapeGeometry(shape);geometry.rotateX(-Math.PI/2)
  const material=new THREE.MeshBasicMaterial({color:'#ffcb61',transparent:true,opacity:.36,depthWrite:false,side:THREE.DoubleSide})
  const mesh=new THREE.Mesh(geometry,material);mesh.position.y=.012;mesh.renderOrder=-10;mesh.userData={lightRoomKey:room.id,lightingFloor:floor,roomNumber:room.number,lightRole:'room-glow'};root.add(mesh)
 }
 for(const group of lightingPlan.groups.filter(g=>g.floor===floor&&(!exterior||(floor==='level-2'&&g.room===13)))){
  const kind=group.kind as LightKind,colour=lightColours[kind],g=new THREE.Group();g.name=group.id
  const material=new THREE.MeshBasicMaterial({color:colour}),halo=new THREE.MeshBasicMaterial({color:colour,transparent:true,opacity:.22,depthWrite:false,side:THREE.DoubleSide})
  const emitterY=cutaway?.14:kind==='led'?1:kind==='wall'?1.5:2.4
  if(group.strip&&group.pointsPt.length>1){
   for(let i=1;i<group.pointsPt.length;i++){
    const a=xyz(group.pointsPt[i-1],emitterY),b=xyz(group.pointsPt[i],emitterY),length=a.distanceTo(b)
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(length,.035,.045),material);mesh.position.copy(a).lerp(b,.5);mesh.rotation.y=-Math.atan2(b.z-a.z,b.x-a.x);g.add(mesh)
   }
  }else for(const p of group.pointsPt){
   const v=xyz(p,emitterY)
   const geometry=kind==='pendant'?new THREE.SphereGeometry(.105,10,6):kind==='wall'?new THREE.TorusGeometry(.10,.025,6,12):new THREE.CylinderGeometry(kind==='led'?.065:.07,kind==='led'?.065:.07,.035,10)
   const mesh=new THREE.Mesh(geometry,material);mesh.position.copy(v);if(kind==='wall')mesh.rotation.x=Math.PI/2;g.add(mesh)
  }
  g.traverse(o=>{if(o instanceof THREE.Mesh)o.userData={lightGroupId:group.id,lightRole:'emitter',kind}})
  // A pool below each symbol makes all four categories readable without one GPU light per lamp.
  for(const p of group.pointsPt){const mesh=new THREE.Mesh(new THREE.CircleGeometry(kind==='pendant'?.6:.34,16),halo);mesh.rotation.x=-Math.PI/2;mesh.position.copy(xyz(p,.022));mesh.renderOrder=-9;mesh.userData={lightGroupId:group.id,lightRole:'halo',kind};g.add(mesh)}
  if(wiring&&group.pointsPt.length>1){const geometry=new THREE.BufferGeometry().setFromPoints(group.pointsPt.map(p=>xyz(p,.18)));const line=new THREE.Line(geometry,new THREE.LineDashedMaterial({color:'#8ab8b6',dashSize:.15,gapSize:.1,transparent:true,opacity:.8}));line.computeLineDistances();line.userData={lightGroupId:group.id,lightRole:'wiring'};g.add(line)}
  root.add(g)
 }
 return root
}
export function updateLightingVisuals(root:THREE.Object3D,state:LightState){
 root.traverse(obj=>{
  const role=obj.userData.lightRole
  if(role==='exterior-spill')obj.visible=roomIsOn(state,obj.userData.lightingFloor,obj.userData.roomNumber)
  else if(role==='room-glow'){
   obj.visible=roomIsOn(state,obj.userData.lightingFloor,obj.userData.roomNumber)
   const groups=roomGroups(obj.userData.lightingFloor,obj.userData.roomNumber),active=groups.filter(g=>state[g.id]);const accent=active.some(g=>g.kind==='pendant')?'#ffbc53':active.some(g=>g.kind==='led')?'#ffe28a':'#ffdb77'
   ;((obj as THREE.Mesh).material as THREE.MeshBasicMaterial).color.set(accent)
  }else if(role==='emitter'){
   const on=!!state[obj.userData.lightGroupId],mat=(obj as THREE.Mesh).material as THREE.MeshBasicMaterial
   mat.color.set(on?lightColours[obj.userData.kind as LightKind]:'#64726e')
  }else if(role==='halo')obj.visible=!!state[obj.userData.lightGroupId]
  else if(role==='wiring')((obj as THREE.Line).material as THREE.LineDashedMaterial).color.set(state[obj.userData.lightGroupId]?'#ffca65':'#75a0a0')
  if(obj instanceof THREE.Mesh&&obj.userData.lightingRoomKey){
   const [floor,room]=obj.userData.lightingRoomKey.split(':')
   const on=roomIsOn(state,floor as LightingFloor,Number(room)),mat=obj.material as THREE.MeshStandardMaterial
   mat.color.set(on?'#ffd18a':'#88a9a5');mat.emissive.set(on?'#ffae43':'#000000');mat.emissiveIntensity=on?1.25:0
   mat.opacity=on?.97:.62;obj.userData.lightOn=on
  }
 })
}
