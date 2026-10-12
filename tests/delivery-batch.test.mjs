import test from 'node:test';
import assert from 'node:assert/strict';
import {runBatch,batchOptionsFromEnv} from '../lib/delivery/batch.ts';
const clock=()=>{let t=0;return {now:()=>t,sleep:async ms=>{t+=ms;},tick:ms=>{t+=ms;}}};
test('batch sends until the queue is idle and spaces real submissions',async()=>{
 const c=clock();const queue=['accepted','accepted','suppressed','accepted','idle'];const sleeps=[];
 const out=await runBatch(async()=>{c.tick(300);return {result:queue.shift()};},{maxMs:100000,spacingMs:2100,maxItems:50,now:c.now,sleep:async ms=>{sleeps.push(ms);await c.sleep(ms);}});
 assert.equal(out.submitted,3);assert.equal(out.processed,4);assert.equal(out.stopped,'idle');assert.deepEqual(sleeps,[2100,2100,2100]);assert.equal(out.counts.suppressed,1);
});
test('batch stops on provider or quota limits instead of spinning',async()=>{
 const c=clock();for(const r of ['provider_limit','company_limit','retry']){
  const out=await runBatch(async()=>({result:r}),{maxMs:100000,spacingMs:10,maxItems:50,now:c.now,sleep:c.sleep});assert.equal(out.stopped,'limit');assert.equal(out.processed,0);}
});
test('batch respects the time budget and leaves a safety margin',async()=>{
 const c=clock();let calls=0;
 const out=await runBatch(async()=>{calls+=1;c.tick(1000);return {result:'accepted'};},{maxMs:20000,spacingMs:2000,maxItems:1000,marginMs:5000,now:c.now,sleep:c.sleep});
 assert.equal(out.stopped,'deadline');assert.ok(out.elapsedMs<=20000-5000+1000,`elapsed ${out.elapsedMs}`);assert.ok(calls>=3&&calls<10);
});
test('batch honours the item cap and reports disabled delivery',async()=>{
 const c=clock();
 let out=await runBatch(async()=>({result:'accepted'}),{maxMs:10_000_000,spacingMs:1,maxItems:3,now:c.now,sleep:c.sleep});assert.equal(out.stopped,'max_items');assert.equal(out.submitted,3);
 out=await runBatch(async()=>({result:'disabled'}),{maxMs:1000000,spacingMs:1,maxItems:3,now:c.now,sleep:c.sleep});assert.equal(out.stopped,'disabled');
});
test('worker settings are read from the environment with safe bounds',()=>{
 assert.deepEqual(batchOptionsFromEnv({}),{maxMs:100000,spacingMs:2100,maxItems:500});
 assert.equal(batchOptionsFromEnv({EMAIL_WORKER_BUDGET_MS:'999999'}).maxMs,100000);
 assert.equal(batchOptionsFromEnv({EMAIL_WORKER_SPACING_MS:'1200'}).spacingMs,1200);
});
