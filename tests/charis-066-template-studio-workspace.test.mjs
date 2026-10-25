import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Template library has a distinct gallery with ten starter designs and saved designs',()=>{
 const page=read('app/dashboard/templates/page.tsx');
 const gallery=read('components/template-gallery.tsx');
 const presets=read('lib/campaign/template-presets.ts');
 assert.match(page,/TemplateGallery/);
 assert.doesNotMatch(page,/TemplateStudio/);
 assert.match(gallery,/Saved templates/);
 assert.match(gallery,/Starter designs|Starter designs|Starter designs|Starter designs/i);
 assert.match(gallery,/\/dashboard\/templates\/new\?preset=/);
 assert.match(gallery,/\/dashboard\/templates\/new/);
 assert.match(presets,/charisTemplatePresets/);
 assert.equal((presets.match(/"id": "/g)||[]).length,10);
});
test('New and edit templates have dedicated protected server routes',()=>{
 for(const p of ['app/dashboard/templates/new/page.tsx','app/dashboard/templates/[id]/edit/page.tsx'])assert.ok(existsSync(new URL('../'+p,import.meta.url)));
 const create=read('app/dashboard/templates/new/page.tsx');
 const edit=read('app/dashboard/templates/[id]/edit/page.tsx');
 assert.match(create,/if\(!canEdit\)redirect/);
 assert.match(edit,/if\(!canEdit\)redirect/);
 assert.match(create,/Your email headline/);
 assert.match(create,/mode="create"/);
 assert.match(edit,/mode="edit"/);
 assert.match(edit,/\.eq\('organization_id',org\)/);
 assert.match(read('app/dashboard/templates/page.tsx'),/if\(edit\)redirect/);
});
test('GrapesJS shows custom professional palette and inspector with shape editing',()=>{
 const source=read('components/grapes-email-editor.tsx');
 for(const shape of ['banner','panel','rectangle','pill','circle','rule'])assert.ok(source.includes("shape:'"+shape+"'"),shape);
 assert.match(source,/panels:\{defaults:\[\]\}/);
 assert.match(source,/charis-gjs-palette/);
 assert.match(source,/charis-gjs-inspector/);
 assert.match(source,/onChange\(\{\.\.\.design,blocks/);
 assert.match(source,/setDevice\('Mobile'\)/);
 const css=read('components/template-studio-premium.css');
 assert.match(css,/\.gjs-pn-panels/);
});
test('Save and preview are visible editor actions on the dedicated editor screen',()=>{
 const s=read('components/template-studio.tsx');
 assert.match(s,/className="charis-editor-heading"/);
 assert.match(s,/setShowRenderedPreview\(true\)/);
 assert.match(s,/className="charis-preview-modal"/);
 assert.match(s,/router\.replace\(/);
 assert.match(s,/state\.templateId/);
 assert.match(s,/name="template_id"/);
});
