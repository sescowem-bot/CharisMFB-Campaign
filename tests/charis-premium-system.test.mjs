import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
const root=new URL('../',import.meta.url);
const read=p=>readFileSync(new URL(p,root),'utf8');
test('premium Charis brand assets and responsive design are bundled',()=>{
 for(const p of ['public/charis-official-logo.png','public/charis-official-mark.png','public/favicon.ico','app/icon.png','app/charis-premium.css'])assert.ok(existsSync(new URL(p,root)),p);
 const css=read('app/charis-premium.css');
 for(const token of ['--charis-purple','--charis-teal','--charis-ink','charis-mobile-bar','prefers-reduced-motion'])assert.ok(css.includes(token),token);
});
test('single-bank navigation exposes high-value workflows, no billing or company switching',()=>{
 const s=read('components/charis-navigation.tsx');
 for(const v of ['Customers','Import customers','Saved groups','Approvals','Send & delivery','Reports','Team access'])assert.ok(s.includes(v),v);
 assert.doesNotMatch(s,/Pricing|Billing|Switch company/);
});
test('dashboard uses actual database counts and no illustrative campaign metrics',()=>{
 const s=read('app/dashboard/page.tsx');
 assert.match(s,/charis_dashboard_overview/);
 const migration=read('supabase/migrations/019_charis_dashboard_and_campaign_lead.sql');
 for(const source of ['campaign_drafts','pending_approval','campaign_runs'])assert.ok(migration.includes(source));
 assert.doesNotMatch(s,/Math\.random\(/);
});
test('Resend is never consulted for routine sender page views',()=>{
 const s=read('app/dashboard/senders/page.tsx');
 assert.match(s,/sender_identities/);
 assert.doesNotMatch(s,/await listVerifiedResendDomains/);
 assert.match(read('app/dashboard/senders/charis-actions.ts'),/findResendDomain/);
});
test('campaign workflow keeps independently approved send actions',()=>{
 const s=read('app/dashboard/campaigns/page.tsx');
 assert.match(s,/can_approve_campaigns/);
 assert.match(s,/CharisWorkflowSteps/);
 assert.match(read('app/dashboard/approvals/page.tsx'),/submitted_by!==user\.id/);
});
