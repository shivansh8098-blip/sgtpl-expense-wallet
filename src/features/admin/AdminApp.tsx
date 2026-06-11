import { useEffect, useMemo, useState } from "react";
import { Check, Download, Eye, FileSpreadsheet, FileText, Plus, X } from "lucide-react";
import jsPDF from "jspdf";
import "jspdf-autotable";
import * as XLSX from "xlsx";
import {
  addAdvance,
  getAdvanceProofSignedUrl,
  getBalances,
  getBillSignedUrl,
  listAdvances,
  listEmployees,
  listExpenses,
  saveEmployee,
  updateExpenseStatus,
  uploadAdvanceProofs,
  type ExpenseFilter,
} from "../../lib/api";
import { displayDate, fullDateTime, money, todayInputDate } from "../../lib/format";
import { PAYMENT_MODES } from "../../lib/categories";
import type { Advance, Balance, Employee, Expense, PaymentMode } from "../../lib/types";
import { StatusBadge } from "../../components/StatusBadge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input, Label, Select, Textarea } from "../../components/ui/Field";

type AdminTab = "dashboard" | "expenses" | "advances" | "employees" | "reports";

export function AdminApp() {
  const [tab, setTab] = useState<AdminTab>("dashboard");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [advances, setAdvances] = useState<Advance[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [filter, setFilter] = useState<ExpenseFilter>("month");

  async function refresh() {
    const [employeeRows, expenseRows, advanceRows, balanceRows] = await Promise.all([listEmployees(), listExpenses(filter), listAdvances(), getBalances()]);
    setEmployees(employeeRows);
    setExpenses(expenseRows);
    setAdvances(advanceRows);
    setBalances(balanceRows);
  }

  useEffect(() => {
    void refresh();
  }, [filter]);

  const kpis = useMemo(() => {
    const total = expenses.reduce((sum, item) => sum + Number(item.amount), 0);
    const pending = expenses.filter((item) => item.status === "pending");
    const approved = expenses.filter((item) => item.status === "approved").reduce((sum, item) => sum + Number(item.amount), 0);
    const advances = balances.reduce((sum, item) => sum + Number(item.total_advances), 0);
    const outstanding = balances.reduce((sum, item) => sum + Number(item.available_balance), 0);
    return [
      ["Expenses This Month", money(total)],
      ["Pending Expenses", String(pending.length)],
      ["Approved Expenses", money(approved)],
      ["Advances Given", money(advances)],
      ["Outstanding Balance", money(outstanding)],
    ];
  }, [balances, expenses]);

  return (
    <div className="space-y-4">
      <nav className="grid grid-cols-5 rounded-lg bg-white p-1 text-xs font-semibold shadow-soft">
        {[
          ["dashboard", "Dashboard"],
          ["expenses", "Expenses"],
          ["advances", "Advances"],
          ["employees", "Employees"],
          ["reports", "Reports"],
        ].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key as AdminTab)} className={`rounded-md px-2 py-3 ${tab === key ? "bg-primary text-white" : ""}`}>
            {label}
          </button>
        ))}
      </nav>

      {tab === "dashboard" && <Dashboard kpis={kpis} balances={balances} />}
      {tab === "expenses" && <ExpenseManagement expenses={expenses} filter={filter} setFilter={setFilter} onChanged={() => void refresh()} />}
      {tab === "advances" && <AdvanceManagement employees={employees} advances={advances} balances={balances} onChanged={() => void refresh()} />}
      {tab === "employees" && <EmployeeAccess employees={employees} onChanged={() => void refresh()} />}
      {tab === "reports" && <Reports expenses={expenses} advances={advances} balances={balances} />}
    </div>
  );
}

