export function rowsFromZoho(payload) {
  const p = payload && typeof payload === 'object' ? payload : {};
  const candidates = [p.list_of_details, p.result_of_subscribers, p.data?.list_of_details, p.data?.result_of_subscribers, p.response?.list_of_details];
  return candidates.find(Array.isArray) || [];
}
export function normalizeZohoLists(payload) {
  const p = payload && typeof payload === 'object' ? payload : {};
  const rows = [p.list_of_details, p.requestdetails?.list_of_details, p.data?.list_of_details].find(Array.isArray) || [];
  return rows.map(x => ({
    list_key: String(x.listkey ?? x.list_key ?? '').trim(),
    name: String(x.listname ?? x.list_name ?? '').trim(),
    contact_count: Number(x.noofcontacts ?? x.no_of_contacts ?? 0) || 0,
    lock_status: String(x.lockstatus ?? x.lock_status ?? 'unknown').toLowerCase(),
    is_public: String(x.is_public ?? x.ispublic ?? 'false').toLowerCase() === 'true'
  })).filter(x => /^[A-Za-z0-9_-]{12,160}$/.test(x.list_key) && x.name);
}
export function normalizeZohoContacts(payload, list, status) {
  return rowsFromZoho(payload).map(x => ({
    list_key: list.list_key,
    list_name: list.name,
    email: String(x.contact_email ?? x.email ?? x['Contact Email'] ?? '').trim().toLowerCase(),
    first_name: String(x.firstname ?? x.first_name ?? x['First Name'] ?? '').trim().slice(0,100),
    last_name: String(x.lastname ?? x.last_name ?? x['Last Name'] ?? '').trim().slice(0,100),
    phone: String(x.phone ?? x.mobile ?? '').trim().slice(0,30),
    zoho_contact_id: String(x.zuid ?? x.contactid ?? x.contact_id ?? '').trim().slice(0,100),
    status
  })).filter(x => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x.email) && x.email.length <= 254);
}
export function dedupeZohoContacts(rows) {
  const priority = { complaint: 5, bounce: 4, unsubscribe: 3, active: 1 };
  const map = new Map();
  for (const row of rows) {
    const prev = map.get(row.email);
    if (!prev) map.set(row.email, {...row, list_keys:[row.list_key], list_names:[row.list_name]});
    else {
      if ((priority[row.status] || 0) > (priority[prev.status] || 0)) prev.status = row.status;
      if (!prev.first_name && row.first_name) prev.first_name = row.first_name;
      if (!prev.last_name && row.last_name) prev.last_name = row.last_name;
      if (!prev.phone && row.phone) prev.phone = row.phone;
      if (row.list_key && !prev.list_keys.includes(row.list_key)) prev.list_keys.push(row.list_key);
      if (row.list_name && !prev.list_names.includes(row.list_name)) prev.list_names.push(row.list_name);
    }
  }
  return [...map.values()];
}