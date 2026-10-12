import {NextResponse} from 'next/server';
import {z} from 'zod';
import {sameOrigin,boundedText,bodyErrorResponse} from '@/lib/security/request';
import {contactsAccess} from '@/lib/contacts/access';
export async function POST(request:Request){
 try{
  if(!sameOrigin(request))return NextResponse.json({error:'Cross-origin request rejected'},{status:403});
  if(!request.headers.get('content-type')?.startsWith('application/json'))return NextResponse.json({error:'JSON required'},{status:415});
  const parsed=z.object({organization_id:z.string().uuid(),name:z.string().trim().min(2).max(100)}).safeParse(JSON.parse(await boundedText(request,3000)));
  if(!parsed.success)return NextResponse.json({error:'Enter a list name between 2 and 100 characters'},{status:400});
  const {db,user,authorized}=await contactsAccess(parsed.data.organization_id);
  if(!user)return NextResponse.json({error:'Sign in required'},{status:401});
  if(!authorized)return NextResponse.json({error:'Not authorized'},{status:403});
  const {data,error}=await db.rpc('save_contact_list',{p_org:parsed.data.organization_id,p_name:parsed.data.name,p_description:'Created from a contact import'});
  if(error)return NextResponse.json({error:error.code==='23505'?'This list already exists. Choose an existing list or another name.':error.message},{status:422});
  return NextResponse.json({id:data},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return bodyErrorResponse(e)||NextResponse.json({error:'Cannot create list'},{status:400});}
}
