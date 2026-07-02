"use client";

import { useState, type ChangeEvent } from "react";
import { parseCsv, type ParsedCsv } from "@/lib/csv";

/** File-picking + parsing boilerplate for the Students CSV import modal. */
export function useCsvUpload() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedCsv | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setFileName(null);
    setParsed(null);
    setError(null);
  }

  function onFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setFileName(file.name);
    setError(null);
    setParsed(null);
    file
      .text()
      .then((text) => {
        const result = parseCsv(text);
        if (result.rows.length === 0) {
          setError("No data rows found in that file.");
          return;
        }
        setParsed(result);
      })
      .catch(() => setError("Could not read that file."));
  }

  return { fileName, parsed, error, onFileChange, reset };
}
