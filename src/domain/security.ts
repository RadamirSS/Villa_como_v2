import {useCallback,useState} from 'react'

export const cameraStations = [
 {id:'gate',name:'Въезд',position:[30.55,2.15,35.6],target:[34,0.9,31]},
 {id:'garage',name:'Гараж',position:[15.4,3.25,22.3],target:[19.3,1.3,12]},
 {id:'entry',name:'Главный вход',position:[-3.7,3.4,23],target:[-1,1.2,16]},
 {id:'terrace',name:'Терраса',position:[8,6.3,11],target:[6,3,17]},
 {id:'garden',name:'Сад',position:[-17.8,3.6,29],target:[-13,1,20]},
 {id:'rear',name:'Задний периметр',position:[14,7,-6],target:[7,3,0]},
] as const
export type CameraId=typeof cameraStations[number]['id']
export interface SecurityState {
 gateOpen:boolean
 garageOpen:boolean
 vehicleInside:boolean
 armed:boolean
 triggered:boolean
 cameraId:CameraId|null
 nightVision:boolean
 event:string
}
const initial:SecurityState={gateOpen:false,garageOpen:false,vehicleInside:false,armed:false,triggered:false,cameraId:null,nightVision:false,event:'Система готова к демонстрации'}
export const isCameraId=(id:string):id is CameraId=>cameraStations.some(camera=>camera.id===id)
export function useSecurityDemo(){
 const[state,setState]=useState<SecurityState>(initial)
 const setGate=useCallback((open:boolean)=>setState(s=>({...s,gateOpen:open,armed:open?false:s.armed,triggered:open?false:s.triggered,event:open?'Въездные ворота открываются':'Въездные ворота закрываются'})),[])
 const setGarage=useCallback((open:boolean)=>setState(s=>({...s,garageOpen:open,armed:open?false:s.armed,event:open?'Ворота гаража открываются':'Ворота гаража закрываются'})),[])
 const setCamera=useCallback((id:CameraId|null)=>setState(s=>({...s,cameraId:id,event:id?'Выбрана виртуальная камера':'Общий вид'})),[])
 const setNightVision=useCallback((on:boolean)=>setState(s=>({...s,nightVision:on})),[])
 const driveIn=useCallback(()=>setState(s=>({...s,armed:false,triggered:false,gateOpen:true,garageOpen:true,vehicleInside:true,event:'Автомобиль въезжает на территорию'})),[])
 const driveOut=useCallback(()=>setState(s=>({...s,armed:false,triggered:false,gateOpen:true,garageOpen:true,vehicleInside:false,event:'Автомобиль покидает территорию'})),[])
 const arm=useCallback(()=>setState(s=>({...s,armed:true,triggered:false,gateOpen:false,garageOpen:false,cameraId:null,event:'Периметр поставлен на охрану'})),[])
 const disarm=useCallback(()=>setState(s=>({...s,armed:false,triggered:false,event:'Охрана снята'})),[])
 const simulateMotion=useCallback(()=>setState(s=>({...s,armed:true,gateOpen:false,garageOpen:false,triggered:true,cameraId:'gate',event:'ДЕМО: движение у въезда — тревога'})),[])
 const clearAlarm=useCallback(()=>setState(s=>({...s,triggered:false,event:'Тревога сброшена'})),[])
 return{state,setGate,setGarage,setCamera,setNightVision,driveIn,driveOut,arm,disarm,simulateMotion,clearAlarm}
}
export type SecurityController=ReturnType<typeof useSecurityDemo>
