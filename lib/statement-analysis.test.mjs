import assert from "node:assert/strict";
import test from "node:test";
import { MAX_STATEMENT_ROWS, parseCsvStatement } from "./statement-analysis.ts";

test("parses quoted commas, escaped quotes, and currency amounts", () => {
  assert.deepEqual(
    parseCsvStatement(
      'date,description,amount\n2026-10-01,"Market, ""Fresh""","$1,234.50"',
    ),
    [
      {
        date: "2026-10-01",
        description: 'Market, "Fresh"',
        amount: 1234.5,
      },
    ],
  );
});

test("parses parenthesized negatives and skips malformed transaction rows", () => {
  assert.deepEqual(
    parseCsvStatement(
      "date,description,amount\n2026-10-01,Rent,(125.00)\n2026-10-02,Invalid,not-an-amount\n2026-10-03,,10.00",
    ),
    [{ date: "2026-10-01", description: "Rent", amount: -125 }],
  );
});

test("rejects unterminated quoted fields", () => {
  assert.throws(
    () =>
      parseCsvStatement('date,description,amount\n2026-10-01,"Unclosed,10.00'),
    SyntaxError,
  );
});

test("caps transaction rows", () => {
  const rows = Array.from(
    { length: MAX_STATEMENT_ROWS + 1 },
    (_, index) => `2026-10-01,Transaction ${index},1.00`,
  );

  assert.throws(
    () => parseCsvStatement(`date,description,amount\n${rows.join("\n")}`),
    RangeError,
  );
});
