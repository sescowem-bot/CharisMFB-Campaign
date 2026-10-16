import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {join, resolve} from 'node:path';

const root = resolve(import.meta.dirname, '..');
function walk(directory){
 const paths=[];
 for(const entry of readdirSync(directory,{withFileTypes:true})){
  if(entry.name==='node_modules'||entry.name==='.next')continue;
  const path=join(directory,entry.name);
  if(entry.isDirectory()) paths.push(...walk(path));
  else if(/\.(tsx?|mjs)$/.test(entry.name))paths.push(path);
 }
 return paths;
}
test('source files must not contain identical duplicate import statements',()=>{
 for(const file of ['app','lib','components']){
  for(const path of walk(join(root,file))){
   const imports=readFileSync(path,'utf8').split(/\r?\n/).map(x=>x.trim()).filter(x=>x.startsWith('import '));
   const duplicates=imports.filter((x,i)=>imports.indexOf(x)!==i);
   assert.deepEqual(duplicates,[],`Duplicate import in ${path}`);
  }
 }
});
test('delivery worker imports direct batch only once',()=>{
 const code=readFileSync(join(root,'app/api/worker/delivery/route.ts'),'utf8');
 assert.equal(code.match(/import\s*\{\s*sendDirectBatch\s*\}\s*from\s*['"]@\/lib\/direct\/dispatch['"]/g)?.length||0,1);
});
