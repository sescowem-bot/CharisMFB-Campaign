/** Display metadata only. Permissions are enforced in Supabase, not by this array. */
export const departmentProfiles=[
 {slug:'it',name:'IT / System Administration',role:'System Administrator',purpose:'Staff accounts, provider connections and platform security',plannedActions:'Manage staff, provider configuration and security'},
 {slug:'executive',name:'Executive Management',role:'Executive / Approver',purpose:'Bank-wide reporting and sensitive communication approvals',plannedActions:'Review all reports and approve high-risk bank-wide notices'},
 {slug:'marketing',name:'Marketing & Business Development',role:'Campaign Lead / Designer',purpose:'Promotions, templates and authorised campaigns',plannedActions:'Prepare promotional campaigns, edit templates and review outcomes'},
 {slug:'customer_service',name:'Customer Service',role:'Customer Manager',purpose:'Customer details, queries and communication preferences',plannedActions:'Review contacts, complaints and permitted communication preferences'},
 {slug:'operations',name:'Operations',role:'Operations Manager',purpose:'Service updates, branch notices and digital banking messages',plannedActions:'Prepare banking-service and branch announcements'},
 {slug:'credit',name:'Credit & Loan Recovery',role:'Credit Officer',purpose:'Approved repayment and lending communications',plannedActions:'Draft approved repayment and loan-related notices'},
 {slug:'compliance',name:'Risk & Compliance',role:'Compliance Approver',purpose:'Consent, content policy and communication review',plannedActions:'Review consent, message purpose and compliance requirements'},
 {slug:'audit',name:'Internal Control / Audit',role:'Auditor',purpose:'Audit records, approvals and exception review',plannedActions:'Read audit trails, campaign decisions and delivery exceptions'},
 {slug:'finance',name:'Finance & Accounts',role:'Finance Analyst',purpose:'Communication costs, provider quotas and reports',plannedActions:'Review provider quotas, costs and spending trends'},
 {slug:'branch',name:'Branch Management',role:'Branch Manager',purpose:'Branch-specific communications and reports',plannedActions:'Coordinate authorised branch customer updates'},
 {slug:'hr',name:'Human Resources',role:'Internal Communications',purpose:'Staff notices through a separate employee audience',plannedActions:'Manage internal staff announcements using employee-only recipients'}
] as const;
