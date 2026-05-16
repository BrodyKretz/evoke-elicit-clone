import PptxGenJS from "pptxgenjs";
import type { Report, ReportBlock, Paper } from "@/lib/types";

// Convert an Evoke Report into a downloadable .pptx deck. Each notes block
// becomes a slide (the "Generate slides" action produces 6-8 of these); a
// table block becomes a table slide; paragraphs become a body-text slide.
// Always opens with a title slide and closes with a sources slide.
//
// Returns a Node Buffer the API route streams back to the browser.

const TEAL = "1F6E68";
const TEXT = "1F2937";
const MUTED = "6B7280";
const FAINT = "9CA3AF";
const BG_SOFT = "F9FAFB";

function plainText(blocks: ReportBlock[]): string {
  // Best-effort plain string used by the title-slide subtitle when no tldr.
  for (const b of blocks) {
    if (b.kind === "paragraph") return b.text;
  }
  return "";
}

function formatRef(p: Paper, idx: number): string {
  const authors =
    p.authors.length > 3
      ? `${p.authors.slice(0, 3).join(", ")} et al.`
      : p.authors.join(", ");
  return `${idx + 1}. ${authors} (${p.year || "n.d."}). ${p.title}${
    p.journal ? ` — ${p.journal}` : ""
  }`;
}

