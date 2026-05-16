# Gather sources

The first stage of the pipeline. Job: turn a research question into a ranked list of candidate papers. Cost-shaping principle: this stage touches the most papers, so the per-paper cost has to be near zero.

## The choice: don't run an LLM here

The naive design — "give the LLM a search tool and let it ask for papers" — is wrong for this stage. Embedding-based ranking is *better* at "given a question, return the N most semantically similar papers" than any frontier LLM, and dramatically cheaper.

I never wrote my own embedding pipeline. Instead I delegated to **Semantic Scholar's `/graph/v1/paper/search` endpoint**, which:
- Knows about ~200M papers.
- Returns its own relevance-ranked list.
- Provides abstract + metadata in one call.
- Costs zero (with rate limits).

S2's ranker isn't a learned embedding model; it's BM25 over text fields with some signal from citation count. That's fine for Evoke's first iteration — it's clearly good enough to surface relevant papers for any well-formed question, and the LLM-driven screening stage downstream can filter the false positives.

What I'd build next: a re-ranker layer over S2's top-1000. Take the question, embed it, embed the top-1000 papers' titles+abstracts, rerank by cosine similarity weighted with citation count and recency. That's the "real" gather stage. The current implementation skips it and uses S2's native ranking unchanged.

## Code shape

`lib/semantic-scholar.ts` is ~70 lines. The interesting bits:

- **Field projection.** S2 lets you specify exactly which fields you want via `?fields=...`. I ask for `paperId,title,abstract,year,authors,venue,citationCount,openAccessPdf,externalIds`. Fetching only what you need keeps each response small and respectful.
- **Schema mapping.** S2's `S2Paper` shape is mapped to our internal `Paper` type at the boundary. The rest of the pipeline never sees S2 specifics. If we ever swap to OpenAlex, only this file changes.
- **Retry with exponential backoff.** 4 attempts, 1s/2s/4s. S2's 429 returns are common on the unauth tier.

## The unauth-tier story

The single most painful part of building this pipeline was Semantic Scholar's unauthenticated rate limit. The docs say "1 request per second"; in practice, two successive requests within ~10 seconds will earn a soft-ban of 60–300 seconds, and during that window every retry — no matter how patiently spaced — returns 429.

That's a corpus-side phenomenon, not solvable by client-side cleverness. The retry-with-backoff in `searchPapers` does the right thing but can't out-wait the ban. For development cadence, **a free S2 API key is functionally required.**

I spent six development sessions hitting this wall. Eventually I committed to "verify each agent in isolation against fixture data" — a `scripts/test-{stage}.ts` per agent — so that S2's mood didn't block iteration on the LLM stages. That pattern paid for itself many times over.

## What lives in this stage's output

`Paper[]` returned to the caller has, per paper:
- A stable ID (S2's `paperId`)
- Title, authors, year, journal
- Citation count
- DOI (when present in `externalIds`)
- Abstract (when S2 has it)
- `fullTextAvailable: boolean` — derived from S2's `openAccessPdf.url` presence

The `abstract` field is the critical one for downstream stages. Screening and extraction read it; without it the paper is silently dropped. About 70-90% of S2's top-25 results have abstracts available, depending on the query domain.

## Open questions

- **Re-ranking with embeddings.** When this stage scales from 25 to 1000 papers (and especially when full-text PDFs are in the loop), an embedding-based re-rank step becomes high-value. The architecture supports it cleanly — `searchPapers` returns ranked papers; a re-ranker is just a transformation on that list.
- **Multiple corpus sources.** OpenAlex covers some preprints S2 misses. Union with deduplication via DOI is the right approach.
- **Full-text PDF retrieval.** Unpaywall API for OA links, then PDF-to-text via vision. This is the single biggest quality unlock for the extraction stage downstream.
- **Query rewriting.** Sometimes the user's natural-language question doesn't search well. A pre-stage where the LLM rewrites the question into 2–3 sub-queries (and we union the results) might noticeably improve recall. Worth A/B testing.
