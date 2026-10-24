'use client';

import {useEffect,useRef,useState} from 'react';
import type {Editor} from 'grapesjs';
import {designSchema,verifiedBrandWebsite,type EmailBlock,type EmailDesign} from '@/lib/campaign/design';
import 'grapesjs/dist/css/grapes.min.css';

type Media={id:string;file_name:string;public_url:string};
type Props={design:EmailDesign;onChange:(next:EmailDesign)=>void;assets:Media[];brandName:string;brandColor:string;websiteUrl:string};

function escapeHtml(value:string){return value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]||char));}
const validHex=(value:string)=>/^#[0-9a-f]{6}$/i.test(value);
function starter(type:EmailBlock['type'],assets:Media[],website:string):EmailBlock|null {
 if(type==='heading')return {type,text:'New heading'};
 if(type==='paragraph')return {type,text:'Write your message here.'};
 if(type==='divider')return {type,text:''};
 if(type==='shape')return {type,text:'Important information',shape:'panel',color:'#40239A',textColor:'#ffffff',padding:22};
 if(type==='button')return website?{type,text:'Learn more',url:website}:null;
 return assets.length?{type:'image',text:'Approved Charis image',url:assets[0].public_url,width:'full'}:null;
}
function markup(block:EmailBlock,index:number):string {
 const attr=`data-charis-type="${block.type}" data-charis-index="${index}"`;
 const text=escapeHtml(block.text);
 if(block.type==='heading')return `<section ${attr} style="padding:8px 0"><h2 style="font-size:25px;color:#13233b">${text}</h2></section>`;
 if(block.type==='paragraph')return `<section ${attr} style="padding:8px 0"><p style="font-size:16px;line-height:1.7;white-space:pre-wrap">${text}</p></section>`;
 if(block.type==='divider')return `<section ${attr} style="padding:12px 0"><hr style="border:0;border-top:1px solid #d9dfeb"></section>`;
 if(block.type==='button')return `<section ${attr} style="padding:10px 0"><div style="background:#40239a;color:#fff;padding:14px 20px;display:inline-block">${text}</div></section>`;
 if(block.type==='image')return `<section ${attr} style="padding:10px 0"><img src="${escapeHtml(block.url)}" alt="${text}" style="display:block;width:100%;max-width:${block.width==='small'?180:block.width==='medium'?360:544}px;height:auto"></section>`;
 return `<section ${attr} style="background:${block.color};color:${block.textColor||'#ffffff'};text-align:${block.align||'left'};padding:${block.padding??22}px;border-radius:8px"><div>${text}</div></section>`;
}

/**
 * GrapesJS is an authoring surface, not the email HTML output. Every change is
 * converted back into the version-1 validated block schema before it can save.
 * This deliberately refuses arbitrary HTML, scripts and external image URLs.
 */
