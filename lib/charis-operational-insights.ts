import {z} from 'zod';

const count=z.number().int().nonnegative();
export const operationalInsightsSchema=z.object({
 as_of:z.string(),period_from:z.string(),period_until:z.string(),
 loans:z.object({active:count,overdue:count,due_soon:count,outstanding:z.number().nonnegative()}),
 followups:z.object({open:count,overdue:count,completed_in_period:count}),
 reminders:z.object({submitted:count,approved:count,held:count,created_in_period:count}),
 notices:z.object({submitted:count,approved:count,created_in_period:count})
});
export type OperationalInsights=z.infer<typeof operationalInsightsSchema>;
const calendarDay=/^\d{4}-\d{2}-\d{2}$/;
export function parseOperationalDates(from?:string,to?:string,now=new Date()){
 const fallbackEnd=now.toISOString().slice(0,10);
 const fallbackStart=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()-29)).toISOString().slice(0,10);
 const startDay=from||fallbackStart,endDay=to||fallbackEnd;
 if(!calendarDay.test(startDay)||!calendarDay.test(endDay))return null;
 const fromDate=new Date(`${startDay}T00:00:00.000Z`);
 const endDate=new Date(`${endDay}T00:00:00.000Z`);
 if(Number.isNaN(fromDate.valueOf())||Number.isNaN(endDate.valueOf())||
    fromDate.toISOString().slice(0,10)!==startDay||endDate.toISOString().slice(0,10)!==endDay)return null;
 const until=new Date(endDate.valueOf()+86400000);
 if(until<=fromDate||until.valueOf()-fromDate.valueOf()>366*86400000)return null;
 return {from:startDay,to:endDay,p_from:fromDate.toISOString(),p_until:until.toISOString()};
}
export function formatNaira(amount:number){return new Intl.NumberFormat('en-NG',{style:'currency',currency:'NGN',maximumFractionDigits:2}).format(amount);}
