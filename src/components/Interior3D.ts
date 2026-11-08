import * as THREE from 'three'
import data from '../data/interior-placements.json'
export const interiorPlacements=data
const scale=36.4
const wood=new THREE.MeshStandardMaterial({color:'#ae8760',roughness:.84})
// Materials are created per scene so disposing a view does not invalidate another.
export function createInterior3D(floor:string,cutaway=false){
 const root=new THREE.Group();root.name='furnished-'+floor
 const m={wood:wood.clone(),white:new THREE.MeshStandardMaterial({color:'#eee9df',roughness:.62}),cloth:new THREE.MeshStandardMaterial({color:'#bcbcae',roughness:1}),dark:new THREE.MeshStandardMaterial({color:'#3b4543',roughness:.65}),metal:new THREE.MeshStandardMaterial({color:'#a8afab',metalness:.72,roughness:.3}),water:new THREE.MeshStandardMaterial({color:'#abc5c3',roughness:.25}),glass:new THREE.MeshPhysicalMaterial({color:'#aac6c2',transparent:true,opacity:.18,depthWrite:false,side:THREE.DoubleSide})}
 for(const item of data.items.filter(i=>i.floor===floor)){
  const g=new THREE.Group(),[w,d]=item.sizeM
  const box=(x:number,y:number,z:number,a:number,b:number,c:number,mat:THREE.Material)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(a,b,c),mat);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;g.add(mesh);return mesh}
  const oval=(x:number,y:number,z:number,a:number,h:number,b:number,mat:THREE.Material)=>{const mesh=new THREE.Mesh(new THREE.CylinderGeometry(1,1,h,24),mat);mesh.scale.set(a/2,1,b/2);mesh.position.set(x,y,z);mesh.castShadow=true;g.add(mesh)}
  const tap=(x:number,z:number)=>{box(x,.99,z,.025,.28,.025,m.metal);box(x,.112+1,z+.05,.025,.025,.12,m.metal)}
  const legs=()=>{for(const x of [-w*.39,w*.39])for(const z of [-d*.36,d*.36])box(x,.35,z,.045,.7,.045,m.wood)}
  switch(item.kind){
   case 'rug':box(0,.018,0,w,.015,d,m.cloth);break
   case 'bed':{
    box(0,.17,0,w,.32,d,m.wood);box(0,.40,0,w*.96,.20,d*.96,m.white);box(0,.515,0,w*.94,.035,d*.55,m.cloth)
    const horizontal=item.head==='west'||item.head==='east',sign=item.head==='south'||item.head==='east'?1:-1
    if(horizontal){box(sign*w*.48,.51,0,.07,.85,d,m.wood);for(const z of [-d*.24,d*.24])box(sign*w*.33,.54,z,w*.22,.12,d*.39,m.white)}
    else{box(0,.51,sign*d*.48,w,.85,.07,m.wood);for(const x of [-w*.24,w*.24])box(x,.54,sign*d*.33,w*.39,.12,d*.22,m.white)}break}
   case 'sofa':box(0,.23,0,w,.38,d,m.wood);box(0,.47,0,w*.94,.18,d*.82,m.cloth);if(item.head==='east'||item.head==='west'){box((item.head==='east'?1:-1)*w*.43,.71,0,w*.13,.55,d,m.cloth);for(const z of [-d*.46,d*.46])box(0,.58,z,w,.4,d*.08,m.cloth)}else{box(0,.71,(item.head==='south'?1:-1)*d*.43,w,.55,d*.13,m.cloth);for(const x of [-w*.46,w*.46])box(x,.58,0,w*.08,.4,d,m.cloth)}break
   case 'armchair':case 'officeChair':case 'chair':legs();box(0,.46,0,w,.11,d,m.cloth);box(0,.7,-d*.42,w,.45,.06,m.wood);break
   case 'diningTable':case 'roundTable':legs();oval(0,.76,0,w,.07,d,m.wood);break
   case 'desk':case 'island':legs();box(0,item.kind==='island'?.90:.76,0,w,.07,d,m.wood);break
   case 'coffeeTable':oval(0,.39,0,w,.07,d,m.wood);box(0,.19,0,w*.4,.34,d*.4,m.dark);break
   case 'bench':case 'nightstand':case 'console':box(0,.23,0,w,.44,d,m.wood);box(0,.47,0,w,.04,d,m.white);break
   case 'counter':if(item.polygonPt){
    const outline=new THREE.Shape();item.polygonPt.forEach((p,i)=>{const x=(p[0]-item.centrePt[0])/scale,z=-(p[1]-item.centrePt[1])/scale;i?outline.lineTo(x,z):outline.moveTo(x,z)});outline.closePath()
    for(const [height,y,mat]of [[.84,0,m.wood],[.06,.84,m.white]]as const){const geo=new THREE.ExtrudeGeometry(outline,{depth:height,bevelEnabled:false});geo.rotateX(-Math.PI/2);const mesh=new THREE.Mesh(geo,mat);mesh.position.y=y;mesh.castShadow=true;g.add(mesh)}
    break
   }box(0,.43,0,w,.84,d,m.wood);box(0,.88,0,w+.02,.06,d+.02,m.white);for(let x=-w/2+.3;x<w/2;x+=.6)box(x,.43,-d/2-.003,.008,.70,.01,m.dark);break
   case 'cabinet':case 'shelf':case 'wineRack':{
    const h=cutaway?.85:item.kind==='cabinet'?1.65:1.4;box(0,h/2,0,w,h,d,m.wood)
    if(item.kind!=='cabinet')for(let y=.18;y<h;y+=.3)box(0,y,-d*.49,w*.93,.035,.025,m.white)
    else for(let x=-w/2+.5;x<w/2;x+=.5)box(x,h/2,-d/2-.005,.008,h*.94,.01,m.dark)
    break}
   case 'hob':box(0,.94,0,w,.035,d,m.dark);for(const x of [-w*.24,w*.24])for(const z of [-d*.24,d*.24])oval(x,.965,z,w*.28,.012,d*.28,m.metal);break
   case 'washer':box(0,.43,0,w,.85,d,m.white);{const mesh=new THREE.Mesh(new THREE.TorusGeometry(Math.min(w,.6)*.28,.025,8,24),m.dark);mesh.position.set(0,.43,-d/2-.015);g.add(mesh)}break
   case 'sink':box(0,.79,0,w+.06,.09,d+.06,m.white);oval(0,.844,0,w*.74,.012,d*.65,m.water);box(0,.4,0,w*.85,.72,d*.85,m.wood);tap(w*.25,-d*.3);break
   case 'toilet':box(w*.6,.55,0,.035,.3,.035,m.metal);box(w*.6,.38,0,.018,.15,.018,m.metal);oval(0,.34,0,w,.20,d,m.white);oval(0,.45,d*.04,w*.65,.02,d*.58,m.dark);box(0,.2,-d*.2,w*.55,.34,d*.4,m.white);box(0,.75,-d*.42,w*.65,.035,.02,m.metal);break
   case 'bath':oval(0,.33,0,w,.62,d,m.white);oval(0,.65,0,w*.77,.015,d*.82,m.water);tap(w*.39,0);break
   case 'shower':box(0,.045,0,w,.08,d,m.white);box(0,.09,d*.36,w*.76,.012,.025,m.metal);box(-w*.45,1.06,0,.025,1.95,.025,m.metal);box(-w*.28,2.02,0,w*.4,.025,.025,m.metal);oval(-w*.1,2.0,0,.28,.025,.28,m.metal);box(w/2,.75,0,.012,1.4,d,m.glass);box(-w*.43,1.05,0,.055,.12,.06,m.metal);break
  }
  g.position.set((item.centrePt[0]-600)/scale,0,(item.centrePt[1]-350)/scale)
  g.userData={placementId:item.id,roomNumber:item.room,sourceSheet:item.sourceSheet,specSheet:item.specSheet,specMarks:item.specMarks,positionStatus:item.positionStatus}
  root.add(g)
 }
 return root
}
