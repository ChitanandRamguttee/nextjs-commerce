import {
  classifyTransactions,
  parseCsvStatement,
  summarizeBySection,
} from "lib/statement-analysis";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest): Promise<NextResponse> {
  const contentType = req.headers.get("content-type") ?? "";

  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json(
      {
        error:
          'Please upload a file via multipart/form-data with field name "statement". CSV and plain text are supported.',
      },
      { status: 400 },
    );
  }

  const formData = await req.formData();
  const file = formData.get("statement");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: 'Missing statement file. Use form field name "statement".' },
      { status: 400 },
    );
  }

  const fileContents = await file.text();
  const transactions = parseCsvStatement(fileContents);

  if (!transactions.length) {
    return NextResponse.json(
      {
        error:
          "No transactions found. Provide a CSV file with columns: date,description,amount.",
      },
      { status: 400 },
    );
  }

  const classifiedTransactions = classifyTransactions(transactions);
  const summary = summarizeBySection(classifiedTransactions);

  return NextResponse.json({
    fileName: file.name,
    transactionCount: classifiedTransactions.length,
    summary,
    transactions: classifiedTransactions,
  });
}
