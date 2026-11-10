export type ZohoList = {list_key:string;name:string;contact_count:number;lock_status:string;is_public:boolean};
export type ZohoContact = {list_key:string;list_name:string;email:string;first_name:string;last_name:string;phone:string;zoho_contact_id:string;status:string;list_keys:string[];list_names:string[]};
export function rowsFromZoho(payload:unknown):unknown[];
export function normalizeZohoLists(payload:unknown):ZohoList[];
export function normalizeZohoContacts(payload:unknown,list:ZohoList,status:string):Omit<ZohoContact,'list_keys'|'list_names'>[];
export function dedupeZohoContacts(rows:Omit<ZohoContact,'list_keys'|'list_names'>[]):ZohoContact[];