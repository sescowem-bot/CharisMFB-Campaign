import type {MetadataRoute} from 'next';

/** Public install metadata; no account or customer details. */
export default function manifest():MetadataRoute.Manifest{
 return {
  id:'/dashboard',name:'Charis Campaign Centre',short_name:'Charis',
  description:'Secure staff communications workspace for Charis Microfinance Bank.',
  start_url:'/dashboard',scope:'/',display:'standalone',
  background_color:'#f8f7fc',theme_color:'#40239a',
  icons:[
   {src:'/charis-pwa-192.png',sizes:'192x192',type:'image/png',purpose:'any'},
   {src:'/charis-pwa-512.png',sizes:'512x512',type:'image/png',purpose:'any'},
  ],
 };
}
