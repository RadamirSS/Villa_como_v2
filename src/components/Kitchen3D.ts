import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { InteriorMaterials } from './InteriorMaterials'

type Item={floor:string;room:number;kind:string;sizeM:number[];sourceBBoxPx:number[]}
// All geometry remains relative to the existing A-19/A-20 placement, not room centroids.
export function createKitchenItem(item:Item,cutaway:boolean,m:InteriorMaterials):THREE.Group|null {
 const main=item.floor==='level-2'&&item.room===12,staff=item.floor==='level-1'&&item.room===16
 if(!main&&!staff)return null
 if(!['counter','island','chair','sink','hob'].includes(item.kind))return null
 const g=new THREE.Group(),[w,d]=item.sizeM
 const body=main?m.kitchen:m.staff, inset=main?m.inset:m.staffInset, stone=main?m.stone:m.staffStone
 const box=(parent:THREE.Group,x:number,y:number,z:number,a:number,b:number,c:number,mat:THREE.Material,name='')=>{
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(a,b,c),mat);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;mesh.name=name;parent.add(mesh);return mesh
 }
 // A front faces local +Z. The same module can face any wall without turned handles.
 const panel=(parent:THREE.Group,x:number,y:number,z:number,a:number,b:number,drawer=false)=>{
  box(parent,x,y,z,a,b,.035,body,'painted-front')
  if(main){
   box(parent,x,y,z+.022,a-.085,b-.085,.012,inset,'recessed-panel')
   for(const q of [-1,1]){box(parent,x+q*(a/2-.027),y,z+.032,.038,b,.028,m.trim,'shaker-stile');box(parent,x,y+q*(b/2-.027),z+.032,a-.04,.038,.028,m.trim,'shaker-rail')}
  }
  box(parent,x,drawer?y+b*.23:y+b*.35,z+.061,Math.min(.16,a*.36),.018,.028,m.dark,'dark-pull')
 }
 const run=(parent:THREE.Group,length:number,depth:number,height:number,tall=false,appliances=false)=>{
  box(parent,0,height/2,0,length,height,depth,body,'cabinet-case')
  box(parent,0,.055,depth/2+.006,length-.035,.11,.025,m.dark,'recessed-plinth')
  if(!tall)box(parent,0,height+.025,0,length+.025,.05,depth+.045,stone,'worktop')
  const count=Math.max(1,Math.round(length/.59)),a=length/count
  for(let i=0;i<count;i++){
   const x=-length/2+a*(i+.5),z=depth/2+.012
   if(appliances&&i===count-1&&height>1.6){
    panel(parent,x,.42,z,a-.012,.63)
    for(const y of [.98,1.57]){box(parent,x,y,z+.012,a-.04,.48,.047,m.dark,'built-in-oven');box(parent,x,y-.025,z+.04,a-.13,.31,.012,m.oven,'oven-window');box(parent,x,y+.16,z+.07,a-.13,.018,.025,m.metal,'oven-handle')}
    panel(parent,x,height-.22,z,a-.012,.4)
   }else if(tall){
    const split=height>.95?height*.28:height*.48
    panel(parent,x,split/2+.09,z,a-.012,split-.025)
    panel(parent,x,(height+split)/2+.04,z,a-.012,Math.max(.15,height-split-.1))
   }else if(i%3===1){
    for(let j=0;j<3;j++)panel(parent,x,.13+(height-.15)/3*(j+.5),z,a-.012,(height-.15)/3-.014,true)
   }else panel(parent,x,(height+.12)/2,z,a-.012,height-.14)
  }
 }
 const orient=(length:number,depth:number,angle:number,height=.84,tall=false,appliances=false,x=0,z=0)=>{
  const part=new THREE.Group();part.position.set(x,0,z);part.rotation.y=angle;g.add(part);run(part,length,depth,height,tall,appliances);return part
 }
 const upper=(length:number,depth:number,angle:number,x=0,z=0)=>{
  // Full-height fitted units are visible in the kitchen detail/source view, not in the control cutaway.
  if(cutaway)return
  const part=new THREE.Group();part.position.set(x,1.48,z);part.rotation.y=angle;g.add(part)
  box(part,0,.4,0,length,.8,depth,main?body:m.wood,'upper-case')
  const count=Math.max(1,Math.round(length/.55)),a=length/count
  for(let i=0;i<count;i++){
   const q=-length/2+(i+.5)*a
   if(main){panel(part,q,.4,depth/2+.012,a-.012,.78);box(part,q,.4,depth/2+.048,a-.10,.65,.018,m.glass,'glazed-upper');for(const y of [.19,.41,.63])box(part,q,y,depth/2+.061,a-.12,.012,.012,m.trim,'glass-shelf')}
   else {box(part,q,.4,depth/2+.02,a-.012,.78,.035,m.wood,'timber-upper-front');box(part,q,.07,depth/2+.05,.14,.018,.025,m.dark,'upper-pull')}
  }
 }
 const height=cutaway?.85:2.45
 switch(item.kind){
  case 'counter':if(main){
   if(w>d){
    orient(w,d,0)
    // The short west return between the north run and the tall bank (visible on A-20).
    const returnLength=76*1190.52001953125/1800/36.4
    orient(returnLength,d,Math.PI/2,.84,false,false,-w/2+d/2,d/2+returnLength/2)
    upper(returnLength,.34,Math.PI/2,-w/2+d/2,d/2+returnLength/2)
   }else if(item.sourceBBoxPx[0]<1500){
    orient(d,w,Math.PI/2,height,true,true)
   }else{
    // A-118: sink run, refrigerator tower at the pier, then the peninsula-side run.
    const units=d/(530-249),north=(333-249)*units,tower=(403-333)*units,south=(530-403)*units
    orient(north,w,-Math.PI/2,.84,false,false,0,-d/2+north/2)
    orient(tower,w,-Math.PI/2,height,true,false,0,-d/2+north+tower/2)
    orient(south,w,-Math.PI/2,.84,false,false,0,d/2-south/2)
    upper(Math.min(.8,south),.34,-Math.PI/2,0,d/2-south/2)
   }
  }else{
   // A-94: fridge and oven columns bookend a grey base run; timber wall units.
   const tower=Math.min(.55,w*.18),middle=w-tower*2
   orient(tower,d,0,height,true,false,-w/2+tower/2)
   orient(tower,d,0,height,true,true,w/2-tower/2)
   orient(middle,d,0)
   upper(middle,.34,0)
  }break
  case 'island':{
   box(g,0,.9,0,w,.06,d,stone,'blush-peninsula-top')
   box(g,-w*.28,.44,0,w*.32,.86,d*.78,body,'peninsula-support')
   for(const x of [-w*.42,w*.42])box(g,x,.44,d*.33,.045,.86,.045,m.metal,'slim-support')
   break
  }
  case 'chair':{
   if(main&&item.sourceBBoxPx[1]>415)g.rotation.y=Math.PI
   // A-119 light bentwood counter stools, distinct from upholstered dining chairs.
   const seat=Math.min(w,d)*.94
   const disc=new THREE.Mesh(new THREE.CylinderGeometry(seat/2,seat/2,.055,24),m.wood);disc.position.y=main?.62:.46;g.add(disc)
   const h=main?.59:.43
   for(const x of [-w*.3,w*.3])for(const z of [-d*.3,d*.3])box(g,x,h/2,z,.028,h,.028,m.wood,'bentwood-leg')
   const ring=new THREE.Mesh(new THREE.TorusGeometry(seat*.38,.012,6,24),m.wood);ring.rotation.x=Math.PI/2;ring.position.y=h*.45;g.add(ring)
   box(g,0,h+.2,-d*.36,w*.78,.12,.035,m.wood,'bentwood-back')
   break
  }
  case 'sink':{
   // Inset kitchen bowl: no extra freestanding bathroom vanity over the kitchen run.
   box(g,0,.895,0,w,.013,d,m.metal,'inset-sink-rim')
   box(g,0,.902,0,w*.84,.014,d*.75,m.oven,'sink-bowl')
   const tap=main?m.brass:m.metal
   box(g,w*.35,1.06,0,.025,.32,.025,tap,'kitchen-tap');box(g,w*.22,1.21,0,w*.29,.025,.025,tap,'tap-spout')
   break
  }
  case 'hob':{
   box(g,0,.906,0,w,.018,d,m.oven,'inset-hob')
   for(const x of [-w*.24,w*.24])for(const z of [-d*.24,d*.24]){
    const ring=new THREE.Mesh(new THREE.TorusGeometry(w*.145,.006,5,20),m.metal);ring.rotation.x=Math.PI/2;ring.position.set(x,.918,z);g.add(ring)
   }break
  }
 }
 g.userData={designSheets:main?['A-118','A-119']:['A-92','A-93','A-94'],materialInterpretation:'visually-matched-pdf-scheme',cutaway}
 // Batch each object by material, retaining placement/room identity on its parent.
 g.updateMatrixWorld(true)
 const batches=new Map<THREE.Material,THREE.BufferGeometry[]>()
 g.traverse(obj=>{if(obj instanceof THREE.Mesh){const mat=obj.material as THREE.Material;const geo=obj.geometry.clone();geo.applyMatrix4(obj.matrixWorld);const list=batches.get(mat)??[];list.push(geo);batches.set(mat,list);obj.geometry.dispose()}})
 const result=new THREE.Group();result.userData={...g.userData};result.name=main?'A-119-main-kitchen':'A-94-staff-kitchen'
 for(const[mat,geos]of batches){const geo=mergeGeometries(geos,false)!;const mesh=new THREE.Mesh(geo,mat);mesh.castShadow=true;mesh.receiveShadow=true;result.add(mesh);geos.forEach(v=>v.dispose())}
 return result
}
