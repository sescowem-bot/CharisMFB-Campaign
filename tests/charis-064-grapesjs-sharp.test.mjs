import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import sharp from 'sharp';
import {optimizeCampaignMedia} from '../lib/campaign/media-processing.ts';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const pkg=JSON.parse(read('package.json'));
const lock=JSON.parse(read('package-lock.json'));
test('GrapesJS and Sharp are installed and locked',()=>{
 for(const name of ['grapesjs','sharp']){
  assert.ok(pkg.dependencies[name],name+' must be a production dependency');
  assert.equal(lock.packages[''].dependencies[name],pkg.dependencies[name]);
  assert.ok(lock.packages['node_modules/'+name],name+' must resolve in package-lock');
 }
});
test('Template Studio supports both GrapesJS and the legacy detailed editor with server rendering',()=>{
 const s=read('components/template-studio.tsx');
 assert.match(s,/GrapesEmailEditor/);
 assert.match(s,/EmailDesignCanvas/);
 assert.match(s,/renderCampaign\(/);
 assert.match(s,/Save template/);
});
test('GrapesJS editor saves only the validated Charis design schema, not arbitrary HTML',()=>{
 const s=read('components/grapes-email-editor.tsx');
 assert.match(s,/designSchema.safeParse/);
 assert.match(s,/storageManager:false/);
 assert.match(s,/data-charis-type/);
 assert.match(s,/onChangeRef.current\(result.data\)/);
 assert.doesNotMatch(s,/dangerouslySetInnerHTML/);
});
test('Media processing performs authenticated upload, bounds image size, crop and email-compatible image output',()=>{
 const s=read('app/dashboard/branding/media-actions.ts');
 assert.match(s,/allowedEditor\(org\)/);
 assert.match(s,/optimizeCampaignMedia\(bytes,crop\)/);
 assert.match(read('lib/campaign/media-processing.ts'),/crop==='square'/);
 assert.match(read('lib/campaign/media-processing.ts'),/crop==='banner'/);
 assert.match(read('lib/campaign/media-processing.ts'),/\.jpeg\(\{quality:84/);
 assert.match(read('lib/campaign/media-processing.ts'),/\.png\(\{compressionLevel:9/);
 assert.match(s,/bytes:uploadBytes.length/);
});
test('Template interface offers image cropping and existing media library',()=>{
 const s=read('components/template-studio.tsx');
 assert.match(s,/name="crop"/);
 assert.match(s,/Manage media library/);
 assert.ok(existsSync(new URL('../components/email-design-canvas.tsx',import.meta.url)));
});

test('Sharp processes email-compatible JPEG output and produces requested dimensions',async()=>{
 const image=await sharp({create:{width:900,height:600,channels:3,background:'#2255aa'}}).png().toBuffer();
 const square=await optimizeCampaignMedia(new Uint8Array(image),'square');
 const banner=await optimizeCampaignMedia(new Uint8Array(image),'banner');
 const original=await optimizeCampaignMedia(new Uint8Array(image),'none');
 const [sm,bm,om]=await Promise.all([sharp(square.bytes).metadata(),sharp(banner.bytes).metadata(),sharp(original.bytes).metadata()]);
 assert.equal(sm.format,'jpeg');
 assert.equal(square.mime,'image/jpeg');
 assert.equal(sm.width,1000);assert.equal(sm.height,1000);
 assert.equal(bm.width,1200);assert.equal(bm.height,600);
 assert.equal(om.width,900);assert.equal(om.height,600);
 assert.ok(square.bytes.length<=2*1024*1024);
});
test('Sharp rejects empty or oversized raster payload',async()=>{
 await assert.rejects(()=>optimizeCampaignMedia(new Uint8Array(), 'none'),/Source image/);
 await assert.rejects(()=>optimizeCampaignMedia(new Uint8Array(2*1024*1024+1), 'banner'),/Source image/);
});

test('Sharp preserves alpha using email-compatible PNG',async()=>{
 const image=await sharp({create:{width:64,height:64,channels:4,background:{r:30,g:60,b:90,alpha:0.3}}}).png().toBuffer();
 const output=await optimizeCampaignMedia(new Uint8Array(image),'none');
 assert.equal(output.mime,'image/png');
 assert.equal(output.ext,'png');
 const meta=await sharp(output.bytes).metadata();
 assert.equal(meta.format,'png');
 assert.equal(meta.hasAlpha,true);
});
