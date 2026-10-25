'use client';
import {useState} from 'react';
import {Monitor,Smartphone,RefreshCcw,Eye} from 'lucide-react';
import type {DirectPreview} from '@/lib/direct/preview';
import './direct-email-preview.css';

export function DirectEmailPreview({preview,finalReview=false}:{preview:DirectPreview;finalReview?:boolean}){
 const [device,setDevice]=useState<'desktop'|'mobile'>('desktop');
 const [revision,setRevision]=useState(0);
 const [loaded,setLoaded]=useState(false);
 return <section className="charis-direct-preview" aria-label={finalReview?'Final email preview':'Campaign email preview'}>
  <header className="charis-direct-preview-heading">
   <div className="charis-direct-preview-title"><Eye size={18}/><div><strong>{finalReview?'Final email — before sending':'Email preview'}</strong><small>What recipients will see · {preview.sampleName}</small></div></div>
   <div role="group" aria-label="Email preview display" className="charis-direct-preview-devices">
    <button type="button" aria-pressed={device==='desktop'} onClick={()=>{setLoaded(false);setDevice('desktop');}}><Monitor size={15}/> Desktop</button>
    <button type="button" aria-pressed={device==='mobile'} onClick={()=>{setLoaded(false);setDevice('mobile');}}><Smartphone size={15}/> Mobile</button>
    <button type="button" onClick={()=>{setLoaded(false);setRevision(v=>v+1);}} aria-label="Reload email preview"><RefreshCcw size={15}/></button>
   </div>
  </header>
  <div className="charis-direct-preview-subject"><span>SUBJECT</span><strong>{preview.subject}</strong></div>
  {preview.error?<p className="feedback-error" role="alert">{preview.error}</p>:
   <div className="charis-direct-preview-surface">
    <div className="charis-direct-preview-paper" style={{maxWidth:device==='mobile'?375:720}}>
     {!loaded&&<p className="charis-direct-preview-loading" role="status">Preparing email preview…</p>}
     <iframe key={device+'-'+revision+'-'+preview.html} title={finalReview?'Final campaign email preview':'Campaign email preview'} loading="eager" sandbox="" referrerPolicy="no-referrer" srcDoc={preview.html}
      onLoad={()=>setLoaded(true)} style={{width:'100%',height:device==='mobile'?560:600}}/>
    </div>
   </div>}
  <footer className="charis-direct-preview-note">Preview only. No email is sent until you confirm. Customer-specific preference links are added securely during delivery.</footer>
 </section>;
}
