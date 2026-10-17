'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
const steps=[
 {title:'Welcome to Charis',detail:'Create and track customer communications in one place.',href:'/dashboard',action:'Dashboard'},
 {title:'Create Campaign',detail:'Write your message, choose recipients and send.',href:'/dashboard/communications/new',action:'Create Campaign'},
 {title:'Contacts',detail:'Find customer records or import an authorised list.',href:'/dashboard/customers',action:'Contacts'},
 {title:'Track progress',detail:'See campaign statuses and delivery outcomes.',href:'/dashboard/communications',action:'Campaigns'},
];
export function StaffGettingStarted({userId,replay=false,contactsPath='/dashboard/customers'}:{userId:string;replay?:boolean;contactsPath?:string}){
 const key='charis-tour-v1:'+userId;
 const [ready,setReady]=useState(false);const [visible,setVisible]=useState(replay);const [step,setStep]=useState(0);
 useEffect(()=>{try{setVisible(replay||localStorage.getItem(key)!=='done');}catch{setVisible(true);}setReady(true);},[key,replay]);
 const complete=()=>{try{localStorage.setItem(key,'done');}catch{}setVisible(false);};
 if(!ready)return null;
 if(!visible)return replay?<button type="button" className="btn secondary" onClick={()=>{setStep(0);setVisible(true);}}>Show getting started guide</button>:null;
 const current=step===2?{...steps[step],href:contactsPath}:steps[step];
 return <section className="panel charis-welcome-guide" aria-label="Getting started">
  <div className="workspace-heading"><h2>Getting started</h2><span className="muted">{step+1} of {steps.length}</span></div>
  <h3>{current.title}</h3><p>{current.detail}</p>
  <div className="charis-staff-quick-actions"><Link className="btn secondary" href={current.href}>{current.action} →</Link>
   {step>0&&<button type="button" className="btn secondary" onClick={()=>setStep(s=>s-1)}>Back</button>}
   {step<steps.length-1?<button type="button" className="btn" onClick={()=>setStep(s=>s+1)}>Next</button>:<button type="button" className="btn" onClick={complete}>Finish</button>}
   <button type="button" className="btn ghost" onClick={complete}>Skip</button></div>
 </section>;
}
