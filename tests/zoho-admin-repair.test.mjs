import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('Zoho administration is visible to provider administrators and platform owners',()=>{
 const admin=read('app/admin/page.tsx');
 const shell=read('components/workspace-shell.tsx');
 assert.match(admin,/account\.providerAdmin/);
 assert.match(admin,/href:'\/admin\/zoho-contacts'.*show:providers\|\|account\.providerAdmin\|\|isOwner/);
 assert.match(shell,/account\?\.providerAdmin/);
});

test('Platform super admin management is restricted to existing super admins',()=>{
 const page=read('app/admin/super-admins/page.tsx');
 const action=read('app/admin/super-admins/actions.ts');
 const migration=read('supabase/migrations/087_charis_platform_super_admin_management.sql');
 assert.match(page,/if\(!account\?\.owner\)redirect\('\/admin'\)/);
 assert.match(action,/if\(!account\?\.owner\)/);
 assert.match(migration,/role='super_admin'/);
 assert.match(migration,/last super administrator cannot be removed/i);
});

test('Zoho webhook requires a configured secret and handles complaint and unsubscribe events',()=>{
 const route=read('app/api/webhooks/zoho-campaigns/route.ts');
 assert.match(route,/x-charis-zoho-webhook-secret/i);
 assert.match(route,/timingSafeEqual/);
 assert.match(route,/complaint/);
 assert.match(route,/unsubscribe/);
});
