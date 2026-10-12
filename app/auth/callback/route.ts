import {NextRequest,NextResponse} from 'next/server';
import {supabaseServer} from '@/lib/supabase/server';
export async function GET(request:NextRequest){
 const code=request.nextUrl.searchParams.get('code');
 if(!code)return NextResponse.redirect(new URL('/login?error=invalid_link',request.url));
 const db=await supabaseServer();
 const {error}=await db.auth.exchangeCodeForSession(code);
 if(error)return NextResponse.redirect(new URL('/login?error=confirmation',request.url));
 // Authenticated claim only matches the verified email and the still-pending Charis invitation.
 await db.rpc('team_invitation_accept');
 const next=request.nextUrl.searchParams.get('next');
 const destination=next==='/auth/setup-password'?next:'/dashboard';
 return NextResponse.redirect(new URL(destination,request.url));
}
