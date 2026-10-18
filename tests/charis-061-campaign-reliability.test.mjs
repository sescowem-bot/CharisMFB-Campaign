import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const actions=read('app/dashboard/communications/actions.ts');
const history=read('app/dashboard/communications/page.tsx');
const composer=read('components/direct-compose.tsx');
const boundary=read('app/error.tsx');
const migration=read('supabase/migrations/055_charis_campaign_composer.sql');

test('rich email content is derived from the validated design, not rejected due to hidden-form mismatch',()=>{
 assert.match(actions,/finalBody=campaignParagraphs\(design\)/);
 assert.doesNotMatch(actions,/campaignParagraphs\(design\)!==parsed\.body/);
 assert.match(actions,/p_body:finalBody/);
 assert.match(actions,/checkDirectDesign\(design,brand\.website_url,parsed\.subject\)/);
 assert.match(actions,/renderCampaign\(\{design,subject:parsed.subject/);
 assert.match(actions,/if\(finalBody\.length<10\|\|finalBody\.length>2000/);
 assert.match(migration,/p_design/);
});

test('plain emails and SMS retain validation and rich designs never enter SMS channel',()=>{
 assert.match(actions,/parsed\.channel==='sms'&&designInput/);
 assert.match(actions,/parsed\.channel==='sms'&&finalBody\.length>480/);
 assert.match(actions,/channel:z\.enum\(\['email','sms'\]\)/);
});

test('recent campaigns include earlier records with organisation filter and permission gate',()=>{
 assert.match(history,/canViewEarlier=account\.owner\|\|account\.admin/);
 assert.match(history,/db\.from\('campaign_drafts'\)/);
 assert.match(history,/\.eq\('organization_id',org\)/);
 assert.match(history,/Earlier campaigns/);
 assert.match(history,/db\.from\('charis_direct_messages'\)/);
 assert.match(history,/await Promise\.all/);
});

test('duplicate campaign submission is blocked after a saved ID is returned',()=>{
 assert.match(composer,/disabled=\{pending\|\|!!state\.id/);
 assert.match(composer,/href=\{`\/dashboard\/communications\/history\?id=\$\{state\.id\}`\}/);
});

test('error recovery directs staff to history before reloading an old form',()=>{
 assert.match(boundary,/Check campaigns/);
 assert.match(boundary,/Reload campaign page/);
 assert.match(boundary,/check its status before sending again/);
 assert.doesNotMatch(boundary,/onClick=\{reset\}/);
});
