import { promises as fs } from "fs";
import { NextResponse } from "next/server";
import { hasAdminSession } from "@/lib/admin-auth";
import { getShippingBatchDocument } from "@/lib/shipping-batches";

export const runtime = "nodejs";

type ShipmentBatchDocumentRouteContext = {
  params: Promise<{
    batchId: string;
    documentId: string;
  }>;
};

export async function GET(
  _request: Request,
  { params }: ShipmentBatchDocumentRouteContext,
) {
  if (!(await hasAdminSession())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { batchId, documentId } = await params;
  const documentRecord = await getShippingBatchDocument(batchId, documentId);

  if (!documentRecord) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const file = await fs.readFile(documentRecord.absolutePath);

  return new NextResponse(file, {
    headers: {
      "content-type": documentRecord.document.mimeType,
      "content-length": String(file.byteLength),
      "content-disposition": `inline; filename="${documentRecord.document.filename}"`,
      "cache-control": "private, no-store",
    },
  });
}
