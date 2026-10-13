import {contentSecurityPolicy} from '@/lib/security/headers';
import {NextResponse, type NextRequest} from 'next/server';
import {createServerClient} from '@supabase/ssr';
export async function middleware(request:NextRequest){
 const single=process.env.SINGLE_COMPANY_MODE==='true';
 const workspace=request.nextUrl.searchParams.get('org');
 if(single&&request.nextUrl.pathname.startsWith('/dashboard/')&&workspace&&process.env.SINGLE_COMPANY_ORG_ID&&workspace!==process.env.SINGLE_COMPANY_ORG_ID)return NextResponse.redirect(new URL('/dashboard',request.url));
 if(['/pricing','/billing','/billing/return','/register','/admin','/admin/companies','/admin/plans','/admin/workspace','/admin/cms','/features','/solutions','/resources','/contact','/about','/faq','/terms','/privacy','/cookies','/acceptable-use'].includes(request.nextUrl.pathname))return NextResponse.redirect(new URL(['/register','/pricing','/features','/solutions','/resources','/contact','/about','/faq','/terms','/privacy','/cookies','/acceptable-use'].includes(request.nextUrl.pathname)?'/login':'/dashboard',request.url));
 const validWorkspace=!!workspace&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(workspace);
 if(validWorkspace)request.cookies.set('charis-workspace',workspace!);
 const nonce=btoa(crypto.randomUUID());const policy=contentSecurityPolicy(nonce,process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NODE_ENV!=='production');const requestHeaders=new Headers(request.headers);requestHeaders.set('x-nonce',nonce);requestHeaders.set('Content-Security-Policy',policy);
 const next=()=>{requestHeaders.set('cookie',request.headers.get('cookie')||'');const result=NextResponse.next({request:{headers:requestHeaders}});result.headers.set('Content-Security-Policy',policy);if(validWorkspace)result.cookies.set('charis-workspace',workspace!,{httpOnly:true,sameSite:'lax',secure:request.nextUrl.protocol==='https:',path:'/',maxAge:60*60*24*30});return result;};
 let response=next();
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(!url||!key){if(request.nextUrl.pathname.startsWith('/dashboard')||request.nextUrl.pathname.startsWith('/admin'))return NextResponse.redirect(new URL('/login?error=setup',request.url));return response}
 const protectedPage=request.nextUrl.pathname.startsWith('/dashboard')||request.nextUrl.pathname.startsWith('/admin');
 const hasSession=request.cookies.getAll().some(cookie=>cookie.name.startsWith('sb-')&&cookie.name.includes('-auth-token'));
 if(!protectedPage&&!hasSession)return response;
 const client=createServerClient(url,key,{cookies:{getAll(){return request.cookies.getAll()},setAll(items){items.forEach(({name,value})=>request.cookies.set(name,value));response=next();items.forEach(({name,value,options})=>response.cookies.set(name,value,options))}}});
 const {data:{user}}=await client.auth.getUser();
 if(!user&&(request.nextUrl.pathname.startsWith('/dashboard')||request.nextUrl.pathname.startsWith('/admin')))return NextResponse.redirect(new URL('/login',request.url));
 return response;
}
export const config={matcher:['/((?!api/|_next/|favicon.ico|robots.txt|sitemap.xml).*)']};
