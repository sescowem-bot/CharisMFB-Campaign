export type CapacityInput={provider:string;daily_limit:number;enabled:boolean;health_status:string};
/** Estimate only. No connection or policy status authorizes production sending. */
export function previewProviderCapacity(size:number,rows:CapacityInput[]) {
 if(!Number.isSafeInteger(size)||size<0||size>1000000)throw new Error('Invalid estimate size');
 const providers=rows.filter(p=>p.enabled&&p.health_status==='healthy'&&Number.isInteger(p.daily_limit)&&p.daily_limit>0)
  .map(p=>({provider:p.provider,dailyLimit:p.daily_limit,allocated:0}));
 const perDay=providers.reduce((sum,p)=>sum+p.dailyLimit,0);
 if(!perDay)return {days:0,perDay:0,unallocated:size,providers};
 let remaining=size;const days=Math.ceil(size/perDay);
 for(let d=0;d<days;d++)for(const p of providers){if(!remaining)break;const count=Math.min(p.dailyLimit,remaining);p.allocated+=count;remaining-=count;}
 return {days,perDay,unallocated:remaining,providers};
}