function EmployeeAccess(
  { employees, onChanged }: { employees: Employee[]; onChanged: () => void }) {
  const [editing, setEditing] = useState<Employee | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [role, setRole] = useState<"admin" | "employee">("employee");
  const [active, setActive] = useState(true);

  function startEdit(employee: Employee) {
    setEditing(employee);
    setName(employee.name);
    setEmail(employee.email);
    setMobile(employee.mobile || "");
    setRole(employee.role);
    setActive(employee.active);
  }

  function clear() {
    setEditing(null);
    setName("");
    setEmail("");
    setMobile("");
    setRole("employee");
    setActive(true);
  }

  async function submit() {
    if (!name.trim() || !email.trim()) return;
    await saveEmployee({ id: editing?.id, name, email, mobile, role, active });
    clear();
    onChanged();
  }

  return (
    <section className="grid gap-4 lg:grid-cols-[360px_1fr]">
      <Card className="space-y-4">
        <h2 className="text-xl font-bold">{editing ? "Edit Employee" : "Add Employee"}</h2>
        <div>
          <Label>Name</Label>
          <Input value={name} onChange={(event) => setName(event.target.value)} />
        </div>
        <div>
          <Label>Gmail ID</Label>
          <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </div>
        <div>
          <Label>Mobile Number</Label>
          <Input value={mobile} onChange={(event) => setMobile(event.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Role</Label>
            <Select value={role} onChange={(event) => setRole(event.target.value as "admin" | "employee")}>
              <option value="employee">Employee</option>
              <option value="admin">Admin</option>
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={active ? "active" : "inactive"} onChange={(event) => setActive(event.target.value === "active")}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </div>
        </div>
        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => void submit()}>
            Save
          </Button>
          {editing && (
            <Button variant="secondary" onClick={clear}>
              Cancel
            </Button>
          )}
        </div>
      </Card>

      <Card>
        <h2 className="mb-3 text-xl font-bold">Employees</h2>
        <div className="space-y-2">
          {employees.map((employee) => (
            <button
              key={employee.id}
              onClick={() => startEdit(employee)}
              className="grid w-full gap-1 rounded-md bg-muted p-3 text-left sm:grid-cols-[1fr_1fr_auto]"
            >
              <span className="font-semibold">{employee.name}</span>
              <span className="text-sm text-muted-foreground">{employee.email}</span>
              <span className={`text-sm font-semibold ${employee.active ? "text-success" : "text-danger"}`}>
                {employee.role} / {employee.active ? "active" : "inactive"}
              </span>
            </button>
          ))}
        </div>
      </Card>
    </section>
  );
}

function Dashboard({ kpis, balances }: { kpis: string[][]; balances: Balance[] }) {
  return (
    <section className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {kpis.map(([label, value]) => (
          <Card key={label} className="p-3">
            <p className="text-xs font-semibold text-muted-foreground">{label}</p>
            <p className="mt-2 text-2xl font-bold">{value}</p>
          </Card>
        ))}
      </div>
      <Card>
        <h2 className="mb-3 text-lg font-bold">Employee Balances</h2>
        <div className="space-y-2">
          {balances.map((item) => (
            <div key={item.employee_id} className="grid gap-2 rounded-md bg-muted p-3 sm:grid-cols-[1.2fr_1fr_1fr_1fr] sm:items-center">
              <div>
                <p className="font-semibold">{item.name}</p>
                <p className="text-xs text-muted-foreground">{item.mobile || item.email}</p>
              </div>
              <p className="text-sm">Advances: <strong>{money(item.total_advances)}</strong></p>
              <p className="text-sm">Expenses: <strong>{money(item.total_approved_expenses)}</strong></p>
              <p className="font-bold">Balance: {money(item.available_balance)}</p>
            </div>
          ))}
        </div>
      </Card>
    </section>
  );
}

function ExpenseManagement({
  expenses,
  filter,
  setFilter,
  onChanged,
}: {
  expenses: Expense[];
  filter: ExpenseFilter;
  setFilter: (filter: ExpenseFilter) => void;
  onChanged: () => void;
}) {
  const pendingIds = expenses.filter((item) => item.status === "pending").map((item) => item.id);

  async function bulkApprove() {
    await Promise.all(pendingIds.map((id) => updateExpenseStatus(id, "approved")));
    onChanged();
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold">Expense Management</h2>
        <div className="flex gap-2">
          <Select value={filter} onChange={(event) => setFilter(event.target.value as ExpenseFilter)} className="h-10">
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="all">All</option>
          </Select>
          <Button variant="secondary" onClick={() => void bulkApprove()} disabled={pendingIds.length === 0}>
            <Check size={16} />
            Bulk Approve
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-white">
        {expenses.map((expense) => (
          <ExpenseRow key={expense.id} expense={expense} onChanged={onChanged} />
        ))}
        {expenses.length === 0 && <p className="p-4 text-sm text-muted-foreground">No expenses found.</p>}
      </div>
    </section>
  );
}

function ExpenseRow({ expense, onChanged }: { expense: Expense; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);

  async function setStatus(status: "approved" | "rejected") {
    setBusy(true);
    await updateExpenseStatus(expense.id, status);
    setBusy(false);
    onChanged();
  }

  async function viewBill() {
    if (!expense.photo_urls.length) return;
    const url = await getBillSignedUrl(expense.photo_urls[0]);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="grid gap-3 border-b border-border p-3 last:border-0 md:grid-cols-[1.3fr_1fr_1fr_auto] md:items-center">
      <div>
        <p className="font-semibold">{expense.employees?.name || "Employee"}</p>
        <p className="text-xs text-muted-foreground">Expense: {displayDate(expense.expense_date || expense.created_at)}</p>
        <p className="text-xs text-muted-foreground">Created: {fullDateTime(expense.created_at)}</p>
      </div>
      <div>
        <p className="font-semibold">{expenseLabel(expense)}</p>
        <p className="text-xs text-muted-foreground">
          {expense.location || "No location"}
          {expense.latitude && expense.longitude ? ` (${expense.latitude}, ${expense.longitude})` : ""}
        </p>
      </div>
      <div className="flex items-center justify-between gap-2 md:block">
        <p className="font-bold">{money(expense.amount)}</p>
        <StatusBadge status={expense.status} />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => void viewBill()} disabled={!expense.photo_urls.length}>
          <Eye size={16} />
          Bill
        </Button>
        <Button variant="secondary" onClick={() => void setStatus("approved")} disabled={busy || expense.status === "approved"}>
          <Check size={16} />
        </Button>
        <Button variant="danger" onClick={() => void setStatus("rejected")} disabled={busy || expense.status === "rejected"}>
          <X size={16} />
        </Button>
      </div>
    </div>
  );
}

