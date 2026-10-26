import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const sql=readFileSync(new URL('../supabase/migrations/077_charis_zoho_manual_correspondence.sql',import.meta.url),'utf8');
const org='11111111-1111-4111-8111-111111111111';
const staff='22222222-2222-4222-8222-222222222222';
const nonce='33333333-3333-4333-8333-333333333333';
test('SQL creates an idempotent one-to-one audit record with protected completion',async()=>{
 const db=new PGlite();
 try{
  await db.exec("CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid primary key); CREATE TABLE public.organizations(id uuid primary key,slug text,status text);");
  await db.exec("CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT '"+staff+"'::uuid $$;");
  await db.exec("CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS $$ SELECT '{\"email\":\"oluwaseyi.a@charismfb.com\"}'::jsonb $$;");
  await db.exec("CREATE FUNCTION public.charis_direct_can_send(p_org uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT p_org='"+org+"'::uuid $$;");
  await db.exec("CREATE FUNCTION public.charis_direct_is_admin(p_org uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;");
  await db.exec("INSERT INTO auth.users(id) VALUES('"+staff+"'); INSERT INTO public.organizations(id,slug,status) VALUES('"+org+"','charis-mfb','active');");
  await db.exec(sql);
  const args="'"+org+"','"+nonce+"','oluwaseyi.a@charismfb.com','client@example.com','Test Charis letter'";
  const first=await db.query("SELECT public.charis_zoho_manual_reserve_077("+args+") AS id");
  assert.equal(first.rows.length,1);
  await assert.rejects(db.query("SELECT public.charis_zoho_manual_reserve_077("+args+")"),/already been submitted/);
  const count=await db.query('SELECT count(*)::int AS number FROM public.charis_zoho_manual_letters');
  assert.equal(count.rows[0].number,1);
  const id=first.rows[0].id;
  const complete=await db.query("SELECT public.charis_zoho_manual_complete_077('"+org+"','"+id+"','accepted','smtp-message-1') AS updated");
  assert.equal(complete.rows[0].updated,true);
  const final=await db.query('SELECT status,recipient_email,provider_message_id FROM public.charis_zoho_manual_letters');
  assert.equal(final.rows[0].status,'accepted');
  assert.equal(final.rows[0].recipient_email,'client@example.com');
  assert.equal(final.rows[0].provider_message_id,'smtp-message-1');
  const again=await db.query("SELECT public.charis_zoho_manual_complete_077('"+org+"','"+id+"','accepted','smtp-message-2') AS updated");
  assert.equal(again.rows[0].updated,false);
 }finally{await db.close();}
});
