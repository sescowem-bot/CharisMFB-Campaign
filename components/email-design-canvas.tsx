'use client';

import {useState, type CSSProperties} from 'react';
import Image from 'next/image';
import type {EmailBlock, EmailDesign} from '@/lib/campaign/design';

type Shape = Extract<EmailBlock,{type:'shape'}>;
export function shapePreviewStyle(b:Shape):CSSProperties {
 return {background:b.color,color:b.textColor||'#ffffff',borderRadius:b.shape==='circle'?'50%':b.shape==='pill'?999:b.shape==='panel'?12:b.shape==='rectangle'?0:4,padding:b.shape==='rule'?3:b.padding??22,width:`${b.widthPercent??100}%`,minHeight:b.shape==='rule'?6:b.minHeight||undefined,fontSize:b.fontSize||16,lineHeight:1.5,fontWeight:600,border:`${b.borderWidth||0}px solid ${b.borderColor||b.color}`,textAlign:b.align||'left',marginLeft:b.align==='right'||b.align==='center'?'auto':0,marginRight:b.align==='center'?'auto':0,whiteSpace:'pre-wrap',overflowWrap:'anywhere',boxSizing:'border-box'};
}
export function EmailDesignCanvas({design,onChange,assets,brandName,brandColor}:{design:EmailDesign;onChange:(design:EmailDesign)=>void;assets:{id:string;file_name:string;public_url:string}[];brandName:string;brandColor:string}) {
 const [selected,setSelected]=useState(0);
 const [dragged,setDragged]=useState<number|null>(null);
 const [mobile,setMobile]=useState(false);
 const [notice,setNotice]=useState('');
 const index=Math.min(selected,Math.max(0,design.blocks.length-1));
 const block=design.blocks[index];
 function update(changes:Partial<EmailBlock>){onChange({...design,blocks:design.blocks.map((b,i)=>i===index?{...b,...changes} as EmailBlock:b)});}
 function reorder(from:number,to:number){if(from===to||to<0||to>=design.blocks.length)return;const blocks=[...design.blocks];const [item]=blocks.splice(from,1);blocks.splice(to,0,item);onChange({...design,blocks});setSelected(to);setNotice(`Section moved to position ${to+1}.`);}
 function add(type:EmailBlock['type']) {
  if(design.blocks.length>=30)return;
  let item:EmailBlock;
  if(type==='shape')item={type,text:'Your message here',shape:'rectangle',color:'#40239A',textColor:'#ffffff',padding:22,align:'center'};
  else if(type==='image'){if(!assets.length)return;item={type,text:'Charis graphic',url:assets[0].public_url,width:'full'};}
  else if(type==='button')item={type,text:'Learn more',url:'https://example.com'};
  else if(type==='divider')item={type,text:''};
  else item={type,text:type==='heading'?'Your heading':'Write your message here.'};
  onChange({...design,blocks:[...design.blocks,item]});setSelected(design.blocks.length);
 }
 return <section className="visual-studio" aria-label="Email design canvas">
  <div className="visual-studio-toolbar"><div className="visual-studio-tools" aria-label="Insert section">{(['heading','paragraph','shape','image','button','divider'] as const).map(type=><button type="button" key={type} disabled={design.blocks.length>=30||(type==='image'&&!assets.length)} onClick={()=>add(type)}>+ {type}</button>)}</div><div role="group" aria-label="Preview width"><button type="button" aria-pressed={!mobile} onClick={()=>setMobile(false)}>Desktop</button><button type="button" aria-pressed={mobile} onClick={()=>setMobile(true)}>Mobile</button></div></div>
  <div className="visual-studio-layout">
   <div className="visual-studio-surface"><div className={`visual-email-paper charis-email-${design.style||'classic'}`} style={{maxWidth:mobile?360:600}}>
    <div className="visual-email-brand" style={{background:design.style==='minimal'?'white':brandColor,color:design.style==='minimal'?brandColor:'white'}}>{brandName}</div>
    <div className="visual-email-content">{design.blocks.map((b,i)=><div key={i} className={`visual-email-section ${index===i?'is-selected':''}`} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(dragged!==null)reorder(dragged,i);setDragged(null);}}>
     <div className="visual-section-actions"><button type="button" draggable onDragStart={()=>setDragged(i)} onDragEnd={()=>setDragged(null)} onClick={()=>setSelected(i)} aria-label={`Select or drag section ${i+1}: ${b.type}`} aria-pressed={index===i}>⠿ {i+1} · {b.type}</button><button type="button" aria-label={`Move section ${i+1} up`} disabled={i===0} onClick={()=>reorder(i,i-1)}>↑</button><button type="button" aria-label={`Move section ${i+1} down`} disabled={i===design.blocks.length-1} onClick={()=>reorder(i,i+1)}>↓</button></div>
     <div onClick={()=>setSelected(i)} className="visual-section-body">
      {b.type==='heading'?<h2>{b.text}</h2>:b.type==='paragraph'?<p>{b.text}</p>:b.type==='button'?<span className="visual-email-button" style={{background:brandColor}}>{b.text}</span>:b.type==='image'?<Image unoptimized src={b.url} alt={b.text} width={540} height={280} style={{width:'100%',height:'auto',maxWidth:b.width==='small'?180:b.width==='medium'?360:540,display:'block',margin:'auto'}}/>:b.type==='shape'?<div style={shapePreviewStyle(b)}>{b.shape==='rule'?'':index===i?<textarea aria-label="Text inside selected shape" value={b.text} maxLength={200} rows={Math.max(2,b.text.split('\n').length)} onChange={e=>update({text:e.target.value})} className="visual-shape-text"/>:b.text}</div>:<hr/>}
     </div>
    </div>)}</div>
    <div className="visual-email-footer">{brandName}</div>
   </div></div>
   <aside className="visual-properties" aria-label="Selected section properties"><h3>Section {index+1}</h3><p className="muted">Select a section to edit it.</p>
    {block&&<><div className="visual-property-actions"><button type="button" disabled={design.blocks.length>=30} onClick={()=>{const blocks=[...design.blocks];blocks.splice(index+1,0,{...block});onChange({...design,blocks});setSelected(index+1);}}>Duplicate</button><button type="button" disabled={design.blocks.length===1} onClick={()=>{onChange({...design,blocks:design.blocks.filter((_,i)=>i!==index)});setSelected(Math.max(0,index-1));}}>Remove</button></div>
    {block.type!=='divider'&&!(block.type==='shape'&&block.shape==='rule')&&<label>{block.type==='image'?'Image description':'Text'}<textarea value={block.text} maxLength={block.type==='image'?160:block.type==='shape'||block.type==='button'?200:5000} rows={4} onChange={e=>update({text:e.target.value})}/></label>}
    {block.type==='button'&&<label>Link<input type="url" value={block.url} onChange={e=>update({url:e.target.value})}/></label>}
    {block.type==='image'&&<><label>Image<select value={block.url} onChange={e=>update({url:e.target.value})}>{assets.map(a=><option key={a.id} value={a.public_url}>{a.file_name}</option>)}</select></label><label>Width<select value={block.width} onChange={e=>update({width:e.target.value as 'full'|'medium'|'small'})}><option value="full">Full</option><option value="medium">Medium</option><option value="small">Small</option></select></label></>}
    {block.type==='shape'&&<><label>Shape<select value={block.shape} onChange={e=>update({shape:e.target.value as Shape['shape']})}>{['rectangle','circle','pill','panel','banner','rule'].map(s=><option key={s} value={s}>{s==='circle'?'Oval / circle':s}</option>)}</select></label><div className="visual-color-fields"><label>Fill<input type="color" value={block.color} onChange={e=>update({color:e.target.value})}/></label><label>Text<input type="color" value={block.textColor||'#ffffff'} onChange={e=>update({textColor:e.target.value})}/></label><label>Border<input type="color" value={block.borderColor||block.color} onChange={e=>update({borderColor:e.target.value})}/></label></div>
     <label>Alignment<select value={block.align||'left'} onChange={e=>update({align:e.target.value as Shape['align']})}>{['left','center','right'].map(a=><option key={a}>{a}</option>)}</select></label>
     <label>Width · {block.widthPercent??100}%<input type="range" min={25} max={100} value={block.widthPercent??100} onChange={e=>update({widthPercent:Number(e.target.value)})}/></label>
     <label>Height · {block.minHeight||0}px<input type="range" min={0} max={400} step={4} value={block.minHeight||0} onChange={e=>update({minHeight:Number(e.target.value)})}/></label>
     <label>Padding · {block.padding??22}px<input type="range" min={0} max={64} value={block.padding??22} onChange={e=>update({padding:Number(e.target.value)})}/></label>
     <label>Text size · {block.fontSize||16}px<input type="range" min={12} max={48} value={block.fontSize||16} onChange={e=>update({fontSize:Number(e.target.value)})}/></label>
     <label>Border · {block.borderWidth||0}px<input type="range" min={0} max={12} value={block.borderWidth||0} onChange={e=>update({borderWidth:Number(e.target.value)})}/></label>
    </>}
    </>}
   </aside>
  </div><p className="sr-only" aria-live="polite">{notice}</p>
 </section>;
}
