/** Safe for client-side use: public purpose labels only, no credentials. */
export const zeptoPurposes=[
 {value:'loan_reminder',label:'Specific loan repayment reminder'},
 {value:'account_notice',label:'Customer-specific account service notice'},
 {value:'payment_receipt',label:'Receipt or payment acknowledgement'},
 {value:'customer_request',label:'Reply to a specific customer request'}
] as const;
