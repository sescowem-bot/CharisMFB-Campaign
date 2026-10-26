'use client';
import {useEffect,useRef,useState} from 'react';
import Link from 'next/link';
import {CheckCircle2,Clock3,ShieldCheck,AlertCircle,X,ArrowUpRight} from 'lucide-react';

type Outcome='submitted'|'scheduled'|'approval'|'attention'|'unavailable';
const receiptContent:Record<Outcome,{heading:string,description:string}>={
 submitted:{heading:'Campaign submitted successfully',description:'Your campaign has been submitted for delivery. You can view its progress from Campaigns. Delivery to each inbox may take additional time.'},
 scheduled:{heading:'Campaign scheduled',description:'Your campaign has been saved for the selected time. You can check its progress from Campaigns.'},
 approval:{heading:'Campaign sent for approval',description:'Your campaign has been saved and is awaiting authorisation. It has not yet been sent to customers.'},
 attention:{heading:'Campaign saved — review delivery',description:'Some messages may still need attention. Check delivery progress before taking any further action. Please do not send this campaign again.'},
 unavailable:{heading:'Campaign saved',description:'Sending is not currently available. Your campaign is saved. Check the campaign status before taking further action.'}
};
export function DirectCampaignReceipt({id,outcome='submitted'}:{id:string;outcome?:Outcome}){
 const [open,setOpen]=useState(true);
 const closeRef=useRef<HTMLButtonElement>(null);
 useEffect(()=>{
  if(!open)return;
  closeRef.current?.focus();
  const handler=(event:KeyboardEvent)=>{if(event.key==='Escape')setOpen(false);};
  document.addEventListener('keydown',handler);
  return()=>document.removeEventListener('keydown',handler);
 },[open]);
 const content=receiptContent[outcome];
 if(!open)return <p className="charis-receipt-dismissed" role="status">
  {content.heading} · <Link href={'/dashboard/communications/history?id='+id}>View campaign</Link>
 </p>;
 return <div className="charis-receipt-overlay" role="presentation">
  <section role="dialog" aria-modal="true" aria-labelledby="charis-receipt-title" aria-describedby="charis-receipt-description" className="charis-receipt-dialog">
   <button ref={closeRef} type="button" className="charis-receipt-close" onClick={()=>setOpen(false)} aria-label="Close campaign confirmation"><X size={19}/></button>
   <div className={'charis-receipt-icon'+(['attention','unavailable'].includes(outcome)?' needs-attention':'')}>
    {outcome==='attention'||outcome==='unavailable'?<AlertCircle size={34}/>:outcome==='scheduled'?<Clock3 size={34}/>:outcome==='approval'?<ShieldCheck size={34}/>:<CheckCircle2 size={34}/>}
   </div>
   <h2 id="charis-receipt-title">{content.heading}</h2>
   <p id="charis-receipt-description">{content.description}</p>
   <div className="charis-receipt-actions">
    <Link className="btn" href={'/dashboard/communications/history?id='+id}>View campaign <ArrowUpRight size={16}/></Link>
    <button type="button" className="btn secondary" onClick={()=>setOpen(false)}>Close</button>
   </div>
  </section>
 </div>;
}
