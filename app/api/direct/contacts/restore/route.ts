import {NextResponse} from 'next/server';
import {z} from 'zod';
import {currentAccount} from '@/lib/auth/account';
import {supabaseServer} from '@/lib/supabase/server';

export const runtime='nodejs';
const requestSchema=z.object({ids:z.array(z.string().uuid()).max(500)}).strict();
// Never trust contact information persisted on a device. Only UUIDs are stored;
// rehydrate details from the bank database under the current authenticated staff.
export async function POST(request:Request){
 const account=await currentAccount();
 if(!account)return NextResponse.json({error:'Sign-in required'},{status:401});
 const db=await supabaseServer(),org=account.workspace.id;
 const {data:allowed,error:permissionError}=await db.rpc('charis_direct_can_send',{p_org:org});
 if(permissionError||allowed!==true)return NextResponse.json({error:'Communication access required'},{status:403});
 const payload=requestSchema.safeParse(await request.json().catch(()=>null));
 if(!payload.success)return NextResponse.json({error:'Invalid recipient selection'},{status:400});
 const ids=[...new Set(payload.data.ids)];
 if(!ids.length)return NextResponse.json({contacts:[]},{headers:{'Cache-Control':'no-store'}});
 const {data,error}=await db.from('contacts')
  .select('id,first_name,last_name,email,phone')
  .eq('organization_id',org).is('archived_at',null)
  .in('id',ids).limit(500);
 if(error)return NextResponse.json({error:'Customer directory is temporarily unavailable'},{status:503});
 return NextResponse.json({contacts:data||[]},{headers:{'Cache-Control':'no-store'}});
}
