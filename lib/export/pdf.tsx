import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
} from "@react-pdf/renderer";
import type { Report, ReportBlock, Paper } from "@/lib/types";

// PDF renderer for Evoke reports. Mirrors the structure of the .pptx
// exporter but produces a single multi-page document instead of slides.
// Inline `[[N,M]]` citation markers are rendered as superscript numbers
// (the convention for academic PDFs) since hover popovers don't exist in
// a static document.

const TEAL = "#1F6E68";
const TEXT = "#1F2937";
const MUTED = "#6B7280";
const FAINT = "#9CA3AF";
const RULE = "#E5E7EB";
const SOFT_BG = "#FAFAF9";

const styles = StyleSheet.create({
  page: {
    padding: 56,
    paddingBottom: 72,
    fontFamily: "Helvetica",
    fontSize: 11,
    color: TEXT,
    lineHeight: 1.55,
  },
  brand: { fontSize: 9, color: TEAL, marginBottom: 8, fontFamily: "Helvetica-Bold" },
  date: { fontSize: 9, color: FAINT, marginBottom: 4 },
  question: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: TEXT,
    marginBottom: 14,
    lineHeight: 1.25,
  },
  tldr: { fontSize: 12, color: MUTED, marginBottom: 24, lineHeight: 1.5 },
  sectionLabel: {
    fontSize: 9,
    color: TEAL,
    fontFamily: "Helvetica-Bold",
    marginTop: 18,
    marginBottom: 6,
  },
  h2: { fontSize: 16, fontFamily: "Helvetica-Bold", color: TEXT, marginTop: 12, marginBottom: 6 },
  h3: { fontSize: 13, fontFamily: "Helvetica-Bold", color: TEXT, marginTop: 10, marginBottom: 5 },
  h4: { fontSize: 11, fontFamily: "Helvetica-Bold", color: TEXT, marginTop: 8, marginBottom: 4 },
  paragraph: { marginBottom: 8 },
  cite: { fontSize: 7, color: TEAL, fontFamily: "Helvetica-Bold" },
  notesTitle: {
    fontSize: 10,
    color: MUTED,
    fontFamily: "Helvetica-Bold",
    marginTop: 10,
    marginBottom: 4,
  },
  bulletRow: { flexDirection: "row", marginBottom: 3 },
  bulletDot: { width: 12, fontSize: 11 },
  bulletText: { flex: 1, fontSize: 11 },
  childBulletRow: { flexDirection: "row", marginLeft: 14, marginBottom: 2 },
  table: { marginVertical: 10, borderWidth: 0.5, borderColor: RULE },
  tableRow: { flexDirection: "row", borderBottomWidth: 0.5, borderColor: RULE },
  tableHeader: { backgroundColor: SOFT_BG },
  tableCell: { padding: 6, fontSize: 9, color: TEXT, flex: 1, borderRightWidth: 0.5, borderColor: RULE },
  tableCellHeader: { fontFamily: "Helvetica-Bold" },
  refLine: { fontSize: 9, color: MUTED, marginBottom: 4 },
  footer: {
    position: "absolute",
    bottom: 32,
    left: 56,
    right: 56,
    fontSize: 8,
    color: FAINT,
    flexDirection: "row",
    justifyContent: "space-between",
  },
});

// Parse text containing `[[N,M]]` markers into alternating text + superscript
// citation runs.
function parseInlineCites(text: string): React.ReactNode[] {
  const re = /\[\[\s*(\d+(?:\s*,\s*\d+)*)\s*\]\]/g;
  const matches = Array.from(text.matchAll(re));
  if (matches.length === 0) return [text];
  const out: React.ReactNode[] = [];
  let cursor = 0;
  matches.forEach((m, k) => {
    const start = m.index ?? 0;
    if (start > cursor) out.push(text.slice(cursor, start));
    const ids = m[1]
      .split(/\s*,\s*/)
      .map((n) => parseInt(n, 10))
      .filter((n) => Number.isFinite(n));
    out.push(
      <Text key={`c${k}`} style={styles.cite}>
        {" "}
        [{ids.join(",")}]
      </Text>
    );
    cursor = start + m[0].length;
  });
  if (cursor < text.length) out.push(text.slice(cursor));
  return out;
}

