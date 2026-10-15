export type LoanRow={id:string;contact_id:string;loan_reference:string;principal:number|string;total_due:number|string;disbursed_on:string;due_on:string;status:string;created_at:string};
export function loanBalance(total:number|string,paid:number|string):number{return Math.max(0,Math.round((Number(total)-Number(paid))*100)/100);}
export function loanState(status:string,balance:number,due:string,today:string):string{
 if(status==='settled'||balance<=0)return 'Settled';
 return due<today?'Overdue':'Active';
}
export function ngn(value:number|string):string{return new Intl.NumberFormat('en-NG',{style:'currency',currency:'NGN',minimumFractionDigits:2,maximumFractionDigits:2}).format(Number(value));}
