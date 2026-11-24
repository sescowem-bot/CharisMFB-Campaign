import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {optimizeCampaignMedia} from '../lib/campaign/media-processing.ts';

test('uncropped JPEG campaign artwork is preserved byte-for-byte',async()=>{
 const source=await sharp({create:{width:1800,height:1200,channels:3,background:{r:20,g:80,b:140}}}).jpeg({quality:92}).toBuffer();
 const result=await optimizeCampaignMedia(new Uint8Array(source),'none');
 assert.equal(result.mime,'image/jpeg');
 assert.deepEqual(Buffer.from(result.bytes),source);
});
test('uncropped PNG campaign artwork is preserved byte-for-byte',async()=>{
 const source=await sharp({create:{width:1200,height:800,channels:4,background:{r:40,g:60,b:120,alpha:0.7}}}).png().toBuffer();
 const result=await optimizeCampaignMedia(new Uint8Array(source),'none');
 assert.equal(result.mime,'image/png');
 assert.deepEqual(Buffer.from(result.bytes),source);
});
test('cropped campaign images remain within the requested square dimensions',async()=>{
 const source=await sharp({create:{width:1800,height:900,channels:3,background:{r:90,g:40,b:150}}}).jpeg().toBuffer();
 const result=await optimizeCampaignMedia(new Uint8Array(source),'square');
 const meta=await sharp(Buffer.from(result.bytes)).metadata();
 assert.equal(meta.width,900);
 assert.equal(meta.height,900);
});
