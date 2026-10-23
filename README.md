# Ledgerly — Statement analysis

A small Next.js app for reviewing bank statement CSVs. Upload a CSV or plain text file with `date,description,amount` columns to receive suggested transaction categories, cash-flow totals, a filtered transaction table, and an exportable CSV.

## Run locally

Requirements: Node.js 22.6 or newer and pnpm.

```sh
pnpm install
pnpm dev
```

The statement analysis endpoint processes uploads in memory and does not persist them. Files are limited to 1 MB and 5,000 transaction rows. Category assignments use description rules and should be reviewed before posting to accounting records.

## Verify

```sh
pnpm test
pnpm build
```

No Shopify store credentials or database are required.
