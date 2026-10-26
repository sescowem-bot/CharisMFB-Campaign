import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const sql=readFileSync(new URL('../supabase/migrations/079_charis_zeptomail_transactional.sql',import.meta.url),'utf8');
test('Migration 079: verifies idempotent transactional notification audit and completion in PostgreSQL',async()=>{
 const db=new PGlite();
 const org='11111111-1111-4111-8111-111111111111';
 const user='22222222-2222-4222-8222-222222222222';
 const nonce='33333333-3333-4333-8333-333333333333';
 try{
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid primary key); CREATE TABLE public.organizations(id uuid primary key,slug text);');
  await db.exec("CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT '"+user+"'::uuid $$;");
  await db.exec("CREATE FUNCTION public.charis_direct_can_send(p_org uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT p_org='"+org+"'::uuid $$;");
  await db.exec("CREATE FUNCTION public.charis_direct_is_admin(p_org uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;");
  await db.exec("INSERT INTO auth.users(id) VALUES('"+user+"'); INSERT INTO public.organizations(id,slug) VALUES('"+org+"','charis-mfb');");
  await db.exec(sql);
  const args="'"+org+"','"+nonce+"','notices@charismfb.com','client@example.org','Your loan reminder','loan_reminder','LOAN-2210'";
  const first=await db.query('SELECT public.charis_zepto_reserve_079('+args+') AS id');
  assert.ok(first.rows[0].id);
  await assert.rejects(db.query('SELECT public.charis_zepto_reserve_079('+args+')'),/already been submitted/);
  const id=first.rows[0].id;
  const done=await db.query("SELECT public.charis_zepto_complete_079('"+org+"','"+id+"','accepted','zepto-mail-id') AS ok");
  assert.equal(done.rows[0].ok,true);
  const repeat=await db.query("SELECT public.charis_zepto_complete_079('"+org+"','"+id+"','accepted','zepto-mail-id') AS ok");
  assert.equal(repeat.rows[0].ok,false);
  const read=await db.query('SELECT status,recipient_email FROM public.charis_zeptomail_notices');
  assert.equal(read.rows[0].status,'accepted');
  assert.equal(read.rows[0].recipient_email,'client@example.org');
 }finally{await db.close();}
});
