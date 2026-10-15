import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const read=(p)=>readFileSync(new URL(`../${p}`,import.meta.url),'utf8');

test('Century Gothic is opt-in display typography only and does not fetch a font',()=>{
 const css=read('app/charis-design-v3.css');
 assert.match(css,/--charis-font-display:'Century Gothic'/);
 assert.match(css,/\.charis-login-feature h1/);
 assert.match(css,/\.charis-topbar h1/);
 assert.match(css,/--charis-font-body:/);
 assert.doesNotMatch(css,/@font-face|fonts\.googleapis|url\(/);
 assert.match(read('app/layout.tsx'),/import '\.\/charis-design-v3\.css'/);
});

test('Official Charis purple and green remain brand tokens',()=>{
 const css=read('app/charis-design-v3.css');
 assert.match(css, /--charis-purple:#40239a/);
 assert.match(css, /--charis-indigo:#2a1670/);
 assert.match(css, /--charis-teal:#38ef92/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(css,/focus-visible/);
});

test('Brand palette preset requires an explicit save and does not edit database automatically',()=>{
 const f=read('components/company-brand-editor.tsx');
 assert.match(f,/Use official Charis palette/);
 assert.match(f,/setPrimary\('#40239a'\)/);
 assert.match(f,/setAccent\('#38ef92'\)/);
 assert.match(f,/action=\{action\}/);
 assert.match(f,/Save company branding/);
});

test('Template preview is Charis-branded while existing template persistence stays intact',()=>{
 const f=read('components/template-studio.tsx');
 assert.match(f,/brandName='Charis Microfinance Bank'/);
 assert.match(f,/brandColor/);
 assert.match(f,/<EmailDesignCanvas design=\{design\}/);
 assert.match(f,/JSON.stringify\(design\)/);
 assert.match(f,/saveTemplate/);
 assert.match(read('app/dashboard/templates/page.tsx'),/organization_branding/);
});

test('Operations and SQL history are preserved and campaign paths remain visible',()=>{
 const nav=read('components/workspace-shell.tsx');
 for(const label of ['Communications','Audience filters','Approvals','Sender settings','Team access'])assert.ok(nav.includes(label),label);
 assert.ok(existsSync(new URL('../supabase/migrations/019_charis_dashboard_and_campaign_lead.sql',import.meta.url)));
 assert.match(read('components/charis-ui.tsx'),/Awaiting approval/);
});
