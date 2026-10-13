import {NextResponse} from 'next/server';
import {z} from 'zod';
import {contactsAccess} from '@/lib/contacts/access';
import {sameOrigin,boundedText,bodyErrorResponse} from '@/lib/security/request';

/** Create a bank-approved saved filter from Campaign Studio; access enforced by the same RPC as Audience Filters. */
export async function POST(request:Request){
 try{
  if(!sameOrigin(request))return NextResponse.json({error:'Request origin not allowed'},{status:403});
  if(!request.headers.get('content-type')?.startsWith('application/json'))return NextResponse.json({error:'JSON required'},{status:415});
  const schema=z.object({organization_id:z.string().uuid(),name:z.string().trim().min(2).max(100),rules:z.object({consent_status:z.enum(['granted','unknown','denied']).optional(),source:z.enum(['manual','import']).optional(),has_email:z.boolean().optional()}).strict().refine(v=>Object.keys(v).length>0)});
  const parsed=schema.safeParse(JSON.parse(await boundedText(request,4000)));
  if(!parsed.success)return NextResponse.json({error:'Enter a group name and choose at least one rule.'},{status:400});
  const {db,user,authorized}=await contactsAccess(parsed.data.organization_id);
  if(!user)return NextResponse.json({error:'Sign in required'},{status:401});
  if(!authorized)return NextResponse.json({error:'Customer-management permission required'},{status:403});
  const {data,error}=await db.rpc('save_contact_segment',{p_org:parsed.data.organization_id,p_name:parsed.data.name,p_description:'Saved from campaign editor',p_rules:parsed.data.rules});
  if(error)return NextResponse.json({error:error.code==='23505'?'A group with that name already exists.':error.message},{status:422});
  return NextResponse.json({id:data},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return bodyErrorResponse(e)||NextResponse.json({error:'Could not create this group.'},{status:400});}
}
