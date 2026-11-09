import {useEffect,useReducer} from 'react'
import {initialSecurity,securityReducer} from './security'
export function useSecurity(){
 const[state,dispatch]=useReducer(securityReducer,undefined,initialSecurity)
 useEffect(()=>{let previous=performance.now();const timer=window.setInterval(()=>{const now=performance.now();dispatch({type:'tick',dt:(now-previous)/1000,now:Date.now()});previous=now},50);return()=>window.clearInterval(timer)},[])
 return {state,dispatch}
}
export type SecurityController=ReturnType<typeof useSecurity>
