// Parse free-text input into a set of normalized paper identifiers that
// Semantic Scholar's batch endpoint will accept. Users typically paste a
// mix of DOIs, DOI URLs, arXiv ids/links, and PubMed ids — we tolerate
// any whitespace/comma separator and dedupe.

const DOI_RE = /\b10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i;
const ARXIV_RE = /\b(?:arxiv:)?(\d{4}\.\d{4,5})(?:v\d+)?\b/i;
const PMID_RE = /\bpmid[:\s]*(\d{1,8})\b/i;
const S2_ID_RE = /^[0-9a-f]{40}$/i;

export type ParsedId = {
  /** S2-style prefixed id, e.g. "DOI:10.x/y" or "ARXIV:2401.12345". */
  s2Id: string;
  /** Original token the user typed. */
  raw: string;
};

export function parseIds(input: string): ParsedId[] {
  const tokens = input
    .split(/[\s,;\n\r\t]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  const seen = new Set<string>();
  const out: ParsedId[] = [];
  for (const raw of tokens) {
    const id = parseOne(raw);
    if (!id) continue;
    if (seen.has(id.s2Id)) continue;
    seen.add(id.s2Id);
    out.push(id);
  }
  return out;
}

function parseOne(raw: string): ParsedId | null {
  const doi = raw.match(DOI_RE);
  if (doi) return { s2Id: `DOI:${doi[0]}`, raw };

  const arxiv = raw.match(ARXIV_RE);
  if (arxiv) return { s2Id: `ARXIV:${arxiv[1]}`, raw };

  const pmid = raw.match(PMID_RE);
  if (pmid) return { s2Id: `PMID:${pmid[1]}`, raw };

  // bare 40-hex paperId
  if (S2_ID_RE.test(raw)) return { s2Id: raw, raw };

  return null;
}