function renderBlock(b: ReportBlock, idx: number): React.ReactNode {
  switch (b.kind) {
    case "sectionLabel":
      return (
        <Text key={idx} style={styles.sectionLabel}>
          {b.text.toUpperCase()}
        </Text>
      );
    case "heading": {
      const style = b.level === 2 ? styles.h2 : b.level === 3 ? styles.h3 : styles.h4;
      return (
        <Text key={idx} style={style}>
          {b.text}
        </Text>
      );
    }
    case "paragraph":
      return (
        <Text key={idx} style={styles.paragraph}>
          {parseInlineCites(b.text)}
        </Text>
      );
    case "table": {
      // Allow the table View to page-break between rows. Each row itself
      // uses `wrap={false}` so a single row isn't split across pages.
      return (
        <View key={idx} style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeader]} wrap={false}>
            {b.columns.map((c, ci) => (
              <Text
                key={ci}
                style={[styles.tableCell, styles.tableCellHeader]}
              >
                {c}
              </Text>
            ))}
          </View>
          {b.rows.map((row, ri) => (
            <View
              key={ri}
              wrap={false}
              style={[
                styles.tableRow,
                ri === b.rows.length - 1 ? { borderBottomWidth: 0 } : {},
              ]}
            >
              {row.map((cell, ci) => (
                <Text key={ci} style={styles.tableCell}>
                  {cell}
                </Text>
              ))}
            </View>
          ))}
        </View>
      );
    }
    case "notes":
      return (
        <View key={idx}>
          {b.title && <Text style={styles.notesTitle}>{b.title}</Text>}
          {b.items.map((item, ii) => (
            <View key={ii}>
              <View style={styles.bulletRow}>
                <Text style={styles.bulletDot}>•</Text>
                <Text style={styles.bulletText}>{parseInlineCites(item.text)}</Text>
              </View>
              {item.children?.map((c, ci) => (
                <View key={ci} style={styles.childBulletRow}>
                  <Text style={styles.bulletDot}>◦</Text>
                  <Text style={styles.bulletText}>{parseInlineCites(c.text)}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      );
  }
}

function formatRef(p: Paper, idx: number): string {
  const authors =
    p.authors.length > 4
      ? `${p.authors.slice(0, 4).join(", ")} et al.`
      : p.authors.join(", ");
  return `[${idx + 1}] ${authors} (${p.year || "n.d."}). ${p.title}${
    p.journal ? ` — ${p.journal}` : ""
  }${p.doi ? `. doi:${p.doi}` : ""}`;
}

function ReportDoc({ report }: { report: Report }) {
  const blocks = report.report ?? [];
  const refs = report.references ?? [];
  return (
    <Document author="Evoke" title={report.question}>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.brand}>EVOKE · RESEARCH REPORT</Text>
        {report.date && <Text style={styles.date}>{report.date}</Text>}
        <Text style={styles.question}>{report.question}</Text>
        {report.tldr && <Text style={styles.tldr}>{report.tldr}</Text>}
        {blocks.map((b, i) => renderBlock(b, i))}
        {refs.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>REFERENCES</Text>
            {refs.map((p, i) => (
              <Text key={i} style={styles.refLine}>
                {formatRef(p, i)}
              </Text>
            ))}
          </>
        )}
        <View style={styles.footer} fixed>
          <Text>Evoke · {report.date ?? ""}</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `${pageNumber} / ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}

export async function exportReportAsPdf(report: Report): Promise<Buffer> {
  const instance = pdf(<ReportDoc report={report} />);
  // Some versions of @react-pdf/renderer expose `toBuffer` directly,
  // others stream the bytes — use `toBlob` then slurp it to a Buffer.
  const blob = await instance.toBlob();
  const arrayBuf = await blob.arrayBuffer();
  return Buffer.from(arrayBuf);
}

export function pdfFilename(report: Report): string {
  const slug =
    report.question
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "evoke-report";
  return `${slug}.pdf`;
}
