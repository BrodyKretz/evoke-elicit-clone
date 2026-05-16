import { getReport } from "@/lib/data/reports";
import { exportReportAsPptx, pptxFilename } from "@/lib/export/pptx";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const report = getReport(params.id);
  if (!report) {
    return new Response(JSON.stringify({ error: "not_found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (!report.report || report.report.length === 0) {
    return new Response(
      JSON.stringify({ error: "report has no body to export" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    const buf = await exportReportAsPptx(report);
    const filename = pptxFilename(report);
    // Cast the Node Buffer to BodyInit. Buffer extends Uint8Array at runtime
    // so this is safe; the Next/lib.dom mismatched typings just need a hint.
    return new Response(buf as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(buf.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "pptx export failed";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
