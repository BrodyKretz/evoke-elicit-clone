import type { Paper } from "../types";

// Citation formatters. Two formats matter for an academic-adjacent tool:
//   APA — what people paste into manuscripts and slide decks
//   BibTeX — what people paste into LaTeX bibliographies
// Both deliberately keep formatting predictable rather than perfectly
// conforming to a style spec; the goal is a one-click copy that's clean
// enough to drop into a writeup.

function authorList(authors: string[]): string {
  if (authors.length === 0) return "Unknown";
  if (authors.length === 1) return authors[0];
  if (authors.length <= 6) {
    return authors.slice(0, -1).join(", ") + ", & " + authors[authors.length - 1];
  }
  // APA 7: 6+ authors → first author et al.
  return `${authors[0]} et al.`;
}

export function formatApa(paper: Paper): string {
  const authors = authorList(paper.authors);
  const year = paper.year || "n.d.";
  const title = paper.title.trim().replace(/\.$/, "") + ".";
  const journal = paper.journal ? ` ${paper.journal}.` : "";
  const doi = paper.doi ? ` https://doi.org/${paper.doi}` : "";
  return `${authors} (${year}). ${title}${journal}${doi}`.trim();
}

// Generate a short, ascii-only BibTeX key like "doe2024empagliflozin" so
// citations are stable across runs. Falls back to the paper id if the
// author or title is unusable.
function bibKey(paper: Paper): string {
  const firstAuthor = (paper.authors[0] ?? "anon")
    .split(/[\s,]+/)
    .pop() // last token is usually surname
    ?.toLowerCase()
    .replace(/[^a-z]/g, "");
  const year = paper.year || "nd";
  const firstWord = paper.title
    .toLowerCase()
    .split(/\s+/)
    .find((w) => w.length > 3 && !/^(the|and|for|with|from|into|that|this)$/.test(w))
    ?.replace(/[^a-z]/g, "");
  if (!firstAuthor && !firstWord) return paper.id;
  return [firstAuthor, year, firstWord].filter(Boolean).join("");
}

function escapeBib(s: string): string {
  return s.replace(/[{}]/g, "");
}

export function formatBibtex(paper: Paper): string {
  const key = bibKey(paper);
  const authors = paper.authors.join(" and ");
  const fields: Array<[string, string | number | undefined]> = [
    ["title", escapeBib(paper.title)],
    ["author", escapeBib(authors)],
    ["year", paper.year || undefined],
    ["journal", paper.journal ? escapeBib(paper.journal) : undefined],
    ["doi", paper.doi],
  ];
  const lines = fields
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `  ${k} = {${v}}`)
    .join(",\n");
  return `@article{${key},\n${lines}\n}`;
}
