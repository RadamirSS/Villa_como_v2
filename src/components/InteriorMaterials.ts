import * as THREE from 'three'

// Display colours visually matched to the PDF schemes, not manufacturer/RAL samples.
export const interiorPalettes = {
  mainKitchen: { sources:['A-118','A-119'], front:'#b9bab7', inset:'#aeb0ad', trim:'#d1d1cb', stone:'#c9aaa5', handle:'#353a39', timber:'#b5aa8d' },
  staffKitchen: { sources:['A-92','A-93','A-94'], front:'#c3c4c0', inset:'#b7b8b3', trim:'#d2d2cc', stone:'#e1dfd8', handle:'#343937', timber:'#b7ad90' },
  dining: { sources:['A-116','A-117'], front:'#b9bab7', table:'#deded8', upholstery:'#aaa699', stone:'#c9aaa5' },
  playroom: { sources:['A-121','A-122'], accent:'#ce98aa', timber:'#b7ad90', upholstery:'#dfdfd8' },
  atticBedroom: { sources:['A-123','A-124'], accent:'#a9bda1', timber:'#b7ad90', upholstery:'#dedfd7' },
} as const

function pattern(kind:'wood'|'stone') {
  const n=128, pixels=new Uint8Array(n*n*4)
  let seed=617
  const rand=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296}
  for(let y=0;y<n;y++)for(let x=0;x<n;x++){
    const noise=rand(), wave=Math.sin(y*.64+Math.sin(x*.07)*2)
    const v=kind==='stone'?(noise>.94?182:noise<.07?255:245):Math.round(239+wave*10+noise*5)
    const i=(y*n+x)*4;pixels[i]=pixels[i+1]=pixels[i+2]=v;pixels[i+3]=255
  }
  const map=new THREE.DataTexture(pixels,n,n,THREE.RGBAFormat)
  map.colorSpace=THREE.SRGBColorSpace;map.wrapS=map.wrapT=THREE.RepeatWrapping;map.repeat.set(kind==='stone'?3:1,kind==='stone'?3:1)
  map.magFilter=THREE.LinearFilter;map.needsUpdate=true
  return map
}
export function createInteriorMaterials(){
  const mat=(name:string,color:string,roughness=.75,map?:THREE.Texture)=>{
    const value=new THREE.MeshStandardMaterial({color,roughness,map});value.name=name;return value
  }
  const p=interiorPalettes.mainKitchen,s=interiorPalettes.staffKitchen
  return {
    wood:mat('light-natural-timber','#b7ad90',.85,pattern('wood')),
    white:mat('warm-white-ceramic','#eeeae3',.36), cloth:mat('ivory-upholstery','#d7d8ce',.95),
    cabinet:mat('light-grey-joinery','#bfc0b9'), dark:mat('graphite-hardware','#353a39',.48),
    metal:new THREE.MeshStandardMaterial({name:'brushed-steel',color:'#a5ada9',metalness:.72,roughness:.32}),
    water:mat('basin-interior','#b8c9c6',.32),
    glass:new THREE.MeshPhysicalMaterial({name:'clear-glass',color:'#aac6c2',transparent:true,opacity:.18,depthWrite:false,side:THREE.DoubleSide}),
    kitchen:mat('A-119-grey-front',p.front), inset:mat('A-119-recessed-panel',p.inset), trim:mat('A-119-frame',p.trim),
    stone:mat('A-119-blush-terrazzo',p.stone,.42,pattern('stone')),
    staff:mat('A-94-grey-front',s.front), staffInset:mat('A-94-panel',s.inset), staffStone:mat('A-94-light-worktop',s.stone,.43),
    table:mat('A-117-light-dining-top','#deded8',.5), taupe:mat('A-117-taupe-chairs','#aaa699',.95),
    pink:mat('A-121-dusty-pink','#ce98aa'), sage:mat('A-123-sage','#a9bda1'),
    sofa:mat('A-112-ivory-sofa','#deded7',.96), bed:mat('A-101-upholstered-headboard','#bdbdb4',.96),
    oven:mat('appliance-glass','#252f32',.2), brass:new THREE.MeshStandardMaterial({name:'muted-brass-tap',color:'#a6a275',roughness:.4,metalness:.65}),
  }
}
export type InteriorMaterials=ReturnType<typeof createInteriorMaterials>
