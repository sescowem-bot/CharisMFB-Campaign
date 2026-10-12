import test from 'node:test';
import assert from 'node:assert/strict';
import {appMode,isSaasOnlyRoute,singleModeRedirect} from '../lib/mode.ts';
const org='20000000-0000-4000-8000-000000000001';
test('single system is the default; multi must be explicit',()=>{assert.equal(appMode({}),'single');assert.equal(appMode({APP_MODE:'multi'}),'multi');assert.equal(appMode({APP_MODE:'anything'}),'single');});
test('SaaS-only routes are recognised and workspace routes are not',()=>{for(const p of ['/pricing','/register','/billing','/billing/return','/admin/plans','/admin/companies','/features'])assert.ok(isSaasOnlyRoute(p),p);for(const p of ['/login','/dashboard/campaigns','/admin','/admin/audit','/privacy','/unsubscribe','/pricingx'])assert.ok(!isSaasOnlyRoute(p),p);});
test('single mode sends visitors to login or the app and hides SaaS pages',()=>{
 assert.equal(singleModeRedirect({pathname:'/',hasSession:false,orgParam:null,orgCookie:undefined}),'/login');
 assert.equal(singleModeRedirect({pathname:'/',hasSession:true,orgParam:null,orgCookie:undefined}),'/dashboard');
 assert.equal(singleModeRedirect({pathname:'/register',hasSession:false,orgParam:null,orgCookie:undefined}),'/login');
 assert.equal(singleModeRedirect({pathname:'/pricing',hasSession:true,orgParam:null,orgCookie:undefined}),'/dashboard');
 assert.equal(singleModeRedirect({pathname:'/privacy',hasSession:false,orgParam:null,orgCookie:undefined}),null);
});
test('single mode restores the organisation from the cookie and rejects malformed values',()=>{
 assert.equal(singleModeRedirect({pathname:'/dashboard/contacts',hasSession:true,orgParam:null,orgCookie:org}),`/dashboard/contacts?org=${org}`);
 assert.equal(singleModeRedirect({pathname:'/dashboard/contacts',hasSession:true,orgParam:org,orgCookie:org}),null);
 assert.equal(singleModeRedirect({pathname:'/dashboard/contacts',hasSession:true,orgParam:null,orgCookie:'not-a-uuid'}),null);
 assert.equal(singleModeRedirect({pathname:'/dashboard',hasSession:true,orgParam:null,orgCookie:org}),null);
});
