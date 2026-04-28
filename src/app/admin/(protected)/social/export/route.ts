import { requireAdminSession } from "@/lib/admin-auth";
import { readSocialContent } from "@/lib/social/store";

export const runtime = "nodejs";

function csvCell(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET() {
  await requireAdminSession("/admin/social");

  const store = await readSocialContent();
  const header = [
    "scheduled_for",
    "platform",
    "status",
    "format",
    "pillar",
    "caption",
    "hashtags",
    "visual_brief",
    "product_url_path",
    "reviewer_flags",
  ];
  const rows = store.drafts.map((draft) => [
    draft.scheduledFor,
    draft.platform,
    draft.status,
    draft.format,
    draft.pillar,
    draft.caption,
    draft.hashtags.join(" "),
    draft.visualBrief,
    draft.productUrlPath,
    draft.reviewerFlags.join(" | "),
  ]);
  const csv = [
    header.map(csvCell).join(","),
    ...rows.map((row) => row.map(csvCell).join(",")),
  ].join("\n");

  return new Response(`${csv}\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="aerthera-social-drafts.csv"',
    },
  });
}
