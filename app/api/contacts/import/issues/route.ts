import {NextRequest,NextResponse} from 'next/server';
import {z} from 'zod';
import {contactsAccess} from '@/lib/contacts/access';
import {sameOrigin,boundedText,bodyErrorResponse} from '@/lib/security/request';

const uuid=z.string().uuid();
const readSchema=z.object({org:uuid,batch:uuid});
const updateSchema=z.object({org:uuid,id:uuid,resolution:z.enum(['reviewed','corrected','kept_existing'])}).strict();
const headers={'Cache-Control':'private, no-store'};

export async function GET(request:NextRequest){
 const input=readSchema.safeParse({org:request.nextUrl.searchParams.get('org'),batch:request.nextUrl.searchParams.get('batch')});
 if(!input.success)return NextResponse.json({error:'Select a valid import batch.'},{status:400,headers});
 const {db,user,authorized}=await contactsAccess(input.data.org);
 if(!user)return NextResponse.json({error:'Sign in required'},{status:401,headers});
 if(!authorized)return NextResponse.json({error:'You cannot review customer imports.'},{status:403,headers});
 const {data:batch,error:batchError}=await db.from('contact_import_batches').select('id,batch_key,inserted_count,skipped_count,rejected_count,created_at').eq('organization_id',input.data.org).eq('id',input.data.batch).maybeSingle();
 if(batchError||!batch)return NextResponse.json({error:'Import batch not found.'},{status:404,headers});
 const {data:issues,error}=await db.from('contact_import_issues').select('id,source_row,issue_type,reason_code,first_name,last_name,email,phone,resolution').eq('organization_id',input.data.org).eq('batch_id',batch.id).order('source_row',{ascending:true}).limit(100);
 if(error)return NextResponse.json({error:'Detailed import review is unavailable. Confirm Migration 022 has been installed.'},{status:503,headers});
 return NextResponse.json({batch,issues:issues||[],hasLegacySummary:!issues?.length&&(batch.skipped_count+batch.rejected_count)>0},{headers});
}

export async function POST(request:Request){
 try{
  if(!sameOrigin(request))return NextResponse.json({error:'Cross-origin request denied'},{status:403,headers});
  if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))return NextResponse.json({error:'JSON required'},{status:415,headers});
  const body=updateSchema.safeParse(JSON.parse(await boundedText(request,2048)));
  if(!body.success)return NextResponse.json({error:'Invalid review request'},{status:400,headers});
  const {db,user,authorized}=await contactsAccess(body.data.org);
  if(!user)return NextResponse.json({error:'Sign in required'},{status:401,headers});
  if(!authorized)return NextResponse.json({error:'You cannot review customer imports.'},{status:403,headers});
  const {data,error}=await db.rpc('charis_review_import_issue',{p_org:body.data.org,p_issue:body.data.id,p_resolution:body.data.resolution});
  if(error)return NextResponse.json({error:'Could not save the review decision.'},{status:422,headers});
  return NextResponse.json({updated:data===true},{headers});
 }catch(e){const bodyError=bodyErrorResponse(e);if(bodyError)return bodyError;return NextResponse.json({error:'Unable to review import row'},{status:400,headers});}
}
