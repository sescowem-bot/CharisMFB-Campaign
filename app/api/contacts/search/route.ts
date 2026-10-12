import {NextRequest, NextResponse} from 'next/server';
import {z} from 'zod';
import {contactsAccess} from '@/lib/contacts/access';

/** The recipient picker never exposes other organizations' records or bypasses consent. */
export async function GET(request:NextRequest){
 const params=request.nextUrl.searchParams;
 const parsed=z.object({org:z.string().uuid(),q:z.string().max(80).default(''),page:z.coerce.number().int().min(1).max(100).default(1)}).safeParse({org:params.get('org'),q:params.get('q')||'',page:params.get('page')||'1'});
 if(!parsed.success)return NextResponse.json({error:'Invalid search'},{status:400});
 const {db,user,authorized}=await contactsAccess(parsed.data.org);
 if(!user)return NextResponse.json({error:'Sign in required'},{status:401});
 if(!authorized)return NextResponse.json({error:'You cannot view recipients in this company'},{status:403});
 const {data,error}=await db.rpc('charis_recipient_search',{p_org:parsed.data.org,p_query:parsed.data.q,p_page:parsed.data.page});
 if(error)return NextResponse.json({error:'Recipient search unavailable. Apply the Charis simplification SQL migration.'},{status:503});
 return NextResponse.json({contacts:data||[]},{headers:{'Cache-Control':'no-store'}});
}
