'use client';

import {useEffect,useRef,useState} from 'react';
import {Type,AlignLeft,Image as ImageIcon,Square,PanelTop,Circle,RectangleHorizontal,Minus,MousePointerClick,MoveUp,MoveDown,Copy,Trash2,Monitor,Smartphone,Shapes,Maximize2,Minimize2,Upload} from 'lucide-react';
import './template-studio-premium.css';
import type {Editor} from 'grapesjs';
import {designSchema,verifiedBrandWebsite,type EmailBlock,type EmailDesign} from '@/lib/campaign/design';
import {customerFieldOptions} from '@/lib/campaign/customer-fields';
import 'grapesjs/dist/css/grapes.min.css';

type Media={id:string;file_name:string;public_url:string};
type Props={design:EmailDesign;onChange:(next:EmailDesign)=>void;assets:Media[];brandName:string;brandColor:string;websiteUrl:string;availableFields?:string[]};

function escapeHtml(value:string){return value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]||char));}
const validHex=(value:string)=>/^#[0-9a-f]{6}$/i.test(value);
type InlineRun={text:string;bold?:boolean;italic?:boolean;underline?:boolean};
function extractInlineRuns(element:Element):InlineRun[]{
 const runs:InlineRun[]=[];
 const walk=(node:Node,marks:{bold?:boolean;italic?:boolean;underline?:boolean})=>{
  if(node.nodeType===Node.TEXT_NODE){const value=node.textContent||'';if(value)runs.push({text:value,bold:!!marks.bold,italic:!!marks.italic,underline:!!marks.underline});return;}
  if(node.nodeType!==Node.ELEMENT_NODE)return;
  const el=node as HTMLElement,style=el.style;
  const next={bold:style.fontWeight?style.fontWeight==='bold'||Number(style.fontWeight)>=600:el.tagName==='B'||el.tagName==='STRONG'||!!marks.bold,italic:style.fontStyle?style.fontStyle==='italic':el.tagName==='I'||el.tagName==='EM'||!!marks.italic,underline:style.textDecoration?style.textDecoration.includes('underline'):el.tagName==='U'||!!marks.underline};
  el.childNodes.forEach(child=>walk(child,next));
 };
 const baseStyle=(element as HTMLElement).style;\n const base={bold:baseStyle.fontWeight==='bold'||Number(baseStyle.fontWeight)>=600,italic:baseStyle.fontStyle==='italic',underline:baseStyle.textDecoration.includes('underline')};\n element.childNodes.forEach(child=>walk(child,base));
 const merged:InlineRun[]=[];
 for(const run of runs){const last=merged[merged.length-1];if(last&&last.bold===run.bold&&last.italic===run.italic&&last.underline===run.underline)last.text+=run.text;else merged.push({...run});}
 return merged;
}
function starter(type:EmailBlock['type'],assets:Media[],website:string):EmailBlock|null {
 if(type==='heading')return {type,text:'New heading'};
 if(type==='paragraph')return {type,text:'Write your message here.'};
 if(type==='divider')return {type,text:''};
 if(type==='shape')return {type,text:'Important information',shape:'panel',color:'#40239A',textColor:'#ffffff',padding:22};
 if(type==='button')return website?{type,text:'Learn more',url:website}:null;
 return assets.length?{type:'image',text:'Approved Charis image',url:assets[0].public_url,width:'full'}:null;
}
function markup(block:EmailBlock,index:number):string {
 const attr=`data-charis-type="${block.type}" data-charis-index="${index}"${block.type==='shape'?` data-charis-shape="${block.shape}"`:''}`;
 const text=escapeHtml(block.text);
 const richText=(block.type==='heading'||block.type==='paragraph')&&block.richText?.length?block.richText.map(run=>{const value=escapeHtml(run.text);const style=(run.bold===true?'font-weight:700;':run.bold===false?'font-weight:400;':'')+(run.italic===true?'font-style:italic;':run.italic===false?'font-style:normal;':'')+(run.underline===true?'text-decoration:underline;':run.underline===false?'text-decoration:none;':'');return style?'<span style="'+style+'">'+value+'</span>':value;}).join(''):text;
 if(block.type==='heading')return `<section ${attr} style="padding:8px 0"><h2 style="font-size:${block.format?.fontSize||25}px;line-height:${block.format?.lineHeight||1.3};letter-spacing:${block.format?.letterSpacing||0}px;background-color:${block.format?.backgroundColor||'transparent'};color:${block.format?.color||'#13233b'};font-family:${block.format?.fontFamily||'Arial'},sans-serif;text-align:${block.format?.align||'left'};font-weight:${block.format?.bold===false?'400':'700'};font-style:${block.format?.italic?'italic':'normal'};text-decoration:${block.format?.underline?'underline':'none'}">${richText}</h2></section>`;
 if(block.type==='paragraph')return `<section ${attr} style="padding:8px 0"><p style="font-size:${block.format?.fontSize||16}px;line-height:${block.format?.lineHeight||1.7};letter-spacing:${block.format?.letterSpacing||0}px;margin:0 0 ${block.format?.paragraphSpacing??16}px;white-space:pre-wrap;background-color:${block.format?.backgroundColor||'transparent'};color:${block.format?.color||'#243047'};font-family:${block.format?.fontFamily||'Arial'},sans-serif;text-align:${block.format?.align||'left'};font-weight:${block.format?.bold?'700':'400'};font-style:${block.format?.italic?'italic':'normal'};text-decoration:${block.format?.underline?'underline':'none'}">${richText}</p></section>`;
 if(block.type==='divider')return `<section ${attr} style="padding:12px 0"><hr style="border:0;border-top:1px solid #d9dfeb"></section>`;
 if(block.type==='button')return `<section ${attr} style="padding:10px 0"><div style="background:#40239a;color:#fff;padding:14px 20px;display:inline-block">${text}</div></section>`;
 if(block.type==='image')return `<section ${attr} style="padding:10px 0"><img src="${escapeHtml(block.url)}" alt="${text}" style="display:block;width:100%;max-width:${block.width==='small'?180:block.width==='medium'?360:544}px;height:auto"></section>`;
 const width=block.widthPercent??100;
 const height=block.minHeight||0;
 const pad=block.padding??22;
 if(block.shape==='rule')return `<section ${attr} style="width:${width}%;max-width:100%;height:6px;min-height:6px;background:${block.color};font-size:1px;margin:14px 0"></section>`;
 const rounding=block.shape==='pill'?'999px':block.shape==='circle'?'50%':block.shape==='panel'?'12px':block.shape==='rectangle'?'0':'7px';
 const circle=block.shape==='circle';
 const size=Math.round(104+width*1.12);
 return `<section ${attr} style="background:${block.color};color:${block.textColor||'#ffffff'};text-align:${circle?'center':block.align||'left'};padding:${circle?'0':pad+'px'};width:${circle?size+'px':width+'%'};height:${circle?size+'px':'auto'};border-radius:${rounding};border:${block.borderWidth||0}px solid ${block.borderColor||block.color};box-sizing:border-box;min-height:${circle?size:height}px;max-width:100%;margin:${circle?(block.align==='center'?'12px auto':block.align==='right'?'12px 0 12px auto':'12px 0'):'12px 0'};overflow-wrap:anywhere;word-break:break-word;display:${circle?'flex':'block'};align-items:${circle?'center':'initial'};justify-content:${circle?'center':'initial'}"><div style="font-size:${block.fontSize||16}px;line-height:1.45;overflow-wrap:anywhere;padding:${circle?'0 10px':'0'};max-width:100%">${text}</div></section>`;
}

