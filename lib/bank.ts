import 'server-only';
/** A single, fixed Charis organisation. No SaaS or fallback workspace. */
export function charisOrgId():string|null {
 const id=process.env.SINGLE_COMPANY_ORG_ID||'';
 return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)?id:null;
}
export const BANK_NAME='Charis Microfinance Bank Ltd';
export const BANK_PRODUCT='Charis Customer Communications Centre';
