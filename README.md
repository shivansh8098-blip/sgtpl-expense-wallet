# SGTPL Sales Expense Wallet

Mobile-first expense wallet for travelling sales managers. Employees only see Add Expense, My Expenses, and My Balance. Admins can manage employees, advances, approvals, dashboards, and exports.

## Tech Stack

- React + TypeScript + Vite
- Tailwind CSS with shadcn-style primitives
- Supabase Auth, Postgres, Storage, and Row Level Security
- Excel and PDF export

## Folder Structure

```text
sgtpl-sales-expense-wallet/
  supabase/migrations/001_initial_schema.sql
  supabase/migrations/002_expense_dates_advance_payments_audit.sql
  src/
    components/
    features/admin/
    features/employee/
    lib/
    App.tsx
    main.tsx
```

## Supabase Setup

1. Create a Supabase project.
2. In Authentication > Providers, enable Google.
3. Add the local callback URL while developing:

```text
http://localhost:5173
```

4. For a new Supabase project, run both SQL files in order:

```text
supabase/migrations/001_initial_schema.sql
supabase/migrations/002_expense_dates_advance_payments_audit.sql
```

For an existing project that already ran `001_initial_schema.sql`, run only:

```text
supabase/migrations/002_expense_dates_advance_payments_audit.sql
```

5. Create the first admin employee from the SQL editor:

```sql
insert into public.employees (name, email, mobile, role, active)
values ('Admin Name', 'admin@gmail.com', '9999999999', 'admin', true);
```

After the first admin logs in, employee access can be maintained from the Employees screen.

## Local Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Set these values in `.env.local`:

```text
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## Business Rules Implemented

- Users are matched automatically by Google account email.
- Employees cannot type or change their name, email, or employee ID.
- Employees can only see their own expenses, advances, balance, and bill photos.
- Admins can see and manage all employees, expenses, advances, balances, and reports.
- Balance formula is:

```text
Available Balance = Total Advances - Total Approved Expenses
```

- Expenses start as `pending`.
- Only approved expenses reduce employee balance.
- Bill images are stored in the private `expense-bills` Supabase Storage bucket.
- Advance payment proofs are stored in the private `advance-proofs` Supabase Storage bucket.
- Expense approval and rejection timestamps are stored for audit history.

## Employee Screens

- Add Expense
- My Expenses
- My Balance

The Add Expense screen supports category, amount, editable expense date, multiple bill photos, optional notes, and automatic GPS capture. Expense date defaults to today, but employees can choose older dates when they upload late.

Before submission the employee sees:

```text
Location: Balangir, Odisha
Latitude: xx.xxxxx
Longitude: xx.xxxxx
```

If location permission is denied, the app shows:

```text
Location permission is required to submit expenses.
```

Fixed expense categories:

```text
Hotel
Food
Tea
Auto
Bus
Train
Flight
Fuel
Medical
Entertainment
Customer Meeting
Other
```

When `Other` is selected, the employee must type the expense name manually.

## Admin Screens

- Dashboard KPIs
- Expense approval and rejection
- Bulk approval
- Advance Payments with payment date, payment mode, and proof upload
- Employee access management
- Reports and Excel/PDF export

Payment mode options:

```text
Bank Transfer
UPI
Cash
Cheque
Other
```

Supported payment proof uploads:

```text
Screenshots
Bank transfer receipts
UTR screenshots
UPI screenshots
PDF proof
```

## Reports

Excel and PDF exports include:

```text
Employee Name
Expense Date
Expense Category
Amount
Location
Latitude
Longitude
Status
Advance Date
Advance Amount
Payment Mode
Current Balance
```

## Deployment

1. Build the app:

```bash
npm run build
```

2. Deploy the `dist` folder to Vercel, Netlify, Cloudflare Pages, or any static host.
3. Add production environment variables in the hosting provider.
4. Add the production URL to Supabase Auth redirect URLs.

## Notes

- Storage paths begin with the employee UUID, allowing RLS policies to restrict bill access.
- The balance view is a security-invoker database view, so table RLS still applies.
- Use the Supabase service role only for initial bootstrap or backend maintenance scripts, never in this browser app.
