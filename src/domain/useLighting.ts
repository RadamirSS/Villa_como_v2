import {useCallback,useEffect,useState} from 'react'
import {applyLightScenario,emptyLightState,lightScenarios,lightingPlan,setRoomLights,toggleTargets,type LightState,type LightingFloor,type TimeOfDay}from './lighting'
const storageKey='villa-como-lighting-v1'
function restore(){try{const saved=JSON.parse(localStorage.getItem(storageKey)??'null');if(saved?.version===1)return{...emptyLightState(),...Object.fromEntries(lightingPlan.groups.map(g=>[g.id,saved.state?.[g.id]===true]))}}catch{/* A disabled storage provider must not block the demo. */}return emptyLightState()}
export function useLighting(){
 const[state,setState]=useState<LightState>(restore),[time,setTime]=useState<TimeOfDay>('dusk'),[scenario,setScenario]=useState<string|null>(null),[wiring,setWiring]=useState(false)
 useEffect(()=>{try{localStorage.setItem(storageKey,JSON.stringify({version:1,state}))}catch{/* Persistence is optional. */}},[state])
 const toggleGroup=useCallback((id:string)=>{setState(s=>toggleTargets(s,[id]));setScenario(null)},[])
 const toggleControl=useCallback((ids:readonly string[],forceOn=false)=>{setState(s=>forceOn?{...s,...Object.fromEntries(ids.filter(id=>Object.hasOwn(s,id)).map(id=>[id,true]))}:toggleTargets(s,ids));setScenario(null)},[])
 const setRoom=useCallback((floor:LightingFloor,room:number,on:boolean)=>{setState(s=>setRoomLights(s,floor,room,on));setScenario(null)},[])
 const applyScenario=useCallback((id:string)=>{const preset=lightScenarios.find(s=>s.id===id);if(!preset)return;setState(applyLightScenario(id));setTime(preset.time);setScenario(id)},[])
 const setAll=useCallback((on:boolean)=>{setState(Object.fromEntries(lightingPlan.groups.map(g=>[g.id,on])));setScenario(null)},[])
 return {state,time,setTime,scenario,wiring,setWiring,toggleGroup,toggleControl,setRoom,applyScenario,setAll}
}
export type LightingController=ReturnType<typeof useLighting>
