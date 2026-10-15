import {redirect} from 'next/navigation';
export default async function LegacyStaffReminders({searchParams}:{searchParams:Promise<{org?:string;department?:string;status?:string}>}) {
 const params=await searchParams;const q=new URLSearchParams();for(const key of ['org','department','status'] as const){if(params[key])q.set(key,String(params[key]));}
 redirect(`/dashboard/tasks${q.size?'?'+q.toString():''}`);
}
