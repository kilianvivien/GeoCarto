/**
 * Tabular data for attribute joins. A small RFC 4180 parser — quoted fields,
 * escaped quotes, embedded newlines — with delimiter sniffing, since French
 * spreadsheets export `;`-separated files with decimal commas.
 */
export interface CsvTable {
  columns: string[];
  rows: Record<string, string | number>[];
}

export class CsvParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CsvParseError';
  }
}

const DELIMITERS = [',', ';', '\t'] as const;
type Delimiter = (typeof DELIMITERS)[number];

/** Pick the delimiter that occurs most often outside quotes on the header line. */
function sniffDelimiter(text: string): Delimiter {
  const counts: Record<Delimiter, number> = { ',': 0, ';': 0, '\t': 0 };
  let quoted = false;
  for (const char of text) {
    if (char === '"') quoted = !quoted;
    else if (!quoted && (char === '\n' || char === '\r')) break;
    else if (!quoted && char in counts) counts[char as Delimiter] += 1;
  }
  return DELIMITERS.reduce((best, delimiter) => (counts[delimiter] > counts[best] ? delimiter : best));
}

function splitRecords(text: string, delimiter: Delimiter): string[][] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char !== '"') field += char;
      else if (text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else quoted = false;
      continue;
    }
    if (char === '"' && field === '') quoted = true;
    else if (char === delimiter) {
      record.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      record.push(field);
      records.push(record);
      record = [];
      field = '';
    } else field += char;
  }
  if (field !== '' || record.length > 0) {
    record.push(field);
    records.push(record);
  }
  // Blank lines carry no data.
  return records.filter((cells) => cells.some((cell) => cell.trim() !== ''));
}

/**
 * Numbers become numbers so joined columns can drive choropleths. Anything
 * with a leading zero stays text — INSEE/FIPS/postal codes are identifiers.
 * A decimal comma is only read as such when the comma isn't the delimiter.
 */
function coerce(raw: string, delimiter: Delimiter): string | number {
  const value = raw.trim();
  if (value === '') return '';
  const candidate = delimiter !== ',' && /^-?\d+,\d+$/.test(value) ? value.replace(',', '.') : value;
  if (!/^-?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(candidate)) return value;
  if (/^-?0\d/.test(candidate)) return value;
  const parsed = Number(candidate);
  return Number.isFinite(parsed) ? parsed : value;
}

export function parseCsv(input: string): CsvTable {
  // Excel prefixes UTF-8 exports with a byte-order mark.
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const delimiter = sniffDelimiter(text);
  const [header, ...body] = splitRecords(text, delimiter);
  if (!header) throw new CsvParseError('empty');

  // Blank and repeated headers still need distinct property names.
  const seen = new Map<string, number>();
  const columns = header.map((cell, index) => {
    const base = cell.trim() || `column_${index + 1}`;
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base}_${count + 1}`;
  });
  if (body.length === 0) throw new CsvParseError('noRows');

  const rows = body.map((cells) => {
    const row: Record<string, string | number> = {};
    columns.forEach((column, index) => {
      row[column] = coerce(cells[index] ?? '', delimiter);
    });
    return row;
  });
  return { columns, rows };
}
