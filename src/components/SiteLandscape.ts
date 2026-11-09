import * as THREE from 'three'

/** Presentation landscape in metres; the site is not a surveyed landscape plan.
 * +Z is the gate/balcony frontage. Looking inward (-Z), right is +X. */
export const siteLayout = {
  gate: { centreX: 34, z: 35.3, clearWidth: 6 },
  drive: { minX: 31, maxX: 37, frontZ: 35.8, courtZ: 23 },
  parking: { minX: 7.2, maxX: 16.2, minZ: 14, maxZ: 19.4, bays: 3 },
} as const
export function createSiteLandscape() {
  const root = new THREE.Group(); root.name = 'landscaped-courtyard'
  root.userData = { surveyed: false, purpose: 'presentation-landscape', accessLevel: 'level-1' }
  const mat = (colour: string, roughness = .9, metalness = 0) => new THREE.MeshStandardMaterial({ color: colour, roughness, metalness })
  const stone = mat('#b9b09b'), edging = mat('#dfd3bb'), joints = mat('#938d7c'), asphalt = mat('#686c65')
  const gravel = mat('#acaa96'), soil = mat('#625c47'), timber = mat('#8e7050'), bronze = mat('#394841', .5, .55)
  const leaves = [mat('#536d4d'),mat('#718661'),mat('#899a75')], lavender = mat('#8b81a0'), trunk = mat('#75634d')
  const warm = new THREE.MeshBasicMaterial({ color: '#ffd69a' }); warm.name = 'site-warm-light'
  const pool = new THREE.MeshBasicMaterial({color:'#ffcf80',transparent:true,opacity:.14,depthWrite:false,side:THREE.DoubleSide}); pool.name='site-light-pool'
  const add = (geometry:THREE.BufferGeometry, material:THREE.Material,x:number,y:number,z:number,kind:string) => {
    const mesh = new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData={siteObject:kind};root.add(mesh);return mesh
  }
  const box = (x:number,z:number,w:number,d:number,h:number,base:number,m:THREE.Material,kind:string) => add(new THREE.BoxGeometry(w,h,d),m,x,base+h/2,z,kind)
  const rect = (x0:number,z0:number,x1:number,z1:number,m:THREE.Material,kind='paving',y=-.10) => box((x0+x1)/2,(z0+z1)/2,x1-x0,z1-z0,.09,y-.09,m,kind)
  const sphere = new THREE.IcosahedronGeometry(1,1)
  const bush=(x:number,z:number,r:number,y=-.15,flower=false)=>{
    const b=add(sphere.clone(),leaves[Math.abs(Math.round(x*3+z))%3],x,y+r*.6,z,'planting');b.scale.set(r,r*.75,r*.85)
    if(flower)for(let i=0;i<3;i++){const a=i*2.4;const f=add(sphere.clone(),lavender,x+Math.cos(a)*r*.6,y+r*.95,z+Math.sin(a)*r*.5,'lavender');f.scale.set(.16,.23,.16)}
  }
  const bed=(x:number,z:number,w:number,d:number)=>{
    box(x,z,w+.18,d+.18,.17,-.19,edging,'planter-edge');box(x,z,w,d,.18,-.18,soil,'planting-bed')
  }
  // Distinct, connected ground-level courts. The driveway is to the RIGHT of the garage.
  rect(-6.5,7.0,16.6,24.2,stone,'ground-level-courtyard')
  rect(16.6,20,37,28,stone,'garage-apron')
  rect(31,28,37,35.9,asphalt,'entrance-drive')
  // Frame the courts with limestone strips and subtle large-format paving joints.
  for(const [x,z,w,d]of [[-6.55,15.6,.22,17.4],[5,24.2,23.4,.22],[26.8,28,20.5,.22],[37,27,.22,17.7],[31,31.9,.22,7.8]])box(x,z,w,d,.08,-.11,edging,'stone-border')
  for(let x=-6;x<16.6;x+=1.2)rect(x,7,x+.012,24.1,joints,'paving-joint',-.098)
  for(let z=7.2;z<24.2;z+=1.2)rect(-6.4,z,16.5,z+.012,joints,'paving-joint',-.097)
  for(let x=16.8;x<37;x+=1.2)rect(x,20,x+.012,27.9,joints,'paving-joint',-.098)
  for(let z=20.4;z<28;z+=1.2)rect(16.7,z,36.9,z+.012,joints,'paving-joint',-.097)
  // Permeable parking courts, each 3m × 5.4m; no cars obstruct the garage apron.
  rect(7.2,14,16.2,19.4,gravel,'permeable-parking',-.082)
  for(let i=0;i<=3;i++)rect(7.2+i*3,14,7.25+i*3,19.4,edging,'parking-marking',-.067)
  for(let i=0;i<3;i++){
    const x=8.7+i*3
    box(x,14.55,1.65,.14,.13,-.07,edging,'wheel-stop')
    box(x,13.5,.2,.18,1.15,-.12,bronze,'ev-charger')
    box(x,13.61,.13,.02,.16,.62,warm,'charger-indicator')
    const cable=new THREE.CatmullRomCurve3([new THREE.Vector3(x+.1,.6,13.5),new THREE.Vector3(x+.3,.28,13.5),new THREE.Vector3(x+.4,.7,13.5)])
    add(new THREE.TubeGeometry(cable,8,.018,4,false),bronze,0,0,0,'charger-cable')
  }
  // A quiet pedestrian approach to the first-floor entrance, separate from parking.
  for(let z=7.8;z<24;z+=1.2)rect(-2.4,z,-.25,z+.95,edging,'entrance-walk',-.067)
  bed(3.6,10.7,4.8,1.5);for(let x=1.6;x<6;x+=.7)bush(x,10.7,.44,-.03,true)
  bed(-5.5,15.6,1.25,8.8);for(let z=11.7;z<20;z+=.8)bush(-5.5,z,.48,-.03,true)
  bed(18,25.8,2,2);bush(18,25.8,.72,-.03)
  // Ground-level gravel salon with timber bench and a mature olive as its focus.
  const circle=add(new THREE.CylinderGeometry(4.4,4.4,.07,40),gravel,-13,.0,20.5,'garden-salon');circle.position.y=-.16
  box(-13,24,4.3,.65,.14,.35,timber,'garden-bench');for(const x of [-14.5,-11.5])box(x,24,.12,.55,.55,-.15,bronze,'bench-leg')
  function olive(x:number,z:number,size=1,base=-.18){
    const t=add(new THREE.CylinderGeometry(.12*size,.22*size,2.5*size,7),trunk,x,base+1.25*size,z,'olive-trunk');t.rotation.z=.10
    for(let i=0;i<5;i++){
      const a=i*2.4,dx=Math.cos(a)*.8*size,dz=Math.sin(a)*.7*size
      const crown=add(sphere.clone(),leaves[i%3],x+dx,base+(2.8+(i%2)*.55)*size,z+dz,'olive-canopy');crown.scale.set(1.5*size,1.15*size,1.35*size)
      const end=new THREE.Vector3(dx,1.4*size,dz),branch=add(new THREE.CylinderGeometry(.055*size,.09*size,end.length(),5),trunk,x+dx/2,base+2*size,z+dz/2,'olive-branch');branch.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),end.normalize())
    }
  }
  olive(-13,19.8,1.1)
  for(const [x,z,s]of [[-18,9,1.05],[-18.8,29,.9],[-7,30,1.05],[7,30.5,.9],[22,31.5,.9],[38,13,.9],[-17,-12,1.1],[-8,-13,1.05],[3,-13,1],[14,-13,1],[28,-12,1.1]])olive(x,z,s,z<0?2.9:-.18)
  // Low clipped hedges frame views instead of hiding the villa.
  for(let z=7;z<32;z+=.85)bush(-20,z,.67)
  for(let x=-19;x<29;x+=.85)bush(x,33.2,.62)
  for(let z=2;z<31;z+=.85)bush(38.4,z,.63)
  for(let x=-17;x<-7;x+=.65)bush(x,26.8,.4,-.15,true)
  // Enclosure and wide sliding entrance, entirely right of the garage silhouette.
  for(const [a,b]of [[-21,30.6],[37.4,39.3]]){
    box((a+b)/2,35.3,b-a,.32,.55,-.22,stone,'boundary-wall')
    box((a+b)/2,35.3,b-a,.06,.68,.33,bronze,'boundary-rail')
    for(let x=a;x<b;x+=.24)box(x,35.3,.025,.05,.68,.33,bronze,'boundary-picket')
  }
  for(const x of [30.8,37.2])box(x,35.3,.42,.55,1.7,-.2,stone,'gate-pier')
  for(let z=34.7;z<=35.8;z+=1.1)rect(31,z,37,z+.12,edging,'entrance-threshold',-.065)
  // Two independently animated presentation leaves. Keep their original positions
  // so the security layer can slide them into the surrounding fence.
  for(const [leaf,left,right] of [['left',31.08,34],['right',34,36.94]] as const){
    for(let x=left+.055;x<right;x+=.19){
      const m=box(x,35.3,.037,.09,1.26,-.04,bronze,'courtyard-gate')
      m.userData={siteObject:'courtyard-gate',facing:'balcony-front-positive-z',controlBinding:null,ownerConfirmedSide:'right-of-garage',gateLeaf:leaf,gateBaseX:m.position.x}
    }
    for(const y of [.04,1.2]){
      const rail=box((left+right)/2,35.3,right-left,.07,.05,y,bronze,'gate-rail')
      rail.userData={siteObject:'gate-rail',gateLeaf:leaf,gateBaseX:rail.position.x}
    }
  }
  box(30.53,35.58,.12,.04,.28,.85,bronze,'gate-intercom')
  // Efficient decorative lighting: emissive optics + pools, no per-lamp shadow maps.
  for(const [x,z]of [[-3.2,9],[-3.2,15],[-3.2,22],[3,25.5],[14.7,25.5],[26,28.7],[30.2,32.5],[37.8,32.5],[-16,23]]){
    box(x,z,.12,.12,.72,-.16,bronze,'path-bollard');box(x,z,.16,.16,.07,.50,warm,'path-light')
    const glow=add(new THREE.CircleGeometry(1.15,20),pool,x,-.052,z,'light-pool');glow.rotation.x=-Math.PI/2;glow.castShadow=false
  }
  for(const x of [30.8,37.2])box(x,35.6,.18,.025,.5,.65,warm,'gate-light')
  for(const [leaf,direction] of [['left',-1],['right',1]] as const){
    const gate=new THREE.Group();gate.userData={accessMotion:'gate',direction,travel:3.05};root.add(gate)
    for(const child of [...root.children])if(child.userData.gateLeaf===leaf)gate.attach(child)
  }
  root.traverse(o=>{if(o.userData.siteObject==='ground-level-courtyard'||o.userData.siteObject==='parking-marking')o.userData.elevationM=0})
  return root
}
export function updateSiteTime(root:THREE.Object3D,time:'day'|'dusk'|'night',enabled=time!=='day') {
  root.traverse(o=>{if(!(o instanceof THREE.Mesh))return;for(const m of Array.isArray(o.material)?o.material:[o.material]){
    if(m.name==='site-light-pool'){o.visible=enabled;(m as THREE.MeshBasicMaterial).opacity=time==='day'?.07:time==='night'?.23:.13}
    if(m.name==='site-warm-light')(m as THREE.MeshBasicMaterial).color.set(!enabled?'#3b423c':time==='day'?'#e4c286':'#ffce86')
  }})
}
