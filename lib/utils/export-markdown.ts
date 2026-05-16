import type { Cites, Report, ReportBlock, NotesItem } from "@/lib/types";

// Render a typed ReportBlock[] back out as portable Markdown.
// Used for the "download as .md" affordance on synthesized reports.

function renderNotes(items: NotesItem[], depth = 0): string {
  const indent = "  ".repeat(depth);
  return items
    .flatMap((item) => {
      const lines = [`${indent}- ${item.text}`];
      if (item.children?.length) {
        lines.push(renderNotes(item.children, depth + 1));
      }
      return lines;
    })
    .join("\n");
}

function renderTable(cols: string[], rows: string[][]): string {
  const escape = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");
  const header = `| ${cols.map(escape).join(" | ")} |`;
  const divider = `| ${cols.map(() => "---").join(" | ")} |`;
  const body = rows.map((r) => `| ${r.map((c) => escape(c)).join(" | ")} |`).join("\n");
  return `${header}\n${divider}\n${body}`;
}

function renderCites(cites: Cites | undefined): string {
  if (cites == null) return "";
  if (Array.isArray(cites)) {
    return cites.length ? ` ${cites.map((n) => `[^${n}]`).join("")}` : "";
  }
  return cites > 0 ? ` ${"[^*]".repeat(cites)}` : "";
}

function renderBlock(b: ReportBlock): string {
  switch (b.kind) {
    case "sectionLabel":
      return `## ${b.text}`;
    case "heading":
      return `${"#".repeat(b.level)} ${b.text}`;
    case "paragraph":
      return `${b.text}${renderCites(b.cites)}`;
    case "table":
      return renderTable(b.columns, b.rows);
    case "notes":
      return `${b.title ? `**${b.title}**\n\n` : ""}${renderNotes(b.items)}`;
  }
}

export function reportToMarkdown(report: Report): string {
  const lines: string[] = [];
  lines.push(`# ${report.question}`);
  lines.push("");
  lines.push(`*${report.date}*`);
  lines.push("");
  lines.push(`**TLDR.** ${report.tldr}`);
  lines.push("");

  if (report.report?.length) {
    for (const b of report.report) {
      lines.push(renderBlock(b));
      lines.push("");
    }
  } else {
    lines.push("_Report not yet generated._");
    lines.push("");
  }

  if (report.references?.length) {
    lines.push("## References");
    lines.push("");
    report.references.forEach((p, i) => {
      const authors =
        p.authors.length > 4
          ? `${p.authors.slice(0, 4).join(", ")}, et al.`
          : p.authors.join(", ");
      const journal = p.journal ? ` ${p.journal}.` : "";
      const doi = p.doi ? ` https://doi.org/${p.doi}` : "";
      lines.push(`${i + 1}. ${authors} (${p.year || "n.d."}). ${p.title}.${journal}${doi}`);
    });
    lines.push("");
  }

  return lines.join("\n");
}
