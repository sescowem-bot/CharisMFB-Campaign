'use client';
import {useActionState,useState} from 'react';
import {saveBrand} from '@/app/dashboard/actions';
type Brand={display_name?:string;tagline?:string;primary_color?:string;secondary_color?:string;website_url?:string;contact_email?:string;postal_address?:string;social_links?:Record<string,string>};
export function CompanyBrandEditor({org,brand}:{org:string;brand:Brand|null}){
 const [state,action,pending]=useActionState(saveBrand,{});
 const [primary,setPrimary]=useState(brand?.primary_color||'#40239a');
 const [accent,setAccent]=useState(brand?.secondary_color||'#38ef92');
 return <form className="admin-form" action={action}><input type="hidden" name="organization_id" value={org}/><h2>Company identity</h2>
 <label>Display name<input name="display_name" required minLength={2} maxLength={160} defaultValue={brand?.display_name||''}/></label>
 <label>Tagline<input name="tagline" maxLength={240} defaultValue={brand?.tagline||''}/></label>
 <p className="muted">Use the Charis brand palette for customer facing email layouts. Current saved colors remain unchanged until you choose a preset and save.</p>
 <div className="charis-brand-presets"><button type="button" onClick={()=>{setPrimary('#40239a');setAccent('#38ef92');}}><span className="charis-brand-swatch" style={{background:'#40239a'}}/><span className="charis-brand-swatch" style={{background:'#38ef92'}}/> Use official Charis palette</button></div>
 <div className="charis-brand-preview" aria-label="Brand colors preview"><span className="charis-brand-preview-bar" style={{background:primary}}/><span><strong>Charis customer communications</strong><small>Preview of your email brand colors</small></span><span className="charis-brand-preview-dot" style={{background:accent}}/></div>
 <div className="form-two"><label>Primary color<input type="color" name="primary_color" value={primary} onChange={e=>setPrimary(e.target.value)}/></label><label>Accent color<input type="color" name="secondary_color" value={accent} onChange={e=>setAccent(e.target.value)}/></label></div>
 <label>Website URL<input type="url" name="website_url" placeholder="https://company.example" defaultValue={brand?.website_url||''}/></label>
 <label>Contact email<input type="email" name="contact_email" defaultValue={brand?.contact_email||''}/></label>
 <label>Official business postal address (required for campaign email)<textarea name="postal_address" rows={3} defaultValue={brand?.postal_address||''}/></label>
 <h3>Social links</h3>{(['facebook','instagram','linkedin','x'] as const).map(key=><label key={key}>{key}<input type="url" name={key} placeholder="https://" defaultValue={brand?.social_links?.[key]||''}/></label>)}
 <button className="btn" disabled={pending}>{pending?'Saving…':'Save company branding'}</button><p role="status">{state.error||state.success}</p><p className="muted">Your bank-approved logo, favicon and media library are managed below. Changes are saved securely to Supabase.</p></form>;
}
