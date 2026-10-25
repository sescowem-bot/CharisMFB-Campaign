'use client';
import Link from 'next/link';
import {useMemo,useState} from 'react';
import {FilePlus2,LayoutTemplate,Search,Copy,ArrowUpRight,CheckCircle2,Paintbrush} from 'lucide-react';
import type {EmailDesign} from '@/lib/campaign/design';
import type {TemplatePreset} from '@/lib/campaign/template-presets';
import './template-studio-premium.css';
type Stored={id:string;name:string;description:string;subject:string;category:string;status:string;design:EmailDesign;owned:boolean;updatedAt:string};
function Miniature({design,name}:{design:EmailDesign;name:string}){
 return <div className={`charis-gallery-preview charis-gallery-${design.style||'classic'}`} aria-label={`Preview of ${name}`}>
  <div className="charis-gallery-brand"><span className="charis-gallery-brand-mark">C</span> Charis Microfinance Bank</div>
  <div className="charis-gallery-body">
   {design.blocks.slice(0,5).map((b,i)=> b.type==='heading'?<strong key={i}>{b.text.replace(/\{\{[^}]+\}\}/g,'Customer')}</strong>:
    b.type==='paragraph'?<p key={i}>{b.text.replace(/\{\{[^}]+\}\}/g,'Customer')}</p>:
    b.type==='shape'?<div className="charis-mini-shape" key={i} style={{background:b.color,borderRadius:b.shape==='pill'?20:b.shape==='circle'?90:5}}>{b.text}</div>:
    b.type==='button'?<span className="charis-mini-button" key={i}>{b.text}</span>:
    b.type==='image'?<div className="charis-mini-image" key={i}>Approved brand image</div>:
    <hr key={i}/>)}
  </div><div className="charis-gallery-foot">CHARIS · CUSTOMER COMMUNICATIONS</div>
 </div>;
}
export function TemplateGallery({saved,presets,canEdit}:{saved:Stored[];presets:TemplatePreset[];canEdit:boolean}){
 const [tab,setTab]=useState<'saved'|'starters'>('starters');
 const [search,setSearch]=useState('');
 const [category,setCategory]=useState('all');
 const items=useMemo(()=>{
  const data=tab==='saved'?saved:presets;
  return data.filter(t=>(category==='all'||t.category===category)&&[t.name,t.description,t.subject].join(' ').toLowerCase().includes(search.toLowerCase()));
 },[tab,saved,presets,search,category]);
 return <div className="charis-gallery">
  <div className="charis-gallery-hero">
   <div><span className="charis-eyebrow"><LayoutTemplate size={15}/> CHARIS DESIGN STUDIO</span>
    <h2>Beautiful emails, built for your bank.</h2>
    <p>Create a new design, customise one of ten professionally prepared layouts, or open an existing template.</p></div>
   {canEdit&&<Link className="charis-primary-action" href="/dashboard/templates/new"><FilePlus2 size={17}/> Create new template</Link>}
  </div>
  <div className="charis-gallery-stats"><span><strong>{saved.length}</strong> Saved templates</span><span><strong>{presets.length}</strong> Ready-to-edit layouts</span><span><CheckCircle2 size={15}/> Safe, email-ready design blocks</span></div>
  <div className="charis-gallery-toolbar">
   <div className="charis-tabstrip" role="tablist" aria-label="Template collections">
    <button type="button" role="tab" aria-selected={tab==='starters'} onClick={()=>{setTab('starters');setCategory('all');}}><Paintbrush size={17}/> Starter designs <span>{presets.length}</span></button>
    <button type="button" role="tab" aria-selected={tab==='saved'} onClick={()=>{setTab('saved');setCategory('all');}}><LayoutTemplate size={17}/> Saved templates <span>{saved.length}</span></button>
   </div>
   <div className="charis-gallery-filters">
    <label className="charis-gallery-search"><Search size={17}/><input aria-label="Search templates" placeholder="Search templates…" value={search} onChange={e=>setSearch(e.target.value)}/></label>
    <select aria-label="Filter templates by category" value={category} onChange={e=>setCategory(e.target.value)}>
     <option value="all">All categories</option>{['general','announcement','newsletter','promotion','event'].map(v=><option value={v} key={v}>{v[0].toUpperCase()+v.slice(1)}</option>)}
    </select>
   </div>
  </div>
  {items.length===0?<div className="charis-gallery-empty"><LayoutTemplate size={34}/><h3>No templates found</h3><p>Try another search or create your own new template.</p>{canEdit&&<Link className="charis-primary-action" href="/dashboard/templates/new">Create template</Link>}</div>:
   <div className="charis-gallery-grid">
    {tab==='starters'?(items as TemplatePreset[]).map(t=><article className="charis-template-card" key={t.id}>
     <Miniature design={t.design} name={t.name}/>
     <div className="charis-card-meta"><span className="charis-category">{t.category}</span><h3>{t.name}</h3><p>{t.description}</p></div>
     {canEdit&&<Link href={`/dashboard/templates/new?preset=${encodeURIComponent(t.id)}`} className="charis-template-action"><Copy size={16}/> Use this design <ArrowUpRight size={15}/></Link>}
    </article>):(items as Stored[]).map(t=><article className="charis-template-card" key={t.id}>
     <Miniature design={t.design} name={t.name}/>
     <div className="charis-card-meta"><span className="charis-category">{t.category} · {t.owned?'Charis template':'Shared template'}</span><h3>{t.name}</h3><p>{t.description||t.subject}</p></div>
     {canEdit&&<Link href={t.owned?`/dashboard/templates/${t.id}/edit`:`/dashboard/templates/new?copy=${t.id}`} className="charis-template-action">
      {t.owned?'Open template':'Make a copy'} <ArrowUpRight size={15}/></Link>}
    </article>)}
   </div>}
 </div>;
}
