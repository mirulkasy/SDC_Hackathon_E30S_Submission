// Generic CSV builder + browser download trigger, shared by the
// summary / transaction / report / inventory export menus.

function escapeCell(value) {
  const str = value === null || value === undefined ? "" : String(value);
  // Quote anything with a comma, quote, or newline; escape inner quotes.
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

/**
 * rows: array of plain objects
 * columns: [{ key, label }] — controls column order + header text
 */
export function toCsv(rows, columns) {
  const header = columns.map((c) => escapeCell(c.label)).join(",");
  const body = rows
    .map((row) => columns.map((c) => escapeCell(row[c.key])).join(","))
    .join("\n");
  return `${header}\n${body}`;
}

/** Triggers a browser download of a CSV string. */
export function downloadCsv(filename, csvString) {
  const blob = new Blob([csvString], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
