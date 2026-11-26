import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('format toolbar preserves canvas text selection and applies marks to the selected range',()=>{
 const editor=read('components/grapes-email-editor.tsx');
 assert.match(editor,/selection\.getRangeAt\(0\)/);
 assert.match(editor,/range\.extractContents\(\)/);
 assert.match(editor,/range\.insertNode\(wrapper\)/);
 assert.match(editor,/onMouseDown=\{event=>event\.preventDefault\(\)\}/);
 assert.match(editor,/extractInlineRuns\(selectedElement\)/);
 assert.match(editor,/richText:runs\.some/);
});

test('heading and paragraph typography controls write through the validated block format and render on the canvas',()=>{
 const editor=read('components/grapes-email-editor.tsx');
 assert.match(editor,/font-family:\$\{block\.format\?\.fontFamily\|\|'Arial'\}/);
 assert.match(editor,/font-size:\$\{block\.format\?\.fontSize\|\|25\}px/);
 assert.match(editor,/font-size:\$\{block\.format\?\.fontSize\|\|16\}px/);
 assert.match(editor,/fontFamily:e\.target\.value/);
 assert.match(editor,/fontSize:Number\(e\.target\.value\)/);
 assert.match(editor,/instance\.current\.setComponents\(design\.blocks\.map/);
});

test('inline formatting parser recognises semantic and CSS marks without accepting arbitrary markup',()=>{
 const editor=read('components/grapes-email-editor.tsx');
 const schema=read('lib/campaign/design.ts');
 assert.match(editor,/el\.tagName==='B'\|\|el\.tagName==='STRONG'/);
 assert.match(editor,/el\.tagName==='I'\|\|el\.tagName==='EM'/);
 assert.match(editor,/style\.textDecoration\.includes\('underline'\)/);
 assert.match(schema,/const inlineRun=z\.object/);
});