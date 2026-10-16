import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Campaign Studio loads saved brand website',()=>{
 assert.match(read('app/dashboard/campaigns/page.tsx'),/website_url/);
 assert.match(read('app/dashboard/actions.ts'),/website&&!verifiedBrandWebsite\(website\)/);
 assert.match(read('components/campaign-studio.tsx'),/verifiedBrandWebsite\(brand\.website_url\)/);
 assert.match(read('components/campaign-studio.tsx'),/resolveBrandLinks/);
});
test('Templates get the same bank-controlled website',()=>{
 assert.match(read('app/dashboard/templates/page.tsx'),/websiteUrl=\{branding\?\.website_url\|\|''\}/);
 assert.match(read('components/template-studio.tsx'),/createStarterDesign\(website\)/);
});
test('No example.com CTA is hardcoded in editor defaults',()=>{
 for(const p of ['components/campaign-studio.tsx','components/email-design-canvas.tsx','lib/campaign/design.ts'])
  assert.doesNotMatch(read(p),/url:\s*['"]https:\/\/example\.com/);
});
test('Campaign, template and delivery paths reject demo destinations',()=>{
 assert.match(read('app/dashboard/actions.ts'),/assertNoDemoLinks\(design\)/);
 assert.match(read('app/dashboard/campaigns/actions.ts'),/assertNoDemoLinks\(design\)/);
 assert.match(read('lib/campaigns/render.ts'),/assertNoDemoLinks\(design\)/);
});