/**
 * GrapesJS is an authoring surface, not the email HTML output. Every change is
 * converted back into the version-1 validated block schema before it can save.
 * This deliberately refuses arbitrary HTML, scripts and external image URLs.
 */
export function GrapesEmailEditor({design,onChange,assets,brandName,brandColor,websiteUrl,availableFields=[]}:Props){
 const host=useRef<HTMLDivElement>(null);
 const instance=useRef<Editor|null>(null);
 const current=useRef(design);
 const sent=useRef('');
 const applyingExternal=useRef(false);
 const onChangeRef=useRef(onChange);
 const assetsRef=useRef(assets);
 const [error,setError]=useState('');
 const [mediaAssets,setMediaAssets]=useState(assets);
 const [uploading,setUploading]=useState(false);
 const fileInput=useRef<HTMLInputElement>(null);
 const [ready,setReady]=useState(false);
 const [selectedIndex,setSelectedIndex]=useState(0);
 const [device,setDevice]=useState<'Desktop'|'Mobile'>('Desktop');
 const [focusCanvas,setFocusCanvas]=useState(false);
 const [showPalette,setShowPalette]=useState(true);
 const [showInspector,setShowInspector]=useState(true);
 const [chosenField,setChosenField]=useState('first_name');
 const fieldChoices=customerFieldOptions(availableFields);
 const addBlockRef=useRef<((type:EmailBlock['type'],shape?:Extract<EmailBlock,{type:'shape'}>['shape'])=>void)|null>(null);
 const website=verifiedBrandWebsite(websiteUrl);
 useEffect(()=>{onChangeRef.current=onChange;},[onChange]);
 useEffect(()=>{setMediaAssets(assets);assetsRef.current=assets;},[assets]);
 useEffect(()=>{assetsRef.current=mediaAssets;},[mediaAssets]);
 useEffect(()=>{
  const version=JSON.stringify(design);
  current.current=design;
  if(instance.current&&version!==sent.current){
   sent.current=version;
   applyingExternal.current=true;
   try{instance.current.setComponents(design.blocks.map((b,i)=>markup(b,i)).join(''));}
   finally{applyingExternal.current=false;}
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
     panels:{defaults:[]},
     deviceManager:{devices:[{id:'Desktop',name:'Desktop',width:''},{id:'Mobile',name:'Mobile',width:'375px'}]},
     components:current.current.blocks.map((b,i)=>markup(b,i)).join(''),
     style:'html{background:#f1edf8;max-width:100%;overflow-x:hidden}body{width:calc(100% - 24px)!important;max-width:600px!important;background:#fff;color:#13233b;font-family:Arial,sans-serif;box-sizing:border-box;padding:26px 22px;min-height:730px;margin:12px auto!important;box-shadow:0 7px 26px #30135720;overflow-wrap:anywhere;word-break:break-word}section[data-charis-type]{margin:12px 0;cursor:pointer;max-width:100%;box-sizing:border-box;overflow-wrap:anywhere;word-break:break-word}section[data-charis-type] *{box-sizing:border-box;max-width:100%;overflow-wrap:anywhere;word-break:break-word}section[data-charis-type] h2,section[data-charis-type] p{white-space:pre-wrap!important;overflow-wrap:anywhere!important;word-break:break-word!important}section[data-charis-type]:hover{outline:1px dashed #9d83e3}',
    });
    if(cancelled){editor.destroy();return;}
    instance.current=editor;
    sent.current=JSON.stringify(current.current);
    const addBlock=(type:EmailBlock['type'],shape?:Extract<EmailBlock,{type:'shape'}>['shape'])=>{
     let base=starter(type,assetsRef.current,website);
     if(base?.type==='shape'&&shape)base={...base,shape,text:shape==='rule'?'':shape==='pill'?'Highlight':shape==='circle'?'Featured':shape==='banner'?'Important update':shape==='panel'?'Customer notice':'Your message'};
     if(!base)return;
     const count=editor.getWrapper()?.components().length||0;
     if(count>=30){setError('Maximum 30 sections per template.');return;}
     const created=editor.addComponents(markup(base,-1));
     if(created.length){editor.select(created[0]);setSelectedIndex(Math.min(count,29));}
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
     if(cancelled||applyingExternal.current)return;
     const root=editor.getWrapper()?.components();
     if(!root)return;
     const prior=current.current;
     const next:EmailBlock[]=[];
     for(const model of root.models){
      const attrs=model.getAttributes() as Record<string,string>;
      const type=attrs['data-charis-type'] as EmailBlock['type']|undefined;
      if(!['heading','paragraph','divider','button','image','shape'].includes(type||''))continue;
      const index=Number(attrs['data-charis-index']);
      let base=(Number.isInteger(index)&&index>=0&&index<prior.blocks.length&&prior.blocks[index].type===type)
       ?prior.blocks[index]:starter(type!,assetsRef.current,website);
      if(base?.type==='shape'&&attrs['data-charis-shape']&&index<0)
       base={...base,shape:attrs['data-charis-shape'] as typeof base.shape};
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
      else next.push({...base,text:contents});
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
     if(applyingExternal.current)return;
     if(pending)clearTimeout(pending);
     pending=setTimeout(sync,300);
    };
    editor.on('component:add component:remove component:update component:drag:end',queue);
    editor.on('component:selected',model=>{
     let item:typeof model|undefined=model;
     while(item&&!item.getAttributes()['data-charis-type'])item=item.parent();
     if(!item)return;
     const found=editor.getWrapper()?.components().models.indexOf(item)??-1;
     if(found>=0)setSelectedIndex(found);
    });
    setReady(true);
   }catch(err){setError(err instanceof Error?err.message:'Visual editor could not load. Use the classic editor.');}
  };
  void initialize();
  return ()=>{cancelled=true;if(pending)clearTimeout(pending);addBlockRef.current=null;instance.current?.destroy();instance.current=null;};
 // The editor stays mounted while a user edits; external design changes are synced above.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[]);
 const active=design.blocks[Math.min(selectedIndex,design.blocks.length-1)];
 const isTextMarkActive=(mark:'bold'|'italic'|'underline')=>{
  if(!active||(active.type!=='heading'&&active.type!=='paragraph'))return false;
  return mark==='bold'&&active.type==='heading'?active.format?.bold!==false:!!active.format?.[mark];
 };
 const toggleTextMark=(mark:'bold'|'italic'|'underline')=>{
  if(!active||(active.type!=='heading'&&active.type!=='paragraph'))return;
  const doc=instance.current?.Canvas.getDocument(),selection=doc?.getSelection();
  const selectedElement=instance.current?.getSelected()?.getEl()?.querySelector('h2,p');
  if(!doc||!selection||!selectedElement||!selection.rangeCount){update({format:{...active.format,[mark]:!isTextMarkActive(mark)}});return;}
  const range=selection.getRangeAt(0);
  if(range.collapsed||!range.toString().trim()||!selectedElement.contains(range.commonAncestorContainer)){update({format:{...active.format,[mark]:!isTextMarkActive(mark)}});return;}
  try{
   const wrapper=doc.createElement('span');
   if(mark==='bold')wrapper.style.fontWeight='700';
   if(mark==='italic')wrapper.style.fontStyle='italic';
   if(mark==='underline')wrapper.style.textDecoration='underline';
   wrapper.appendChild(range.extractContents());range.insertNode(wrapper);
   const nextRange=doc.createRange();nextRange.selectNodeContents(wrapper);selection.removeAllRanges();selection.addRange(nextRange);
   const runs=extractInlineRuns(selectedElement);
   const nextDesign={...current.current,blocks:current.current.blocks.map((block,index)=>index===selectedIndex&&(block.type==='heading'||block.type==='paragraph')?{...block,text:runs.map(run=>run.text).join(''),richText:runs.some(run=>run.bold||run.italic||run.underline)?runs:undefined}:block)};
   current.current=nextDesign;sent.current=JSON.stringify(nextDesign);onChangeRef.current(nextDesign);setError('');
  }catch{setError('The selected text could not be formatted. Please select the text again and retry.');}
 };
 const update=(changes:Partial<EmailBlock>)=>{
  onChange({...design,blocks:design.blocks.map((block,i)=>i===selectedIndex?{...block,...changes} as EmailBlock:block)});
 };
 const removeSelected=()=>{
  if(design.blocks.length<=1)return;
  onChange({...design,blocks:design.blocks.filter((_,i)=>i!==selectedIndex)});
  setSelectedIndex(Math.max(0,selectedIndex-1));
 };
 const duplicateSelected=()=>{
  if(!active||design.blocks.length>=30)return;
  const blocks=[...design.blocks];blocks.splice(selectedIndex+1,0,structuredClone(active));
  onChange({...design,blocks});setSelectedIndex(selectedIndex+1);
 };
 const move=(offset:number)=>{
  const target=selectedIndex+offset;
  if(target<0||target>=design.blocks.length)return;
  const blocks=[...design.blocks];[blocks[target],blocks[selectedIndex]]=[blocks[selectedIndex],blocks[target]];
  setSelectedIndex(target);onChange({...design,blocks});
 };
 async function uploadImage(file?:File){
  if(!file)return;setError('');setUploading(true);
  try{const data=new FormData();data.set('asset',file);const response=await fetch('/api/direct/media/upload',{method:'POST',body:data});const result=await response.json();if(!response.ok||!result.asset)throw new Error(result.error||'Image upload failed.');const asset=result.asset as Media;assetsRef.current=[asset,...assetsRef.current];setMediaAssets(assetsRef.current);addBlockRef.current?.('image');}
  catch(e){setError(e instanceof Error?e.message:'Unable to upload image.');}
  finally{setUploading(false);if(fileInput.current)fileInput.current.value='';}
 }
 const tiles=[
  {key:'heading',label:'Heading',type:'heading' as const,icon:Type},
  {key:'paragraph',label:'Paragraph',type:'paragraph' as const,icon:AlignLeft},
  {key:'image',label:'Picture',type:'image' as const,icon:ImageIcon},
  {key:'button',label:'Button',type:'button' as const,icon:MousePointerClick},
  {key:'banner',label:'Banner',type:'shape' as const,shape:'banner' as const,icon:RectangleHorizontal},
  {key:'panel',label:'Panel',type:'shape' as const,shape:'panel' as const,icon:PanelTop},
  {key:'rectangle',label:'Rectangle',type:'shape' as const,shape:'rectangle' as const,icon:Square},
  {key:'pill',label:'Pill',type:'shape' as const,shape:'pill' as const,icon:Shapes},
  {key:'circle',label:'Circle',type:'shape' as const,shape:'circle' as const,icon:Circle},
  {key:'rule',label:'Accent line',type:'shape' as const,shape:'rule' as const,icon:Minus},
  {key:'divider',label:'Divider',type:'divider' as const,icon:Minus}
 ];
 return <section className="charis-gjs" aria-label="Professional email design editor">
  <div className="charis-gjs-top">
   <div><h3>Email designer</h3></div>
   <div className="charis-gjs-device-tools">
    <button type="button" className="charis-gjs-panel-toggle" aria-pressed={showPalette} onClick={()=>setShowPalette(v=>!v)}>Add elements</button>
    <button type="button" className="charis-gjs-panel-toggle" aria-pressed={showInspector} onClick={()=>setShowInspector(v=>!v)}>Element settings</button>
    <button type="button" className="charis-gjs-expand" onClick={()=>setFocusCanvas(x=>!x)} aria-pressed={focusCanvas}>{focusCanvas?<Minimize2 size={15}/>:<Maximize2 size={15}/>} {focusCanvas?"Show tools":"Expand canvas"}</button><div className="charis-gjs-devices" role="group" aria-label="Canvas device">
    <button type="button" aria-pressed={device==='Desktop'} onClick={()=>{setDevice('Desktop');instance.current?.setDevice('Desktop');}}><Monitor size={15}/> Desktop</button>
    <button type="button" aria-pressed={device==='Mobile'} onClick={()=>{setDevice('Mobile');instance.current?.setDevice('Mobile');}}><Smartphone size={15}/> Mobile</button>
   </div></div>
  </div>
  <div className="charis-gjs-formatbar" role="toolbar" aria-label="Text formatting">
   <strong>Text</strong>
   <div className="charis-gjs-formatbar-marks">
    <button type="button" aria-label="Bold" title="Bold" aria-pressed={isTextMarkActive('bold')} disabled={!active||(active.type!=='heading'&&active.type!=='paragraph')} onMouseDown={event=>event.preventDefault()} onClick={()=>toggleTextMark('bold')}><b>B</b></button>
    <button type="button" aria-label="Italic" title="Italic" aria-pressed={isTextMarkActive('italic')} disabled={!active||(active.type!=='heading'&&active.type!=='paragraph')} onMouseDown={event=>event.preventDefault()} onClick={()=>toggleTextMark('italic')}><i>I</i></button>
    <button type="button" aria-label="Underline" title="Underline" aria-pressed={isTextMarkActive('underline')} disabled={!active||(active.type!=='heading'&&active.type!=='paragraph')} onMouseDown={event=>event.preventDefault()} onClick={()=>toggleTextMark('underline')}><u>U</u></button>
   </div>
   <label>Size<select aria-label="Font size" disabled={!active||(active.type!=='heading'&&active.type!=='paragraph')} value={active&&'format' in active?(active.format?.fontSize||(active.type==='heading'?25:16)):16} onChange={e=>active&&'format' in active&&update({format:{...active.format,fontSize:Number(e.target.value)}})}>{[12,14,16,18,20,22,24,25,28,32,36,40].map(n=><option key={n} value={n}>{n}px</option>)}</select></label>
   <label>Font<select aria-label="Font family" disabled={!active||(active.type!=='heading'&&active.type!=='paragraph')} value={active&&'format' in active?(active.format?.fontFamily||'Arial'):'Arial'} onChange={e=>active&&'format' in active&&update({format:{...active.format,fontFamily:e.target.value as 'Arial'|'Georgia'|'Verdana'|'Tahoma'|'Trebuchet MS'}})}>{['Arial','Georgia','Verdana','Tahoma','Trebuchet MS'].map(font=><option key={font}>{font}</option>)}</select></label>
   <label className="charis-gjs-color-control">Text <input aria-label="Text colour" type="color" disabled={!active||(active.type!=='heading'&&active.type!=='paragraph')} value={active&&'format' in active?(active.format?.color||'#243047'):'#243047'} onChange={e=>active&&'format' in active&&update({format:{...active.format,color:e.target.value}})}/></label>
   <label className="charis-gjs-color-control">Highlight <input aria-label="Highlight colour" type="color" disabled={!active||(active.type!=='heading'&&active.type!=='paragraph')} value={active&&'format' in active?(active.format?.backgroundColor||'#ffffff'):'#ffffff'} onChange={e=>active&&'format' in active&&update({format:{...active.format,backgroundColor:e.target.value}})}/></label>
   <label>Align<select aria-label="Text alignment" disabled={!active||(active.type!=='heading'&&active.type!=='paragraph')} value={active&&'format' in active?(active.format?.align||'left'):'left'} onChange={e=>active&&'format' in active&&update({format:{...active.format,align:e.target.value as 'left'|'center'|'right'|'justify'}})}>{['left','center','right','justify'].map(v=><option key={v} value={v}>{v[0].toUpperCase()+v.slice(1)}</option>)}</select></label>
  </div>
  <div className={"charis-gjs-workspace"+(focusCanvas?" charis-gjs-workspace-focus":"")+(!showPalette?" charis-gjs-no-palette":"")+(!showInspector?" charis-gjs-no-inspector":"")}>
   <aside className="charis-gjs-palette" aria-label="Add email elements">
    <div className="charis-gjs-title">Add elements</div><input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={e=>void uploadImage(e.target.files?.[0])}/><button type="button" className="charis-gjs-tool charis-gjs-upload" disabled={uploading||!ready} onClick={()=>fileInput.current?.click()}><Upload aria-hidden="true"/><span>{uploading?'Uploading image…':'Upload image'}</span></button>
    <div className="charis-gjs-group">{tiles.map(t=><button type="button" className="charis-gjs-tool" key={t.key}
     disabled={!ready||design.blocks.length>=30||(t.type==='image'&&!mediaAssets.length)||(t.type==='button'&&!website)}
     title={t.type==='image'&&!mediaAssets.length?'Upload an image to this campaign first':t.type==='button'&&!website?'Configure the bank website before adding a linked button':t.label}
     onClick={()=>addBlockRef.current?.(t.type,'shape' in t?t.shape:undefined)}>
     <t.icon aria-hidden="true"/><span>{t.label}</span></button>)}</div>
    <div className="charis-gjs-divider"/>
    <p style={{fontSize:11,lineHeight:1.6,color:'#787087',margin:'0 4px'}}>Choose a shape or section to add. Then select it on the canvas to change its text, colour, size and position.</p>
   </aside>
   <div className="charis-gjs-stage">
    <div ref={host} className="charis-gjs-host"/>
    {error&&<p role="alert" className="feedback-error">{error}</p>}
    {!ready&&!error&&<p role="status" className="muted">Loading visual canvas…</p>}
   </div>
   <aside className="charis-gjs-inspector" aria-label="Selected element settings">
    <div className="charis-gjs-title">Element settings</div><p className="charis-gjs-help">Select an element on the canvas to edit it.</p>
    {active?<><h4>{active.type==='shape'?active.shape:active.type} · {selectedIndex+1}</h4><p>Edit the selected element. These options save with your template.</p>
     <div className="charis-gjs-inspector-actions">
      <button type="button" disabled={selectedIndex===0} onClick={()=>move(-1)}><MoveUp size={14}/> Move up</button>
      <button type="button" disabled={selectedIndex===design.blocks.length-1} onClick={()=>move(1)}><MoveDown size={14}/> Move down</button>
      <button type="button" disabled={design.blocks.length>=30} onClick={duplicateSelected}><Copy size={14}/> Duplicate</button>
      <button type="button" className="charis-gjs-delete" aria-label="Delete selected section" disabled={design.blocks.length<=1} onClick={removeSelected}><Trash2 size={14}/> Delete section</button>
     </div>
     {active.type==='shape'&&<div className="charis-gjs-quick-sizes">
      <label>{active.shape==='circle'?'Circle diameter':'Shape width'} · {active.widthPercent??100}%<input type="range" min="25" max="100" value={active.widthPercent??100} onChange={e=>update({widthPercent:Number(e.target.value)})}/></label>
      {active.shape!=='circle'&&active.shape!=='rule'&&<label>Minimum height · {active.minHeight??0}px<input type="range" min="0" max="320" step="8" value={active.minHeight??0} onChange={e=>update({minHeight:Number(e.target.value)})}/></label>}
     </div>}
     {active.type!=='divider'&&active.type!=='image'&&<div className="charis-merge-inline">
      <strong>Add customer information</strong>
      <label>Customer detail<select aria-label="Detail for selected element" value={chosenField} onChange={e=>setChosenField(e.target.value)}>{fieldChoices.map(f=><option key={f.key} value={f.key}>{f.label}</option>)}</select></label>
      <button type="button" className="charis-insert-field" onClick={()=>{const limit=active.type==='shape'||active.type==='button'?200:5000;update({text:(active.text+' {{'+chosenField+'}}').trim().slice(0,limit)});}}>Insert into selected section</button>
     </div>}
     {active.type!=='divider'&&!(active.type==='shape'&&active.shape==='rule')&&<label>{active.type==='image'?'Image description':'Text content'}
      <textarea rows={4} value={active.text} maxLength={active.type==='shape'||active.type==='button'?200:active.type==='image'?160:undefined} onChange={e=>update({text:e.target.value,richText:undefined})}/>
     </label>}
     {(active.type==='heading'||active.type==='paragraph')&&<div className="charis-gjs-format-tools"><strong>Paragraph spacing & advanced typography</strong><div className="charis-paragraph-spacing-controls"><label>Line spacing · {(active.format?.lineHeight??(active.type==='heading'?1.3:1.7)).toFixed(1)}<input type="range" min="1" max="3" step="0.1" value={active.format?.lineHeight??(active.type==='heading'?1.3:1.7)} onChange={e=>update({format:{...active.format,lineHeight:Number(e.target.value)}})}/></label>{active.type==='paragraph'&&<label>Space after paragraph · {active.format?.paragraphSpacing??16}px<input type="range" min="0" max="64" step="1" value={active.format?.paragraphSpacing??16} onChange={e=>update({format:{...active.format,paragraphSpacing:Number(e.target.value)}})}/></label>}<label>Letter spacing · {active.format?.letterSpacing??0}px<input type="range" min="-1" max="10" step="0.25" value={active.format?.letterSpacing??0} onChange={e=>update({format:{...active.format,letterSpacing:Number(e.target.value)}})}/></label></div></div>}
     {active.type==='button'&&<label>Button URL (HTTPS)<input type="url" value={active.url} onChange={e=>update({url:e.target.value})}/></label>}
     {active.type==='image'&&<><label>Approved picture<select value={active.url} onChange={e=>update({url:e.target.value})}>
      {mediaAssets.map(a=><option value={a.public_url} key={a.id}>{a.file_name}</option>)}
     </select></label><label>Image width<select value={active.width} onChange={e=>update({width:e.target.value as 'full'|'medium'|'small'})}><option value="full">Full</option><option value="medium">Medium</option><option value="small">Small</option></select></label></>}
     {active.type==='shape'&&<><label>Shape style<select value={active.shape} onChange={e=>update({shape:e.target.value as typeof active.shape,text:e.target.value==='rule'?'':active.text})}>
      {['banner','panel','rectangle','pill','circle','rule'].map(v=><option key={v} value={v}>{v[0].toUpperCase()+v.slice(1)}</option>)}
     </select></label>
      <div className="charis-gjs-color-row"><label>Fill colour<input type="color" value={active.color} onChange={e=>update({color:e.target.value})}/></label>
       <label>Text colour<input type="color" value={active.textColor||'#ffffff'} onChange={e=>update({textColor:e.target.value})}/></label></div>
      <label>Alignment<select value={active.align||'left'} onChange={e=>update({align:e.target.value as 'left'|'center'|'right'})}>
       <option value="left">Left</option><option value="center">Centre</option><option value="right">Right</option></select></label>

      {active.shape!=='circle'&&<label>Internal spacing · {active.padding??22}px<input type="range" min="0" max="64" value={active.padding??22} onChange={e=>update({padding:Number(e.target.value)})}/></label>}
      <label>Border width · {active.borderWidth??0}px<input type="range" min="0" max="12" value={active.borderWidth??0} onChange={e=>update({borderWidth:Number(e.target.value)})}/></label>
      <label>Text size · {active.fontSize??16}px<input type="range" min="12" max="48" value={active.fontSize??16} onChange={e=>update({fontSize:Number(e.target.value)})}/></label>
     </>}

    </>:<div className="charis-gjs-empty">Select an element in your email to edit it.</div>}
    <div className="charis-gjs-divider"/>
    <p style={{fontSize:11}}>Brand · {brandName}<br/>Colour · {validHex(brandColor)?brandColor:'#40239A'}</p>
   </aside>

  </div>
 </section>;
}