function AdvanceManagement({
  employees,
  advances,
  balances,
  onChanged,
}: {
  employees: Employee[];
  advances: Advance[];
  balances: Balance[];
  onChanged: () => void;
}) {
  const [employeeId, setEmployeeId] = useState("");
  const [amount, setAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(todayInputDate());
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("Bank Transfer");
  const [proofFiles, setProofFiles] = useState<File[]>([]);
  const [remarks, setRemarks] = useState("");
  const [message, setMessage] = useState("");
  const activeEmployees = employees.filter((employee) => employee.active && employee.role === "employee");

  useEffect(() => {
    if (!employeeId && activeEmployees[0]) setEmployeeId(activeEmployees[0].id);
  }, [activeEmployees, employeeId]);

  async function submit() {
    setMessage("");
    if (!employeeId || Number(amount) <= 0) return;
    if (proofFiles.length === 0) return setMessage("Payment proof is required.");

    try {
      const proofUrls = await uploadAdvanceProofs(proofFiles, employeeId);
      await addAdvance({
        employeeId,
        amount: Number(amount),
        paymentDate,
        paymentMode,
        proofUrls,
        remarks,
      });
      setAmount("");
      setPaymentDate(todayInputDate());
      setPaymentMode("Bank Transfer");
      setProofFiles([]);
      setRemarks("");
      onChanged();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Payment could not be saved.");
    }
  }

  return (
    <section className="grid gap-4 lg:grid-cols-[360px_1fr]">
      <Card className="space-y-4">
        <h2 className="text-xl font-bold">Advance Payments</h2>
        <div>
          <Label htmlFor="advance-employee">Employee</Label>
          <Select id="advance-employee" value={employeeId} onChange={(event) => setEmployeeId(event.target.value)}>
            {activeEmployees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="advance-amount">Amount</Label>
          <Input id="advance-amount" type="number" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} />
        </div>
        <div>
          <Label htmlFor="payment-date">Payment Date</Label>
          <Input id="payment-date" type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} />
        </div>
        <div>
          <Label htmlFor="payment-mode">Payment Mode</Label>
          <Select id="payment-mode" value={paymentMode} onChange={(event) => setPaymentMode(event.target.value as PaymentMode)}>
            {PAYMENT_MODES.map((mode) => (
              <option key={mode}>{mode}</option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Payment Proof</Label>
          <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-primary bg-teal-50 p-4 text-center text-primary">
            <FileText size={24} />
            <span className="font-semibold">Upload receipt or screenshot</span>
            <span className="text-xs text-muted-foreground">{proofFiles.length ? `${proofFiles.length} file selected` : "Images and PDF supported"}</span>
            <input
              className="hidden"
              type="file"
              accept="image/*,application/pdf"
              multiple
              onChange={(event) => setProofFiles(Array.from(event.target.files || []))}
            />
          </label>
        </div>
        <div>
          <Label htmlFor="advance-remarks">Remarks</Label>
          <Textarea id="advance-remarks" value={remarks} onChange={(event) => setRemarks(event.target.value)} />
        </div>
        {message && <p className="rounded-md bg-red-50 p-3 text-sm font-semibold text-danger">{message}</p>}
        <Button className="w-full" onClick={() => void submit()}>
          <Plus size={18} />
          Save Payment
        </Button>
      </Card>

      <Card className="space-y-4">
        <div>
          <h2 className="text-xl font-bold">Current Balances</h2>
        </div>
        <div className="space-y-2">
          {balances.map((item) => (
            <div key={item.employee_id} className="grid grid-cols-2 gap-2 rounded-md bg-muted p-3 sm:grid-cols-4">
              <p className="font-semibold">{item.name}</p>
              <p>Advance: {money(item.total_advances)}</p>
              <p>Spent: {money(item.total_approved_expenses)}</p>
              <p className="font-bold">Balance: {money(item.available_balance)}</p>
            </div>
          ))}
        </div>
        <div>
          <h3 className="mb-2 font-bold">Payment History</h3>
          <div className="space-y-2">
            {advances.map((advance) => (
              <AdvanceHistoryRow key={advance.id} advance={advance} />
            ))}
            {advances.length === 0 && <p className="text-sm text-muted-foreground">No payments recorded.</p>}
          </div>
        </div>
      </Card>
    </section>
  );
}

function AdvanceHistoryRow({ advance }: { advance: Advance }) {
  async function openProof() {
    if (!advance.proof_urls.length) return;
    const url = await getAdvanceProofSignedUrl(advance.proof_urls[0]);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="grid gap-2 rounded-md bg-muted p-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-center">
      <p className="font-semibold">{advance.employees?.name || "Employee"}</p>
      <p>{displayDate(advance.payment_date || advance.created_at)}</p>
      <p>
        {money(advance.amount)} / {advance.payment_mode}
      </p>
      <Button variant="secondary" onClick={() => void openProof()} disabled={!advance.proof_urls.length}>
        <Eye size={16} />
        Proof
      </Button>
    </div>
  );
}

function Reports({ expenses, advances, balances }: { expenses: Expense[]; advances: Advance[]; balances: Balance[] }) {
  const rows = expenses.map((item) => ({
    Employee: item.employees?.name || "",
    "Expense Date": displayDate(item.expense_date || item.created_at),
    Category: expenseLabel(item),
    Amount: Number(item.amount),
    Status: item.status,
    Location: item.location || "",
    Latitude: item.latitude || "",
    Longitude: item.longitude || "",
  }));
  const advanceRows = advances.map((item) => ({
    Employee: item.employees?.name || "",
    "Advance Date": displayDate(item.payment_date || item.created_at),
    "Advance Amount": Number(item.amount),
    "Payment Mode": item.payment_mode,
    Proof: item.proof_urls.length ? "Uploaded" : "Missing",
  }));
  const balanceRows = balances.map((item) => ({
    Employee: item.name,
    Mobile: item.mobile || "",
    "Total Advances": Number(item.total_advances),
    "Total Expenses": Number(item.total_approved_expenses),
    "Current Balance": Number(item.available_balance),
  }));

  function exportExcel() {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "Expenses");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(advanceRows), "Advances");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(balanceRows), "Balances");
    XLSX.writeFile(workbook, "sgtpl-expense-report.xlsx");
  }

  function exportPdf() {
    const doc = new jsPDF();
    doc.text("SGTPL Expense Report", 14, 16);
    (doc as unknown as { autoTable: (options: object) => void }).autoTable({
      head: [["Employee", "Expense Date", "Category", "Amount", "Status", "Location", "Lat", "Long"]],
      body: rows.map((row) => [row.Employee, row["Expense Date"], row.Category, money(row.Amount), row.Status, row.Location, row.Latitude, row.Longitude]),
      startY: 22,
    });
    (doc as unknown as { autoTable: (options: object) => void }).autoTable({
      head: [["Employee", "Advance Date", "Amount", "Mode"]],
      body: advanceRows.map((row) => [row.Employee, row["Advance Date"], money(row["Advance Amount"]), row["Payment Mode"]]),
    });
    (doc as unknown as { autoTable: (options: object) => void }).autoTable({
      head: [["Employee", "Current Balance"]],
      body: balanceRows.map((row) => [row.Employee, money(row["Current Balance"])]),
    });
    doc.save("sgtpl-expense-report.pdf");
  }

  const categoryTotals = groupTotals(expenses, expenseLabel);
  const cityTotals = groupTotals(expenses, (expense) => expense.location || "Not captured");
  const employeeTotals = groupTotals(expenses, (expense) => expense.employees?.name || "Employee");
  const monthlyTotals = groupTotals(expenses, (expense) =>
    new Date(`${expense.expense_date || expense.created_at}T00:00:00`).toLocaleString("en-IN", { month: "short", year: "numeric" }),
  );
  const pendingRows = expenses
    .filter((expense) => expense.status === "pending")
    .map((expense) => [expense.employees?.name || "Employee", `${expense.expense_category} - ${money(expense.amount)}`]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold">Reports</h2>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={exportExcel}>
            <FileSpreadsheet size={17} />
            Excel
          </Button>
          <Button variant="secondary" onClick={exportPdf}>
            <FileText size={17} />
            PDF
          </Button>
        </div>
      </div>
      <ReportBlock title="Employee Wise Expense" rows={employeeTotals} />
      <ReportBlock title="Category Wise Expense" rows={categoryTotals} />
      <ReportBlock title="City Wise Expense" rows={cityTotals} />
      <ReportBlock title="Monthly Expense Trend" rows={monthlyTotals} />
      <ReportBlock title="Pending Approval Report" rows={pendingRows} />
      <ReportBlock
        title="Advance vs Expense"
        rows={balances.map((item) => [item.name, `${money(item.total_advances)} / ${money(item.total_approved_expenses)}`])}
      />
      <Button variant="secondary" onClick={exportExcel}>
        <Download size={17} />
        Download Full Report
      </Button>
    </section>
  );
}

function expenseLabel(expense: Expense) {
  return expense.expense_category === "Other" && expense.other_expense_text
    ? `Other: ${expense.other_expense_text}`
    : expense.expense_category;
}

function groupTotals(expenses: Expense[], keyFn: (expense: Expense) => string) {
  const map = new Map<string, number>();
  expenses.forEach((expense) => map.set(keyFn(expense), (map.get(keyFn(expense)) || 0) + Number(expense.amount)));
  return Array.from(map.entries()).map(([label, amount]) => [label, money(amount)]);
}

function ReportBlock({ title, rows }: { title: string; rows: string[][] }) {
  return (
    <Card>
      <h3 className="mb-3 font-bold">{title}</h3>
      <div className="space-y-2">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between rounded-md bg-muted p-3">
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm text-muted-foreground">No data yet.</p>}
      </div>
    </Card>
  );
}
