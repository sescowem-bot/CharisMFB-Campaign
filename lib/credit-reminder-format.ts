/** Preview-only formatting; the database creates the authoritative per-loan message snapshot. */
export const DEFAULT_CREDIT_REMINDER = 'Dear {{first_name}}, this is a courtesy reminder from {{bank_name}}. Your loan {{loan_reference}} has an outstanding balance of {{outstanding}}, with a repayment due date of {{due_date}}. If you have already made payment, kindly disregard this message or contact your relationship officer.';
export const CREDIT_REMINDER_FIELDS = ['first_name','loan_reference','outstanding','due_date','bank_name'] as const;
export type CreditPreview={first_name:string;loan_reference:string;outstanding:number;due_date:string};
export function creditReminderPreview(template:string,c:CreditPreview):string{
 const money=new Intl.NumberFormat('en-NG',{minimumFractionDigits:2,maximumFractionDigits:2}).format(c.outstanding);
 const values:Record<string,string>={first_name:c.first_name,loan_reference:c.loan_reference,outstanding:`NGN ${money}`,due_date:c.due_date,bank_name:'Charis Microfinance Bank'};
 return template.replace(/\{\{([^}]+)\}\}/g,(original,key:string)=>key in values?values[key]:original);
}
