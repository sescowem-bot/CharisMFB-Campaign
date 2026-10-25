import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderCampaign} from '../lib/campaigns/render.ts';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('The designer has visible undo, redo and deletion without removing draft recovery',()=>{
 const studio=read('components/template-studio.tsx');
 const editor=read('components/grapes-email-editor.tsx');
 assert.match(studio,/Undo last design change/);
 assert.match(studio,/Redo design change/);
 assert.match(studio,/onClick=\{undo\}/);
 assert.match(studio,/onClick=\{redo\}/);
 assert.match(studio,/Unsaved design found on this browser/);
 assert.match(studio,/localStorage.setItem\(draftKey/);
 assert.match(editor,/Delete selected section/);
 assert.match(editor,/onClick=\{removeSelected\}/);
 assert.match(editor,/duplicateSelected/);
});

test('The email canvas is responsive and every styled shape is created as a distinct element',()=>{
 const editor=read('components/grapes-email-editor.tsx');
 assert.match(editor,/width:calc\(100% - 24px\)!important/);
 assert.match(editor,/overflow-wrap:anywhere!important/);
 assert.match(editor,/word-break:break-word!important/);
 assert.match(editor,/const circle=block.shape==='circle'/);
 assert.match(editor,/const size=Math.round\(104\+width\*1.12\)/);
 assert.match(editor,/max-width:100%;margin/);
 assert.match(editor,/charis-gjs-workspace-focus/);
 assert.match(editor,/Expand canvas/);
});

test('Shape settings are accessible and edit the validated design data',()=>{
 const editor=read('components/grapes-email-editor.tsx');
 const css=read('components/template-studio-premium.css');
 for(const control of ['Circle diameter','Shape width','Minimum height','Text size','Border width','Internal spacing'])assert.ok(editor.includes(control),control);
 assert.match(editor,/className="charis-gjs-quick-sizes"/);
 assert.match(editor,/setSelectedIndex\(found\)/);
 assert.match(css,/charis-gjs-inspector\{max-height:610px;overflow-y:auto/);
 assert.match(css,/charis-gjs-delete/);
});

test('Email delivery renderer outputs a properly dimensioned circle rather than a full-width oval',()=>{
 const design={version:'1',blocks:[{type:'heading',text:'Hello Customer'},{type:'shape',shape:'circle',text:'Good news',color:'#40239A',widthPercent:50,textColor:'#ffffff'}]};
 const html=renderCampaign({design,subject:'Important update',company:'Charis Microfinance Bank',address:'Lagos',color:'#40239A',testPreview:true});
 assert.match(html.html,/width="160"/);
 assert.match(html.html,/height="160"/);
 assert.match(html.html,/border-radius:50%/);
 assert.match(html.html,/Good news/);
});
