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

export function parseCsvStatement(input: string): StatementTransaction[] {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length <= 1) {
    return [];
  }

  const rows = lines.slice(1);

  return rows
    .map((row) => row.split(",").map((cell) => cell.trim()))
    .filter((cells) => cells.length >= 3)
    .map((cells) => {
      const [date, description, amountText] = cells;
      const amount = Number.parseFloat(amountText.replace(/[^0-9.-]/g, ""));

      return {
        date,
        description,
        amount: Number.isFinite(amount) ? amount : 0,
      };
    });
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
