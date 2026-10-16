import {NextResponse} from 'next/server';
import {currentAccount} from '@/lib/auth/account';
import {supabaseServer} from '@/lib/supabase/server';
export const runtime='nodejs';
export async function GET(request:Request){
 const account=await currentAccount();if(!account)return NextResponse.json({error:'Sign-in required'},{status:401});
 const db=await supabaseServer(),org=account.workspace.id;
 const {data:allowed,error:permissionError}=await db.rpc('charis_direct_can_send',{p_org:org});
 if(permissionError||allowed!==true)return NextResponse.json({error:'Communication access required'},{status:403});
 const query=(new URL(request.url).searchParams.get('q')||'').trim().replace(/[^a-zA-Z0-9 +@._-]/g,'').slice(0,70);
 if(query.length<2)return NextResponse.json({contacts:[]});
 const {data,error}=await db.from('contacts').select('id,first_name,last_name,email,phone')
 .eq('organization_id',org).is('archived_at',null)
 .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%`).limit(50);
 if(error)return NextResponse.json({error:'Customer directory unavailable'},{status:503});
 return NextResponse.json({contacts:data||[]},{headers:{'Cache-Control':'no-store'}});
}
