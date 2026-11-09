import { tx } from '../i18n'
import {useEffect,useId,useRef,type ReactNode} from 'react'
export type ShowroomPanel='menu'|'scenarios'|'rooms'|'security'|'view'|'plans'|'passport'|null
export default function OverlayPanel({title,onClose,children,wide=false}:{title:string;onClose:()=>void;children:ReactNode;wide?:boolean}){
 const dialog=useRef<HTMLDialogElement>(null),titleId=useId()
 const closeRef=useRef(onClose);closeRef.current=onClose
 useEffect(()=>{const node=dialog.current;if(!node)return;const opener=document.activeElement instanceof HTMLElement?document.activeElement:null;const previous=document.body.style.overflow;document.body.style.overflow='hidden';node.showModal();return()=>{node.close();document.body.style.overflow=previous;const target=opener?.isConnected?opener:document.querySelector<HTMLElement>('[data-menu-trigger]');target?.focus({preventScroll:true})}},[])
 return <dialog ref={dialog} className={'showroom-panel'+(wide?' panel-wide':'')} aria-labelledby={titleId} onCancel={event=>{event.preventDefault();closeRef.current()}} onClick={event=>{if(event.target===event.currentTarget)closeRef.current()}}>
  <div className="panel-surface"><header className="panel-heading"><div><span>VILLA COMO</span><h2 id={titleId}>{tx(title)}</h2></div><button className="icon-button" aria-label={tx("Закрыть панель")} onClick={onClose}>×</button></header><div className="panel-body">{tx(children)}</div></div>
 </dialog>
}
