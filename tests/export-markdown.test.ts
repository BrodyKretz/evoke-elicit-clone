import { test } from "node:test";
import assert from "node:assert/strict";
import { reportToMarkdown } from "../lib/utils/export-markdown";
import type { Report } from "../lib/types";

function makeReport(overrides: Partial<Report> = {}): Report {
  return {
    id: "test-1",
    question: "Does X work?",
    tldr: "Yes, X works in most cases.",
    date: "May 11, 2026",
    visibility: "private",
    initialView: "report",
    status: {
      gather: { done: true, sourcesFound: 25 },
      screen: { done: true, sourcesIncluded: 10 },
      extract: { done: true, dataPointsExtracted: 40 },
      generate: { done: true },
    },
    ...overrides,
  };
}

test("renders question, date, and tldr at the top", () => {
  const md = reportToMarkdown(makeReport());
  assert.match(md, /^# Does X work\?/);
  assert.match(md, /\*May 11, 2026\*/);
  assert.match(md, /\*\*TLDR\.\*\* Yes, X works in most cases\./);
});

test("renders a paragraph block with array citations as footnote markers", () => {
  const md = reportToMarkdown(
    makeReport({
      report: [{ kind: "paragraph", text: "Studies converge on X.", cites: [1, 3] }],
    })
  );
  assert.match(md, /Studies converge on X\. \[\^1\]\[\^3\]/);
});

test("renders heading levels correctly", () => {
  const md = reportToMarkdown(
    makeReport({
      report: [
        { kind: "heading", level: 2, text: "Background" },
        { kind: "heading", level: 3, text: "Methods" },
        { kind: "heading", level: 4, text: "Sample" },
      ],
    })
  );
  assert.match(md, /^## Background$/m);
  assert.match(md, /^### Methods$/m);
  assert.match(md, /^#### Sample$/m);
});

test("renders a table block as a markdown table", () => {
  const md = reportToMarkdown(
    makeReport({
      report: [
        {
          kind: "table",
          columns: ["Study", "Design"],
          rows: [
            ["Smith 2020", "RCT"],
            ["Jones 2021", "Cohort"],
          ],
        },
      ],
    })
  );
  assert.match(md, /\| Study \| Design \|/);
  assert.match(md, /\| --- \| --- \|/);
  assert.match(md, /\| Smith 2020 \| RCT \|/);
});

test("escapes pipes inside table cells", () => {
  const md = reportToMarkdown(
    makeReport({
      report: [
        {
          kind: "table",
          columns: ["A", "B"],
          rows: [["has | pipe", "ok"]],
        },
      ],
    })
  );
  assert.match(md, /\| has \\\| pipe \| ok \|/);
});

test("renders nested notes as indented bullets", () => {
  const md = reportToMarkdown(
    makeReport({
      report: [
        {
          kind: "notes",
          title: "Summary",
          items: [
            {
              text: "Top-level",
              children: [{ text: "Nested A" }, { text: "Nested B" }],
            },
          ],
        },
      ],
    })
  );
  assert.match(md, /\*\*Summary\*\*/);
  assert.match(md, /^- Top-level$/m);
  assert.match(md, /^  - Nested A$/m);
  assert.match(md, /^  - Nested B$/m);
});

test("renders references section with DOI links", () => {
  const md = reportToMarkdown(
    makeReport({
      references: [
        {
          id: "p1",
          title: "First paper",
          authors: ["Smith"],
          year: 2020,
          journal: "Nature",
          doi: "10.1234/abc",
          fullTextAvailable: true,
        },
      ],
    })
  );
  assert.match(md, /## References/);
  assert.match(md, /1\. Smith \(2020\)\. First paper\. Nature\. https:\/\/doi\.org\/10\.1234\/abc/);
});

test("handles a report with no blocks gracefully", () => {
  const md = reportToMarkdown(makeReport({ report: undefined }));
  assert.match(md, /_Report not yet generated\._/);
});
