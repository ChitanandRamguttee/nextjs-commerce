import {
  classifyTransactions,
  parseCsvStatement,
  summarizeBySection,
  type StatementTransaction,
} from "lib/statement-analysis";
import { NextRequest, NextResponse } from "next/server";

const MAX_REQUEST_BYTES = 1_048_576;
const MAX_UPLOAD_BYTES = 1_000_000;

function jsonError(message: string, status: number): NextResponse {
  return NextResponse.json(
    { error: message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const contentType = req.headers.get("content-type") ?? "";

  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    return jsonError(
      'Please upload a file via multipart/form-data with field name "statement". CSV and plain text are supported.',
      400,
    );
  }

  const contentLength = req.headers.get("content-length");
  if (contentLength !== null) {
    const requestBytes = Number(contentLength);
    if (!Number.isSafeInteger(requestBytes) || requestBytes < 0) {
      return jsonError("Invalid Content-Length header.", 400);
    }
    if (requestBytes > MAX_REQUEST_BYTES) {
      return jsonError("Statement upload is too large.", 413);
    }
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return jsonError("Invalid multipart form data.", 400);
  }

  const file = formData.get("statement");
  if (!(file instanceof File)) {
    return jsonError(
      'Missing statement file. Use form field name "statement".',
      400,
    );
  }

  if (file.size === 0) {
    return jsonError("The uploaded statement is empty.", 400);
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return jsonError("Statement upload is too large.", 413);
  }

  let fileContents: string;
  try {
    fileContents = await file.text();
  } catch {
    return jsonError("Unable to read the uploaded statement.", 400);
  }

  let transactions: StatementTransaction[];
  try {
    transactions = parseCsvStatement(fileContents);
  } catch (error) {
    if (error instanceof RangeError) {
      return jsonError(error.message, 413);
    }
    return jsonError(
      "Invalid CSV quoting. Check the uploaded statement and try again.",
      400,
    );
  }

  if (!transactions.length) {
    return jsonError(
      "No valid transactions found. Provide a CSV file with columns: date,description,amount.",
      400,
    );
  }

  const classifiedTransactions = classifyTransactions(transactions);
  const summary = summarizeBySection(classifiedTransactions);
  const fileName = file.name
    .replaceAll("/", "_")
    .replaceAll("\\", "_")
    .replace(/[\u0000-\u001f\u007f]/g, "_")
    .slice(0, 255);

  return NextResponse.json(
    {
      fileName,
      transactionCount: classifiedTransactions.length,
      summary,
      transactions: classifiedTransactions,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
