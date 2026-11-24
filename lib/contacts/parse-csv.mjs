/**
 * RFC 4180-style UTF-8 CSV parser that preserves quoted commas, CRLFs and newlines.
 * No HTML, formula evaluation or implicit spreadsheet transformations.
 * Throw on malformed quoting instead of silently shifting contact columns.
 */
export function parseCsv(input, options = {}) {
  const maxRows = options.maxRows ?? 5001;
  const maxColumns = options.maxColumns ?? 60;
  if (typeof input !== 'string') throw new TypeError('CSV contents must be text');
  const text = input.replace(/^\uFEFF/, '');
  // Bank exports commonly use comma, semicolon or tab delimiters. Detect the
  // most consistent delimiter from the first non-empty physical line.
  const candidates = [',', ';', '\t', '|'];
  let bestDelimiter = ',';
  let bestCount = 0;
  for (const candidate of candidates) {
    let count = 0, inQuotes = false;
    for (let i = 0; i < Math.min(text.length, 5000); i++) {
      if (text[i] === '"') {
        if (inQuotes && text[i + 1] === '"') i++;
        else inQuotes = !inQuotes;
      } else if (!inQuotes && text[i] === candidate) count++;
    }
    if (count > bestCount) { bestCount = count; bestDelimiter = candidate; }
  }
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  let afterQuote = false;
  let line = 1;
  function fieldEnd() {
    row.push(field);
    if (row.length > maxColumns) throw new Error('Too many columns in the CSV file');
    field = '';
    afterQuote = false;
  }
  function rowEnd() {
    fieldEnd();
    if (row.some(value => value.trim() !== '')) {
      rows.push(row);
      if (rows.length > maxRows) throw new Error('File exceeds the allowed number of rows');
    }
    row = [];
  }
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else { quoted = false; afterQuote = true; }
      } else {
        field += c;
        if (c === '\n') line++;
      }
    } else if (c === bestDelimiter) {
      fieldEnd();
    } else if (c === '\r' || c === '\n') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      rowEnd(); line++;
    } else if (c === '"') {
      if (field !== '' || afterQuote) throw new Error(`Invalid CSV quotation at line ${line}`);
      quoted = true;
    } else if (afterQuote) {
      if (c === ' ' || c === '\t') continue;
      throw new Error(`Unexpected characters after quote at line ${line}`);
    } else {
      field += c;
    }
  }
  if (quoted) throw new Error('Unclosed quoted value in CSV');
  if (row.length > 0 || field !== '' || afterQuote) rowEnd();
  return rows;
}

/** Normalise a phone safely. An unusable optional phone is omitted, never allowed to reject a valid email contact. */
export function normalizePhone(value, defaultCountry = 'none') {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  let stripped = raw.replace(/[\s().-]/g, '');
  if (stripped.startsWith('00')) stripped = `+${stripped.slice(2)}`;
  if (/^\+[1-9]\d{7,14}$/.test(stripped)) return stripped;
  if (defaultCountry === 'NG') {
    // Excel commonly stores phone columns as numbers and removes the leading zero:
    // 08012345678 becomes 8012345678. Restore the Nigerian country code.
    if (/^0[789]\d{9}$/.test(stripped)) return `+234${stripped.slice(1)}`;
    if (/^[789]\d{9}$/.test(stripped)) return `+234${stripped}`;
    if (/^234[789]\d{9}$/.test(stripped)) return `+${stripped}`;
  }
  // Do not pass malformed/local numbers to the database. Email is the required identity.
  return '';
}
