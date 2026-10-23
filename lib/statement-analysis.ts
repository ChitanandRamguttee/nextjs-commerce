export type StatementTransaction = {
  date: string;
  description: string;
  amount: number;
};

export type ClassifiedTransaction = StatementTransaction & {
  category: string;
  statementSection: "balanceSheet" | "incomeAndExpenditure";
  bucket: "asset" | "liability" | "income" | "expense";
};

export const MAX_STATEMENT_ROWS = 5_000;

const CATEGORY_RULES: Array<{
  match: RegExp;
  category: string;
  statementSection: ClassifiedTransaction["statementSection"];
  bucket: ClassifiedTransaction["bucket"];
}> = [
  {
    match: /(salary|payroll|bonus|commission)/i,
    category: "Salary Income",
    statementSection: "incomeAndExpenditure",
    bucket: "income",
  },
  {
    match: /(transfer from|deposit|refund received|interest credit)/i,
    category: "Other Income",
    statementSection: "incomeAndExpenditure",
    bucket: "income",
  },
  {
    match: /(rent|lease)/i,
    category: "Rent Expense",
    statementSection: "incomeAndExpenditure",
    bucket: "expense",
  },
  {
    match: /(electricity|water|gas|utility|internet|phone)/i,
    category: "Utilities Expense",
    statementSection: "incomeAndExpenditure",
    bucket: "expense",
  },
  {
    match: /(grocery|supermarket|mart|food)/i,
    category: "Food Expense",
    statementSection: "incomeAndExpenditure",
    bucket: "expense",
  },
  {
    match: /(loan payment|emi|mortgage|credit card payment)/i,
    category: "Loan Liability",
    statementSection: "balanceSheet",
    bucket: "liability",
  },
  {
    match: /(insurance)/i,
    category: "Insurance Expense",
    statementSection: "incomeAndExpenditure",
    bucket: "expense",
  },
  {
    match: /(tax|irs|hmrc|vat)/i,
    category: "Tax Expense",
    statementSection: "incomeAndExpenditure",
    bucket: "expense",
  },
  {
    match: /(cash withdrawal|atm)/i,
    category: "Cash Asset Movement",
    statementSection: "balanceSheet",
    bucket: "asset",
  },
];

function parseCsvRows(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let insideQuotes = false;

  const finishRow = () => {
    row.push(field);
    if (row.some((value) => value.trim() !== "")) {
      rows.push(row);
      if (rows.length > MAX_STATEMENT_ROWS + 1) {
        throw new RangeError(
          `A statement can contain at most ${MAX_STATEMENT_ROWS} transactions.`,
        );
      }
    }
    row = [];
    field = "";
  };

  for (let index = 0; index < input.length; index += 1) {
    const character = input.charAt(index);

    if (character === '"') {
      if (insideQuotes && input.charAt(index + 1) === '"') {
        field += '"';
        index += 1;
      } else if (insideQuotes) {
        insideQuotes = false;
      } else if (field.trim() === "") {
        field = "";
        insideQuotes = true;
      } else {
        throw new SyntaxError("Invalid CSV quoting.");
      }
      continue;
    }

    if (!insideQuotes && character === ",") {
      row.push(field);
      field = "";
      continue;
    }

    if (!insideQuotes && (character === "\n" || character === "\r")) {
      if (character === "\r" && input.charAt(index + 1) === "\n") {
        index += 1;
      }
      finishRow();
      continue;
    }

    field += character;
  }

  if (insideQuotes) {
    throw new SyntaxError("Invalid CSV quoting.");
  }

  if (field.length > 0 || row.length > 0) {
    finishRow();
  }

  return rows;
}

function parseAmount(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parenthesizedNegative = /^\(.*\)$/.test(trimmed);
  const normalized = trimmed.replace(/,/g, "").replace(/[^\d.+-]/g, "");
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) {
    return null;
  }

  const amount = Number(normalized);
  if (!Number.isFinite(amount)) {
    return null;
  }

  return parenthesizedNegative ? -Math.abs(amount) : amount;
}

export function parseCsvStatement(input: string): StatementTransaction[] {
  const rows = parseCsvRows(input);
  if (rows.length <= 1) {
    return [];
  }

  const transactions: StatementTransaction[] = [];
  for (const cells of rows.slice(1)) {
    const date = cells[0]?.trim();
    const description = cells[1]?.trim();
    const amountText = cells[2];

    if (!date || !description || amountText === undefined) {
      continue;
    }

    const amount = parseAmount(amountText);
    if (amount === null) {
      continue;
    }

    transactions.push({ date, description, amount });
  }

  return transactions;
}

export function classifyTransactions(
  transactions: StatementTransaction[],
): ClassifiedTransaction[] {
  return transactions.map((transaction) => {
    const rule = CATEGORY_RULES.find((item) =>
      item.match.test(transaction.description),
    );

    if (rule) {
      return {
        ...transaction,
        category: rule.category,
        statementSection: rule.statementSection,
        bucket: rule.bucket,
      };
    }

    if (transaction.amount >= 0) {
      return {
        ...transaction,
        category: "Uncategorized Income",
        statementSection: "incomeAndExpenditure",
        bucket: "income",
      };
    }

    return {
      ...transaction,
      category: "Uncategorized Expense",
      statementSection: "incomeAndExpenditure",
      bucket: "expense",
    };
  });
}

export function summarizeBySection(transactions: ClassifiedTransaction[]) {
  const initial = {
    balanceSheet: {
      assets: 0,
      liabilities: 0,
    },
    incomeAndExpenditure: {
      income: 0,
      expenditure: 0,
      net: 0,
    },
    byCategory: {} as Record<string, number>,
  };

  return transactions.reduce((acc, item) => {
    acc.byCategory[item.category] =
      (acc.byCategory[item.category] ?? 0) + item.amount;

    if (item.statementSection === "balanceSheet") {
      if (item.bucket === "asset") {
        acc.balanceSheet.assets += item.amount;
      } else if (item.bucket === "liability") {
        acc.balanceSheet.liabilities += Math.abs(item.amount);
      }
    }

    if (item.statementSection === "incomeAndExpenditure") {
      if (item.bucket === "income") {
        acc.incomeAndExpenditure.income += item.amount;
      } else {
        acc.incomeAndExpenditure.expenditure += Math.abs(item.amount);
      }

      acc.incomeAndExpenditure.net =
        acc.incomeAndExpenditure.income - acc.incomeAndExpenditure.expenditure;
    }

    return acc;
  }, initial);
}
