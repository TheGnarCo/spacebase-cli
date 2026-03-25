export interface ColumnDef {
  header: string;
  key: string;
  width?: number;
}

export interface OutputModule {
  configure(opts: { json: boolean }): void;
  json(data: unknown): void;
  table(data: unknown[], columns: ColumnDef[]): void;
  error(message: string, detail?: unknown): void;
}

let isJsonMode = false;

function configure(opts: { json: boolean }): void {
  isJsonMode = opts.json;
}

function json(data: unknown): void {
  process.stdout.write(JSON.stringify(data, null, 2) + "\n");
}

function table(data: unknown[], columns: ColumnDef[]): void {
  if (isJsonMode) {
    json(data);
    return;
  }

  const colWidths = columns.map((col) => {
    const headerLen = col.header.length;
    if (col.width !== undefined) return col.width;
    const maxDataLen = data.reduce((max, row) => {
      const val = String((row as Record<string, unknown>)[col.key] ?? "");
      return Math.max(max, val.length);
    }, 0);
    return Math.max(headerLen, maxDataLen);
  });

  const pad = (str: string, width: number) => str.padEnd(width);

  const header = columns.map((col, i) => pad(col.header, colWidths[i])).join("  ");
  const divider = colWidths.map((w) => "-".repeat(w)).join("  ");

  const rows = data.map((row) =>
    columns.map((col, i) => pad(String((row as Record<string, unknown>)[col.key] ?? ""), colWidths[i])).join("  ")
  );

  process.stdout.write([header, divider, ...rows].join("\n") + "\n");
}

function error(message: string, detail?: unknown): void {
  const parts = [message];
  if (detail !== undefined) {
    parts.push(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  process.stderr.write(parts.join(" ") + "\n");
}

export const output: OutputModule = { configure, json, table, error };
