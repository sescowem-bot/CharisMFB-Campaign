import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('Claude visual language is real layout architecture, not a palette-only overlay', () => {
 const styles = read('app/charis-claude-faithful.css');
 assert.match(styles, /--purple-700:\s*#40239a/i);
 assert.match(styles, /--green-500:\s*#38ef92/i);
 assert.match(styles, /background:\s*#fff;\s*color:#3a3555/i);
 assert.match(styles, /body\.charis-premium \.sidebar/);
 assert.match(styles, /body\.charis-premium \.topbar/);
 assert.match(styles, /max-width:\s*980px/);
 assert.match(styles, /Century Gothic/);
});

test('app shell has white sidebar and compact header structure plus all core Charis routes', () => {
 const shell=read('components/workspace-shell.tsx');
 for(const cls of ['className="app"','className="sidebar"','className="topbar"','className="page"','className="page-head"']) assert.ok(shell.includes(cls),cls);
 for(const route of ['dashboard/contacts','dashboard/imports','dashboard/lists','dashboard/segments','dashboard/campaigns','dashboard/approvals','dashboard/delivery','dashboard/templates','dashboard/senders','dashboard/team']) assert.ok(shell.includes(route),route);
 assert.ok(shell.includes('currentVerifiedUser()'));
 assert.doesNotMatch(shell, /account\?\.email/);
 assert.ok(existsSync(new URL('../public/charis-official-logo.png', import.meta.url)));
});

test('staff login follows two-panel Claude design while keeping Supabase login', () => {
 const login=read('app/login/page.tsx');
 for(const token of ['className="auth"','auth-aside','auth-main','auth-box','<AuthForm mode="login"/>','currentVerifiedUser()']) assert.ok(login.includes(token),token);
});

test('bank layout does not call the legacy CMS site function during ordinary render', () => {
 const root=read('app/layout.tsx');
 assert.ok(root.includes("import './charis-claude-faithful.css'"));
 assert.match(root,/className="charis-premium"/);
 assert.doesNotMatch(root,/publishedSite/);
});
