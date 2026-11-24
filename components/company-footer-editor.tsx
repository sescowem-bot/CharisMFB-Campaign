'use client';
import {useActionState} from 'react';
import {saveFooter} from '@/app/dashboard/actions';
type FooterDesign={company_name?:string;address?:string;contact_email?:string;website_url?:string;disclaimer?:string;social_platforms?:string[]};
type FooterInitial={id:string;name:string;is_default:boolean;design:FooterDesign};
export function CompanyFooterEditor({org,initial}:{org:string;initial?:FooterInitial}){
 const [state,action,pending]=useActionState(saveFooter,{});
 const platforms=['facebook','whatsapp','instagram','linkedin','x','youtube','tiktok'];
 return <form action={action} className="admin-form">
  <input type="hidden" name="organization_id" value={org}/>
  <input type="hidden" name="footer_id" value={initial?.id||''}/>
  <h2>{initial?'Edit email footer':'Create email footer'}</h2>
  <label>Footer name<input name="name" required placeholder="Main company footer" defaultValue={initial?.name||''}/></label>
  <label>Company name<input name="company_name" required defaultValue={initial?.design.company_name||''}/></label>
  <label>Address<textarea name="address" rows={2} defaultValue={initial?.design.address||''}/></label>
  <label>Contact email<input type="email" name="contact_email" defaultValue={initial?.design.contact_email||''}/></label>
  <label>Website<input type="url" name="website_url" defaultValue={initial?.design.website_url||''}/></label>
  <label>Additional notice<textarea name="disclaimer" rows={3} defaultValue={initial?.design.disclaimer||''}/></label>
  <fieldset><legend>Social links to show in this footer</legend>
   <p className="muted">Links are taken from the official URLs saved under Charis Brand Settings. Only configured links will appear.</p>
   <div className="form-two">{platforms.map(key=><label key={key}><input type="checkbox" name="social_platforms" value={key} defaultChecked={initial?(Array.isArray(initial.design.social_platforms)?initial.design.social_platforms.includes(key):true):true}/> {key==='x'?'X (Twitter)':key[0].toUpperCase()+key.slice(1)}</label>)}</div>
  </fieldset>
  <label><input type="checkbox" name="is_default" defaultChecked={initial?.is_default??!initial}/> Set as default footer</label>
  <p className="muted">Choose a footer for each campaign before sending. The unsubscribe link is always included.</p>
  <button className="btn" disabled={pending}>{pending?'Saving…':initial?'Save footer changes':'Save footer'}</button>
  <p role="status">{state.error||state.success}</p>
 </form>;
}
