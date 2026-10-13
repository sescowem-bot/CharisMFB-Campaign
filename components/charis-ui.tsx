import type {ReactNode} from 'react';
import Link from 'next/link';
import {ArrowRight,Inbox,ShieldCheck} from 'lucide-react';

/** Shared presentational primitives: consistent semantics and styles, no database work. */
export function CharisWorkflowSteps({steps}:{steps:readonly string[]}) {
 return <nav aria-label="Campaign process" className="charis-workflow-ribbon">{steps.map((label,i)=><span key={label}>{i+1} · {label}</span>)}</nav>;
}
export function CharisStatus({status}:{status:string}){
 const key=status.toLowerCase();
 const tone=['approved','sent','delivered','verified','active','accepted','successful'].includes(key)?'success'
  :['pending','pending_approval','draft','queued','running','scheduled','processing'].includes(key)?'warning'
  :['rejected','failed','revoked','blocked','error'].includes(key)?'danger':'neutral';
 const labels:Record<string,string>={pending_approval:'Awaiting approval',in_progress:'In progress',ready_to_send:'Ready to send'};
 return <span className="charis-status" data-tone={tone} aria-label={`Status: ${labels[key]||status.replaceAll('_',' ')}`}>{labels[key]||status.replaceAll('_',' ')}</span>;
}
export function CharisEmptyState({title,description,href,action}:{title:string;description:string;href?:string;action?:string}){
 return <section className="panel charis-empty-state"><Inbox size={28} aria-hidden="true"/><h3>{title}</h3><p className="muted">{description}</p>{href&&action&&<Link className="btn secondary" href={href}>{action}<ArrowRight size={15}/></Link>}</section>;
}
export function CharisSectionHeader({title,description,action}:{title:string;description?:string;action?:ReactNode}){
 return <div className="workspace-heading charis-section-header"><div><h2>{title}</h2>{description&&<p className="muted">{description}</p>}</div>{action}</div>;
}
export function CharisSafetyNote({children}:{children:ReactNode}){
 return <div className="charis-guide-card"><ShieldCheck size={18}/>{children}</div>;
}