export async function exportReportAsPptx(report: Report): Promise<Buffer> {
  const deck = new PptxGenJS();
  deck.layout = "LAYOUT_WIDE"; // 13.33 x 7.5 inches, modern 16:9
  deck.author = "Evoke";
  deck.title = report.question;

  // ---- Title slide ----
  const titleSlide = deck.addSlide();
  titleSlide.background = { color: BG_SOFT };
  titleSlide.addText("Evoke · Research report", {
    x: 0.6,
    y: 0.5,
    w: 12.13,
    h: 0.4,
    fontFace: "Inter",
    fontSize: 12,
    color: TEAL,
    bold: true,
  });
  titleSlide.addText(report.question, {
    x: 0.6,
    y: 1.5,
    w: 12.13,
    h: 2,
    fontFace: "Inter",
    fontSize: 32,
    color: TEXT,
    bold: true,
    valign: "top",
  });
  if (report.tldr) {
    titleSlide.addText(report.tldr, {
      x: 0.6,
      y: 4,
      w: 12.13,
      h: 2.5,
      fontFace: "Inter",
      fontSize: 16,
      color: MUTED,
      valign: "top",
    });
  }
  titleSlide.addText(report.date ?? "", {
    x: 0.6,
    y: 6.8,
    w: 12.13,
    h: 0.4,
    fontFace: "Inter",
    fontSize: 11,
    color: FAINT,
  });

  // ---- Body slides ----
  const blocks = report.report ?? [];
  let currentSectionLabel: string | null = null;
  let pendingHeading: string | null = null;
  let paragraphBuffer: string[] = [];

  const flushParagraphs = () => {
    if (paragraphBuffer.length === 0) return;
    const slide = deck.addSlide();
    if (currentSectionLabel) {
      slide.addText(currentSectionLabel.toUpperCase(), {
        x: 0.6,
        y: 0.4,
        w: 12.13,
        h: 0.35,
        fontFace: "Inter",
        fontSize: 10,
        color: TEAL,
        bold: true,
      });
    }
    if (pendingHeading) {
      slide.addText(pendingHeading, {
        x: 0.6,
        y: 0.9,
        w: 12.13,
        h: 0.7,
        fontFace: "Inter",
        fontSize: 24,
        color: TEXT,
        bold: true,
      });
      pendingHeading = null;
    }
    slide.addText(paragraphBuffer.join("\n\n"), {
      x: 0.6,
      y: 1.8,
      w: 12.13,
      h: 5,
      fontFace: "Inter",
      fontSize: 15,
      color: TEXT,
      valign: "top",
    });
    paragraphBuffer = [];
  };

  for (const b of blocks) {
    switch (b.kind) {
      case "sectionLabel":
        flushParagraphs();
        currentSectionLabel = b.text;
        break;
      case "heading":
        flushParagraphs();
        pendingHeading = b.text;
        break;
      case "paragraph":
        paragraphBuffer.push(b.text);
        break;
      case "table": {
        flushParagraphs();
        const slide = deck.addSlide();
        if (currentSectionLabel) {
          slide.addText(currentSectionLabel.toUpperCase(), {
            x: 0.6,
            y: 0.4,
            w: 12.13,
            h: 0.35,
            fontFace: "Inter",
            fontSize: 10,
            color: TEAL,
            bold: true,
          });
        }
        slide.addText(pendingHeading ?? "Cross-paper comparison", {
          x: 0.6,
          y: 0.9,
          w: 12.13,
          h: 0.7,
          fontFace: "Inter",
          fontSize: 22,
          color: TEXT,
          bold: true,
        });
        pendingHeading = null;
        const headerRow = b.columns.map((c) => ({
          text: c,
          options: { bold: true, fill: { color: "F3F4F6" }, color: TEXT },
        }));
        const bodyRows = b.rows.map((row) =>
          row.map((cell) => ({
            text: cell,
            options: { color: TEXT },
          }))
        );
        slide.addTable([headerRow, ...bodyRows], {
          x: 0.6,
          y: 1.8,
          w: 12.13,
          h: 5,
          fontFace: "Inter",
          fontSize: 11,
          border: { type: "solid", color: "E5E7EB", pt: 0.5 },
        });
        break;
      }
      case "notes": {
        flushParagraphs();
        const slide = deck.addSlide();
        if (currentSectionLabel) {
          slide.addText(currentSectionLabel.toUpperCase(), {
            x: 0.6,
            y: 0.4,
            w: 12.13,
            h: 0.35,
            fontFace: "Inter",
            fontSize: 10,
            color: TEAL,
            bold: true,
          });
        }
        slide.addText(b.title ?? "Key points", {
          x: 0.6,
          y: 0.9,
          w: 12.13,
          h: 0.7,
          fontFace: "Inter",
          fontSize: 26,
          color: TEXT,
          bold: true,
        });
        const items = b.items.flatMap((item) => {
          const top = { text: item.text, options: { bullet: true, color: TEXT, fontSize: 16 } };
          const children = (item.children ?? []).map((c) => ({
            text: c.text,
            options: { bullet: { indent: 20 }, color: MUTED, fontSize: 14 },
          }));
          return [top, ...children];
        });
        slide.addText(items, {
          x: 0.6,
          y: 1.8,
          w: 12.13,
          h: 5.2,
          fontFace: "Inter",
          paraSpaceAfter: 8,
          valign: "top",
        });
        break;
      }
    }
  }
  flushParagraphs();

  // ---- Sources slide ----
  const refs = report.references ?? [];
  if (refs.length > 0) {
    const slide = deck.addSlide();
    slide.background = { color: BG_SOFT };
    slide.addText("Sources", {
      x: 0.6,
      y: 0.5,
      w: 12.13,
      h: 0.7,
      fontFace: "Inter",
      fontSize: 26,
      color: TEXT,
      bold: true,
    });
    const items = refs.map((p, i) => ({
      text: formatRef(p, i),
      options: { color: MUTED, fontSize: 12 },
    }));
    slide.addText(items, {
      x: 0.6,
      y: 1.4,
      w: 12.13,
      h: 5.6,
      fontFace: "Inter",
      paraSpaceAfter: 6,
      valign: "top",
    });
  }

  // pptxgenjs's `.write()` returns a Node Buffer when output type is "nodebuffer".
  const buf = (await deck.write({ outputType: "nodebuffer" })) as Buffer;
  return buf;
}

export function pptxFilename(report: Report): string {
  const slug =
    report.question
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "evoke-report";
  return `${slug}.pptx`;
}
