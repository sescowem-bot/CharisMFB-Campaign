import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeZohoLists,normalizeZohoContacts,dedupeZohoContacts} from '../lib/zoho/contact-sync-core.mjs';
const list={list_key:'abcdef1234567890abcdef1234567890',name:'Charis Customers'};
test('normalizes Zoho mailing list inventory',()=>{const rows=normalizeZohoLists({list_of_details:[{listkey:list.list_key,listname:list.name,noofcontacts:'612',lockstatus:'unlocked',is_public:'false'}]});assert.equal(rows.length,1);assert.equal(rows[0].contact_count,612);});
test('normalizes Zoho active, unsubscribe and bounce contacts',()=>{const rows=normalizeZohoContacts({list_of_details:[{contact_email:'A@example.com',firstname:'Ada',lastname:'Okafor',zuid:'123'}]},list,'active');assert.equal(rows[0].email,'a@example.com');assert.equal(rows[0].first_name,'Ada');});
test('deduplicates addresses across lists and prioritizes opt-out over active',()=>{const base={email:'a@example.com',first_name:'Ada',last_name:'',phone:'',zoho_contact_id:'1'};const rows=dedupeZohoContacts([{...base,list_key:'list-one',list_name:'One',status:'active'},{...base,list_key:'list-two',list_name:'Two',status:'unsubscribe'}]);assert.equal(rows.length,1);assert.equal(rows[0].status,'unsubscribe');assert.deepEqual(rows[0].list_keys,['list-one','list-two']);});
test('invalid email rows are not imported',()=>{assert.equal(normalizeZohoContacts({list_of_details:[{contact_email:'not-an-email'}]},list,'active').length,0);});
