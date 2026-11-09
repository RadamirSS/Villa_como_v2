import raw from '../data/lighting-plan.json'
export type LightingFloor='garage'|'level-1'|'level-2'|'level-3'
export type LightKind='ceiling'|'pendant'|'wall'|'led'
export type LightState=Record<string,boolean>
export type TimeOfDay='day'|'dusk'|'night'
export const lightingPlan=raw
export type LightingGroup=typeof raw.groups[number]
export const kindLabels:Record<LightKind,string>={ceiling:'Потолочные',pendant:'Люстра / подвес',wall:'Бра',led:'LED-подсветка'}
export const lightColours:Record<LightKind,string>={ceiling:'#ffedb5',pendant:'#ffc15a',wall:'#ffd38b',led:'#ffe9a3'}
export const emptyLightState=():LightState=>Object.fromEntries(raw.groups.map(g=>[g.id,false]))
export function roomGroups(floor:LightingFloor,room:number){return raw.groups.filter(g=>g.floor===floor&&g.room===room)}
export function roomIsOn(state:LightState,floor:LightingFloor,room:number){return roomGroups(floor,room).some(g=>state[g.id])}
export function setRoomLights(state:LightState,floor:LightingFloor,room:number,on:boolean){return{...state,...Object.fromEntries(roomGroups(floor,room).map(g=>[g.id,on]))}}
export function toggleTargets(state:LightState,ids:readonly string[]):LightState{
 const valid=ids.filter(id=>Object.hasOwn(state,id)),on=!valid.every(id=>state[id])
 return{...state,...Object.fromEntries(valid.map(id=>[id,on]))}
}
export const lightScenarios=[
 {id:'arrival',name:'Возвращение',description:'Въезд, гараж, прихожие и путь к жилому этажу.',time:'dusk',groups:['garage:ceiling','garage:perimeter','level-1:10.1','level-1:10.2','level-1:15.1','level-2:1.1','level-2:9.1']},
 {id:'evening',name:'Вечер',description:'Мягкий свет гостиной, витрин кухни и балкона.',time:'dusk',groups:['level-2:8.5','level-2:8.7','level-2:8.8','level-2:12.3','level-2:11.2','level-2:Б.1','level-1:16.3']},
 {id:'dinner',name:'Ужин',description:'Люстра столовой, витрины и свет кухни.',time:'night',groups:['level-2:11.1','level-2:11.2','level-2:12.3','level-2:8.7']},
 {id:'night-route',name:'Ночной маршрут',description:'Коридоры и лестница без общего света спален.',time:'night',groups:['level-3:1.1','level-2:1.2','level-2:8.7','level-1:10.2']},
 {id:'away',name:'Ушли из дома',description:'Выключение всех групп дома и гаража.',time:'night',groups:[]},
] as const
export function applyLightScenario(id:string):LightState{
 const scenario=lightScenarios.find(s=>s.id===id)
 if(!scenario)throw new Error('Unknown lighting scenario: '+id)
 const state=emptyLightState();for(const key of scenario.groups){if(!Object.hasOwn(state,key))throw new Error('Missing source group '+key);state[key]=true}return state
}
function inside(p:number[],ring:number[][]){let result=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])result=!result}return result}
function edgeDistance(p:number[],a:number[],b:number[]){const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy)}
// Source-informed facade binding, kept explicit on each pane. Not a room/window BIM certificate.
export function roomForWindow(floor:LightingFloor,p:number[],inward:number[]=[0,0]){
 const probe=[p[0]+inward[0]*12,p[1]+inward[1]*12]
 const rooms=raw.rooms.filter(r=>r.floor===floor&&!(floor==='level-2'&&r.number===13))
 return rooms.map(r=>({room:r,d:inside(probe,r.polygonPt)?0:Math.min(...r.polygonPt.map((a,i)=>edgeDistance(probe,a,r.polygonPt[(i+1)%r.polygonPt.length])))})).sort((a,b)=>a.d-b.d)[0]?.room.id??null
}
