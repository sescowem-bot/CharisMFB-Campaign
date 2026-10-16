import {contentSecurityPolicy} from '@/lib/security/headers';
import {NextResponse, type NextRequest} from 'next/server';
import {createServerClient} from '@supabase/ssr';
const isUuid=(id:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
const removed=new Set(['/pricing','/billing','/register','/features','/solutions','/resources','/contact','/about','/admin/companies','/admin/plans','/admin/workspace','/admin/cms']);
export async function middleware(request:NextRequest){
 const pathname=request.nextUrl.pathname;
 if(removed.has(pathname))return NextResponse.redirect(new URL(pathname==='/register'?'/login':'/dashboard',request.url));
 const protectedPage=pathname.startsWith('/dashboard')||pathname.startsWith('/admin');
 const org=process.env.SINGLE_COMPANY_ORG_ID||'';
 if(protectedPage&&!isUuid(org))return NextResponse.redirect(new URL('/setup-required',request.url));
 const requested=request.nextUrl.searchParams.get('org');
 if(protectedPage&&requested&&requested!==org)return NextResponse.redirect(new URL('/dashboard',request.url));
 // Canonical dashboard URLs omit the redundant organisation query parameter.
 // Legacy URLs remain compatible; internally the existing pages still receive the bank UUID.
 if(protectedPage&&request.method==='GET'&&requested){const clean=request.nextUrl.clone();clean.searchParams.delete('org');return NextResponse.redirect(clean);}
 const nonce=btoa(crypto.randomUUID());const policy=contentSecurityPolicy(nonce,process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NODE_ENV!=='production');
 const requestHeaders=new Headers(request.headers);requestHeaders.set('x-nonce',nonce);requestHeaders.set('Content-Security-Policy',policy);
 const internal=request.nextUrl.clone();if(pathname.startsWith('/dashboard')&&!internal.searchParams.has('org'))internal.searchParams.set('org',org);
 const next=()=>{requestHeaders.set('cookie',request.headers.get('cookie')||'');const result=pathname.startsWith('/dashboard')?NextResponse.rewrite(internal,{request:{headers:requestHeaders}}):NextResponse.next({request:{headers:requestHeaders}});result.headers.set('Content-Security-Policy',policy);if(pathname.startsWith('/unsubscribe')){result.headers.set('Referrer-Policy','no-referrer');result.headers.set('Cache-Control','no-store');}return result;};
 let response=next();
 const url=process.env.NEXT_PUBLIC_SUPABASE_URL;const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(!url||!key){if(protectedPage)return NextResponse.redirect(new URL('/setup-required',request.url));return response;}
 if(!protectedPage)return response;
 const client=createServerClient(url,key,{cookies:{getAll(){return request.cookies.getAll()},setAll(items){items.forEach(({name,value})=>request.cookies.set(name,value));response=next();items.forEach(({name,value,options})=>response.cookies.set(name,value,options));}}});
 const {data:{user}}=await client.auth.getUser();
 if(!user)return NextResponse.redirect(new URL('/login',request.url));
 return response;
}
export const config={matcher:['/((?!api/|_next/|favicon.ico|robots.txt|sitemap.xml).*)']};
