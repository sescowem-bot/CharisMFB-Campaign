import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Nodemailer is installed but NOT part of bulk campaign delivery',()=>{
 const pkg=JSON.parse(read('package.json'));
 assert.match(pkg.dependencies.nodemailer,/^\^?7\./);
 assert.match(pkg.devDependencies['@types/nodemailer'],/^\^?7\./);
 assert.match(pkg.scripts['check:zoho'],/scripts\/check-zoho-smtp\.mjs/);
 assert.match(pkg.scripts['check:zoho:self'],/--send-to-self/);
 assert.doesNotMatch(read('lib/direct/dispatch.ts'),/nodemailer|zoho-smtp/);
});
test('The staff SMTP check enforces Charis membership and mailbox identity',()=>{
 const s=read('app/dashboard/zoho-smtp/actions.ts');
 assert.match(s,/currentAccount\(\),currentVerifiedUser\(\)/);
 assert.match(s,/user\.email_confirmed_at/);
 assert.match(s,/account\.workspace\.id!==charisOrgId\(\)/);
 assert.match(s,/ZOHO_SMTP_TEST_ENABLED/);
 assert.match(s,/mailbox\(user.email\)!==config.user/);
 assert.match(s,/verifyZohoStaffSmtp\(config\)/);
 assert.doesNotMatch(s,/sendMail\(/);
 assert.doesNotMatch(s,/from\('contacts'\)/);
});
test('Credentials remain server-side and SMTP uses authenticated encryption',()=>{
 const s=read('lib/email/zoho-smtp.ts');
 assert.match(s,/import 'server-only'/);
 assert.match(s,/nodemailer\.createTransport/);
 assert.match(s,/ZOHO_SMTP_APP_PASSWORD/);
 assert.match(s,/Zoho SMTP must use port 465 or 587/);
 assert.match(s,/requireTLS:config.port===587/);
 assert.match(s,/minVersion:'TLSv1.2'/);
 assert.match(s,/await transport.verify\(\)/);
 assert.match(s,/transport.close\(\)/);
 assert.doesNotMatch(s,/rejectUnauthorized:false/);
});
test('Self-test has no arbitrary destination or customer sending',()=>{
 const s=read('scripts/check-zoho-smtp.mjs');
 assert.match(s,/process\.argv\.includes\('--send-to-self'\)/);
 assert.match(s,/await transport.verify\(\)/);
 assert.match(s,/to:user,subject:'Zoho SMTP personal mailbox check'/);
 assert.doesNotMatch(s,/--to=|process\.argv\[2\]|contacts|recipientList/);
 assert.match(read('.gitignore'),/^\.env\*/m);
});
test('Nodemailer is resolvable and generates offline email without using SMTP',async()=>{
 const {default:mailer}=await import('nodemailer');
 const transport=mailer.createTransport({streamTransport:true,buffer:true,newline:'unix'});
 const result=await transport.sendMail({from:'staff@example.test',to:'staff@example.test',subject:'Local self check',text:'No network traffic'});
 assert.match(result.message.toString(),/Local self check/);
 transport.close();
});