export function GrapesEmailEditor({design,onChange,assets,brandName,brandColor,websiteUrl}:Props){
 const host=useRef<HTMLDivElement>(null);
 const instance=useRef<Editor|null>(null);
 const current=useRef(design);
 const sent=useRef('');
 const onChangeRef=useRef(onChange);
 const assetsRef=useRef(assets);
 const [error,setError]=useState('');
 const [ready,setReady]=useState(false);
 const addBlockRef=useRef<((type:EmailBlock['type'])=>void)|null>(null);
 const website=verifiedBrandWebsite(websiteUrl);
 useEffect(()=>{onChangeRef.current=onChange;},[onChange]);
 useEffect(()=>{assetsRef.current=assets;},[assets]);
 useEffect(()=>{
  const version=JSON.stringify(design);
  current.current=design;
  if(instance.current&&version!==sent.current){
   sent.current=version;
   instance.current.setComponents(design.blocks.map((b,i)=>markup(b,i)).join(''));
  }
 },[design]);
 useEffect(()=>{
  if(!host.current)return;
  let cancelled=false;
  let pending:ReturnType<typeof setTimeout>|undefined;
  const initialize=async()=>{
   try{
    const {default:grapesjs}=await import('grapesjs');
    if(cancelled||!host.current)return;
    const editor=grapesjs.init({
     container:host.current,
     height:'610px',
     width:'auto',
     storageManager:false,
     fromElement:false,
     noticeOnUnload:false,
     selectorManager:{componentFirst:true},
     components:current.current.blocks.map((b,i)=>markup(b,i)).join(''),
     style:'body{background:#f3f0f8;color:#13233b;font-family:Arial,sans-serif;padding:20px;max-width:620px;margin:auto} section[data-charis-type]{background-color:#fff;margin:8px 0;min-height:12px;}',
    });
    if(cancelled){editor.destroy();return;}
    instance.current=editor;
    sent.current=JSON.stringify(current.current);
    const addBlock=(type:EmailBlock['type'])=>{
     const base=starter(type,assetsRef.current,website);
     if(!base)return;
     const count=editor.getWrapper()?.components().length||0;
     if(count>=30){setError('Maximum 30 sections per template.');return;}
     editor.addComponents(markup(base,-1));
    };
    addBlockRef.current=addBlock;
    (['heading','paragraph','shape','image','button','divider'] as const).filter(type=>type!=='button'||!!website).filter(type=>type!=='image'||assetsRef.current.length>0).forEach(type=>{
     editor.BlockManager.add('charis-'+type,{
      label:type[0].toUpperCase()+type.slice(1),
      category:'Charis email sections',
      content:markup(starter(type,assetsRef.current,website)||{type:'paragraph',text:'New section'},-1),
     });
    });
    const sync=()=>{
     if(cancelled)return;
     const root=editor.getWrapper()?.components();
     if(!root)return;
     const prior=current.current;
     const next:EmailBlock[]=[];
     for(const model of root.models){
      const attrs=model.getAttributes() as Record<string,string>;
      const type=attrs['data-charis-type'] as EmailBlock['type']|undefined;
      if(!['heading','paragraph','divider','button','image','shape'].includes(type||''))continue;
      const index=Number(attrs['data-charis-index']);
      const base=(Number.isInteger(index)&&index>=0&&index<prior.blocks.length&&prior.blocks[index].type===type)
       ?prior.blocks[index]:starter(type!,assetsRef.current,website);
      if(!base)continue;
      const doc=new DOMParser().parseFromString(model.toHTML(),'text/html');
      const section=doc.body.querySelector('[data-charis-type]');
      const contents=section?.textContent?.trim()||'';
      if(base.type==='divider'||base.type==='image')next.push(base);
      else if(base.type==='shape'){
       const styles=model.getStyle() as Record<string,string>;
       const color=styles['background-color'];
       const textColor=styles.color;
       next.push({...base,text:contents.slice(0,200),...(color&&validHex(color)?{color}:{}) ,...(textColor&&validHex(textColor)?{textColor}:{})});
      }
      else if(base.type==='button')next.push({...base,text:contents.slice(0,200)});
      else next.push({...base,text:contents.slice(0,5000)});
      if(next.length===30)break;
     }
     const result=designSchema.safeParse({...prior,blocks:next});
     if(!result.success){setError('Check the email sections before saving.');return;}
     // Rebase component positions after drag/reorder, so subsequent text edits
     // refer to the new section order rather than the original template.
     root.models.forEach((model,position)=>{
      if(model.getAttributes()['data-charis-type'])model.addAttributes({'data-charis-index':String(position)});
     });
     const json=JSON.stringify(result.data);
     if(json!==JSON.stringify(prior)){
      current.current=result.data;
      sent.current=json;
      setError('');
      onChangeRef.current(result.data);
     }
    };
    const queue=()=>{
     if(pending)clearTimeout(pending);
     pending=setTimeout(sync,300);
    };
    editor.on('component:add component:remove component:update component:drag:end',queue);
    setReady(true);
   }catch(err){setError(err instanceof Error?err.message:'Visual editor could not load. Use the classic editor.');}
  };
  void initialize();
  return ()=>{cancelled=true;if(pending)clearTimeout(pending);addBlockRef.current=null;instance.current?.destroy();instance.current=null;};
 // The editor stays mounted while a user edits; external design changes are synced above.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[]);
 return <section aria-label="GrapesJS drag and drop email editor">
  <div className="visual-studio-heading" style={{marginBottom:12}}>
   <div><h3 style={{margin:0}}>Drag-and-drop email editor</h3><p className="muted">Drag sections from Blocks, click text to edit, and move sections to arrange the email. Final sending uses the verified Charis email renderer.</p><p className="muted">Bank: {brandName}. Theme: {validHex(brandColor)?brandColor:'#40239A'}</p></div>
   <button type="button" className="btn secondary" onClick={()=>instance.current?.runCommand('core:preview')} disabled={!ready}>Editor preview</button>
  </div>
  <div role="group" aria-label="Insert email section" className="visual-history">
   {(['heading','paragraph','shape','image','button','divider'] as const).map(type=><button type="button" key={type} disabled={!ready||(type==='image'&&!assets.length)||(type==='button'&&!website)} onClick={()=>addBlockRef.current?.(type)}>+ {type}</button>)}
  </div>
  <div ref={host} style={{minHeight:610,border:'1px solid #dcd6e8',borderRadius:8,overflow:'hidden'}}/>
  {error&&<p role="alert" className="feedback-error">{error}</p>}
  {!ready&&!error&&<p role="status" className="muted">Loading GrapesJS editor…</p>}
 </section>;
}
