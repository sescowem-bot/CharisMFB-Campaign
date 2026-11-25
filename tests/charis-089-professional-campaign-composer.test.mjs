import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {designSchema} from '../lib/campaign/design.ts';
import {renderCampaign} from '../lib/campaigns/render.ts';
import {customerFieldOptions,safeCustomerAttributeValue} from '../lib/campaign/customer-fields.ts';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

test('campaign designs accept safe text formatting and editable footer settings', () => {
  const parsed = designSchema.safeParse({
    version: '1',
    blocks: [{type: 'heading', text: 'Welcome', format: {
      color: '#123456', fontSize: 28, fontFamily: 'Georgia', align: 'center',
      bold: true, italic: true, underline: true, lineHeight: 2.1, paragraphSpacing: 28, letterSpacing: 0.5
    }}],
    footer: {
      address: '12 Marina Road, Lagos',
      website: 'https://charismfb.com/',
      alignment: 'center',
      backgroundColor: '#f4f5f8',
      textColor: '#334155',
      social: [{platform: 'instagram', url: 'https://instagram.com/charismfb'}]
    }
  });
  assert.equal(parsed.success, true);
  const longEmail = designSchema.safeParse({version:'1',blocks:[{type:'paragraph',text:'A'.repeat(12000)}]});
  assert.equal(longEmail.success, true, 'email paragraphs should not have an arbitrary character cap');
  assert.equal(designSchema.safeParse({
    version: '1', blocks: [{type: 'paragraph', text: 'Hello'}],
    footer: {social: [{platform: 'instagram', url: 'http://instagram.com/charismfb'}]}
  }).success, false);
});

test('rendered campaign email includes the campaign-specific address, website and social link', () => {
  const rendered = renderCampaign({
    design: {
      version: '1',
      blocks: [{type: 'paragraph', text: 'A useful update for our customers.', format: {color: '#123456', fontSize: 18}}],
      footer: {
        address: '12 Marina Road, Lagos',
        website: 'https://charismfb.com/',
        alignment: 'center',
        backgroundColor: '#f4f5f8',
        textColor: '#334155',
        social: [{platform: 'instagram', url: 'https://instagram.com/charismfb'}]
      }
    },
    subject: 'Charis update',
    company: 'Charis Microfinance Bank',
    address: 'Default address'
  });
  assert.match(rendered.html, /12 Marina Road, Lagos/);
  assert.match(rendered.html, /https:\/\/charismfb\.com\//);
  assert.match(rendered.html, /https:\/\/instagram\.com\/charismfb/);
  assert.match(rendered.html, /Instagram/);
  assert.doesNotMatch(rendered.html, /Default address/);
});

test('campaign creation exposes in-page media upload, footer controls and recipient import', () => {
  const editor = read('../components/grapes-email-editor.tsx');
  const composer = read('../components/direct-compose.tsx');
  const importer = read('../components/contact-import-wizard.tsx');
  const uploadRoute = read('../app/api/direct/media/upload/route.ts');
  assert.match(editor, /type="file" accept="image\/png,image\/jpeg,image\/webp"/);
  assert.match(editor, /\/api\/direct\/media\/upload/);
  assert.match(editor, /Text colour/);
  assert.match(editor, /Font family/);
  assert.match(composer, /Email footer & social links/);
  assert.match(composer, /ContactImportWizard org=/);
  assert.match(composer, /campaignMode onComplete=/);
  assert.match(importer, /Use imported recipients in this campaign/);
  assert.match(uploadRoute, /charis_direct_can_send/);
  assert.match(uploadRoute, /campaign\.media\.uploaded/);
});

test('campaign email delivery uses the configured SendByte route without a staff provider picker', () => {
  const action = read('../app/dashboard/communications/actions.ts');
  const composer = read('../components/direct-compose.tsx');
  assert.match(action, /const selectedProvider='sendbyte'/);
  assert.match(composer, /name="send_provider" value="sendbyte"/);
  assert.match(composer, /Email is sent through the bank’s configured email service/);
});

test('paragraph typography controls are validated and rendered into the email', () => {
  const design = {
    version: '1',
    blocks: [{
      type: 'paragraph',
      text: 'A paragraph with custom spacing.',
      format: {
        lineHeight: 2.2,
        paragraphSpacing: 32,
        letterSpacing: 0.75,
        backgroundColor: '#fff2cc'
      }
    }]
  };
  assert.equal(designSchema.safeParse(design).success, true);
  const rendered = renderCampaign({
    design,
    subject: 'Typography test',
    company: 'Charis Microfinance Bank',
    address: 'Lagos'
  });
  assert.match(rendered.html, /line-height:2\.2/);
  assert.match(rendered.html, /letter-spacing:0\.75px/);
  assert.match(rendered.html, /background-color:#fff2cc/);
  assert.match(rendered.html, /margin:0 0 32px/);
});

test('account number merge fields are always labelled and rendered as masked values', () => {
  const fullAccountNumber = '0123456789012';
  for (const key of ['account_number', 'account_no', 'accountnumber', 'acct_no', 'acctnumber']) {
    assert.equal(safeCustomerAttributeValue(key, fullAccountNumber), '•••• 9012');
  }
  assert.equal(safeCustomerAttributeValue('account_type', 'Savings'), 'Savings');
  assert.ok(customerFieldOptions(['account_number']).some(field => field.label === 'Account number (masked · last 4 digits)'));
  const rendered = renderCampaign({
    design: {version:'1', blocks:[{type:'paragraph', text:'Your account: {{attributes.account_number}}'}]},
    subject: 'Account update',
    company: 'Charis Microfinance Bank',
    address: 'Lagos',
    contact: {attributes:{account_number:fullAccountNumber}}
  });
  assert.ok(rendered.html.includes('•••• 9012'));
  assert.ok(!rendered.html.includes(fullAccountNumber));
});

test('campaign editor exposes prominent quick formatting controls before advanced spacing', () => {
  const editor = read('../components/grapes-email-editor.tsx');
  assert.match(editor, /charis-gjs-quick-format/);
  assert.match(editor, /aria-label="Bold"/);
  assert.match(editor, /aria-label="Italic"/);
  assert.match(editor, /aria-label="Underline"/);
  assert.match(editor, /aria-label="Font size"/);
  assert.match(editor, /Paragraph spacing & advanced typography/);
});

test('campaign email HTML does not add SendByte provider branding', () => {
  const rendered = renderCampaign({
    design: {version:'1', blocks:[{type:'paragraph', text:'A bank message for our customers.'}]},
    subject: 'Charis update',
    company: 'Charis Microfinance Bank',
    address: 'Lagos'
  });
  assert.doesNotMatch(rendered.html, /SendByte/i);
});
