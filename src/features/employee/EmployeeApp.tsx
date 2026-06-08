import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Camera, History, IndianRupee, MapPin, Plus, Upload } from "lucide-react";
import {
  createExpense,
  getAdvanceProofSignedUrl,
  getBalances,
  listAdvances,
  listExpenses,
  uploadBillPhotos,
  type ExpenseFilter,
} from "../../lib/api";
import { EXPENSE_CATEGORIES } from "../../lib/categories";
import { displayDate, money, shortDate, todayInputDate } from "../../lib/format";
import type { Advance, Balance, Employee, Expense } from "../../lib/types";
import { StatusBadge } from "../../components/StatusBadge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Input, Label, Select, Textarea } from "../../components/ui/Field";

type Tab = "add" | "expenses" | "balance";

export function EmployeeApp({ employee }: { employee: Employee }) {
  const [tab, setTab] = useState<Tab>("add");

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-3 gap-2">
        <HomeButton active={tab === "add"} icon={<Plus size={20} />} label="Add Expense" onClick={() => setTab("add")} />
        <HomeButton active={tab === "expenses"} icon={<History size={20} />} label="My Expenses" onClick={() => setTab("expenses")} />
        <HomeButton active={tab === "balance"} icon={<IndianRupee size={20} />} label="My Balance" onClick={() => setTab("balance")} />
      </section>

      {tab === "add" && <AddExpense employee={employee} onDone={() => setTab("expenses")} />}
      {tab === "expenses" && <MyExpenses />}
      {tab === "balance" && <MyBalance employeeId={employee.id} />}
    </div>
  );
}

function HomeButton({ active, icon, label, onClick }: { active: boolean; icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex min-h-20 flex-col items-center justify-center gap-2 rounded-lg border p-2 text-center text-sm font-semibold ${
        active ? "border-primary bg-teal-50 text-primary" : "border-border bg-white"
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function AddExpense({ employee, onDone }: { employee: Employee; onDone: () => void }) {
  const [category, setCategory] = useState("Hotel");
  const [other, setOther] = useState("");
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(todayInputDate());
  const [notes, setNotes] = useState("");
  const [location, setLocation] = useState("Detecting location...");
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
const [manualLocation, setManualLocation] = useState("");
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocation("GPS not available on this device");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const nextCoords = {
          latitude: Number(pos.coords.latitude.toFixed(6)),
          longitude: Number(pos.coords.longitude.toFixed(6)),
        };
        setCoords(nextCoords);
        void reverseGeocode(nextCoords.latitude, nextCoords.longitude).then(setLocation);
      },
      () => setLocation("Location permission is required to submit expenses."),
      { enableHighAccuracy: true, timeout: 5000 },
    );
  }, []);

  async function submit() {
    setMessage("");
    if (!amount || Number(amount) <= 0) return setMessage("Enter a valid amount.");
    if (files.length === 0) return setMessage("Add at least one bill photo.");
    if (category === "Other" && !other.trim()) return setMessage("Please describe the expense.");
    if (!coords) return setMessage("Location permission is required to submit expenses.");

    setBusy(true);
    try {
      const photo_urls = await uploadBillPhotos(files, employee.id);
      await createExpense({
        employee_id: employee.id,
        expense_category: category,
        other_expense_text: category === "Other" ? other.trim() : undefined,
        amount: Number(amount),
        expense_date: expenseDate,
        notes: notes.trim() || undefined,
        photo_urls,
        location:
  manualLocation.trim()
    ? manualLocation.trim()
    : location.startsWith("Detecting")
      ? undefined
      : location,
        latitude: coords?.latitude,
        longitude: coords?.longitude,
      });
      setAmount("");
      setExpenseDate(todayInputDate());
      setNotes("");
      setOther("");
      setLocation("");
      setFiles([]);
      onDone();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Expense could not be submitted.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">Add Expense</h2>
        <p className="text-sm text-muted-foreground">Today, for {employee.name}</p>
      </div>

      <div>
        <Label htmlFor="expense-category">Expense Category</Label>
        <Select id="expense-category" value={category} onChange={(event) => setCategory(event.target.value)}>
          {EXPENSE_CATEGORIES.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </Select>
      </div>

      {category === "Other" && (
        <div>
          <Label htmlFor="other-expense">What was this expense?</Label>
          <Input id="other-expense" value={other} onChange={(event) => setOther(event.target.value)} placeholder="Short description" />
        </div>
      )}

      <div>
        <Label htmlFor="expense-amount">Amount</Label>
        <Input
          id="expense-amount"
          inputMode="decimal"
          type="number"
          min="1"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder="0"
        />
      </div>

      <div>
        <Label htmlFor="expense-date">Expense Date</Label>
        <Input id="expense-date" type="date" value={expenseDate} onChange={(event) => setExpenseDate(event.target.value)} />
      </div>

      <div>
        <Label>Bill Photo</Label>
        <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-primary bg-teal-50 p-4 text-center text-primary">
          <Camera size={26} />
          <span className="font-semibold">Take photo or upload bill</span>
          <span className="text-xs text-muted-foreground">{files.length ? `${files.length} photo selected` : "Multiple photos allowed"}</span>
          <input
            className="hidden"
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            onChange={(event) => setFiles(Array.from(event.target.files || []))}
          />
        </label>
      </div>

      <div>
        <Label>GPS Location</Label>
        <div className="rounded-lg border border-border bg-muted p-3">
          <div className="flex items-center gap-2 font-semibold">
            <MapPin size={18} className={coords ? "text-success" : "text-muted-foreground"} />
            <span>{location}</span>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
            <span>Latitude: {coords ? coords.latitude : "--"}</span>
            <span>Longitude: {coords ? coords.longitude : "--"}</span>
          </div>
        </div>
      </div>
<div className="mt-4">
  <Label>Manual Location Override</Label>
  <Input
    value={manualLocation}
    onChange={(e) => setManualLocation(e.target.value)}
    placeholder="Enter location manually if GPS is wrong"
  />
</div>
      <div>
        <Label>Notes</Label>
        <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional" />
      </div>

      {message && <p className="rounded-md bg-red-50 p-3 text-sm font-semibold text-danger">{message}</p>}
      <Button className="h-12 w-full text-base" onClick={() => void submit()} disabled={busy}>
        <Upload size={20} />
        {busy ? "Submitting..." : "Submit Expense"}
      </Button>
    </Card>
  );
}

async function reverseGeocode(latitude: number, longitude: number) {
  try {
    const response = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`,
    );
    if (!response.ok) return `${latitude}, ${longitude}`;
    const data = (await response.json()) as {
      city?: string;
      locality?: string;
      principalSubdivision?: string;
    };
    const city = data.city || data.locality;
    return [city, data.principalSubdivision].filter(Boolean).join(", ") || `${latitude}, ${longitude}`;
  } catch {
    return `${latitude}, ${longitude}`;
  }
}

function MyExpenses() {
  const [filter, setFilter] = useState<ExpenseFilter>("month");
  const [expenses, setExpenses] = useState<Expense[]>([]);

  useEffect(() => {
    void listExpenses(filter).then(setExpenses);
  }, [filter]);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold">My Expenses</h2>
        <FilterTabs value={filter} onChange={setFilter} />
      </div>
      {expenses.length === 0 ? (
        <Card className="text-sm text-muted-foreground">No expenses found.</Card>
      ) : (
        <div className="space-y-2">
          {expenses.map((expense) => (
            <Card key={expense.id} className="flex items-center justify-between gap-3 p-3">
              <div>
                <p className="font-semibold">{expenseLabel(expense)}</p>
                <p className="text-sm text-muted-foreground">{shortDate(expense.expense_date || expense.created_at)}</p>
              </div>
              <div className="text-right">
                <p className="font-bold">{money(expense.amount)}</p>
                <StatusBadge status={expense.status} />
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

function expenseLabel(expense: Expense) {
  return expense.expense_category === "Other" && expense.other_expense_text
    ? `Other: ${expense.other_expense_text}`
    : expense.expense_category;
}

function MyBalance({ employeeId }: { employeeId: string }) {
  const [balance, setBalance] = useState<Balance | null>(null);
  const [payments, setPayments] = useState<Advance[]>([]);

  useEffect(() => {
    void getBalances().then((items) => setBalance(items.find((item) => item.employee_id === employeeId) || null));
    void listAdvances().then(setPayments);
  }, [employeeId]);

  const rows = useMemo(
    () => [
      ["Advance", balance?.total_advances ?? 0],
      ["Spent", balance?.total_approved_expenses ?? 0],
      ["Balance", balance?.available_balance ?? 0],
    ],
    [balance],
  );

  return (
    <Card className="space-y-4">
      <h2 className="text-xl font-bold">My Balance</h2>
      <div className="rounded-lg bg-primary p-5 text-primary-foreground">
        <p className="text-sm opacity-90">Available Balance</p>
        <p className="text-4xl font-bold">{money(balance?.available_balance ?? 0)}</p>
      </div>
      <div className="space-y-3">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between border-b border-border pb-3 last:border-0 last:pb-0">
            <span className="font-semibold">{label}</span>
            <span className="font-bold">{money(value as number)}</span>
          </div>
        ))}
      </div>
      <div className="space-y-2">
        <h3 className="font-bold">Payment History</h3>
        {payments.length === 0 ? (
          <p className="rounded-md bg-muted p-3 text-sm text-muted-foreground">No payments received yet.</p>
        ) : (
          payments.map((payment) => <PaymentHistoryRow key={payment.id} payment={payment} />)
        )}
      </div>
    </Card>
  );
}

function PaymentHistoryRow({ payment }: { payment: Advance }) {
  async function openProof() {
    if (!payment.proof_urls.length) return;
    const url = await getAdvanceProofSignedUrl(payment.proof_urls[0]);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="grid grid-cols-[1fr_auto] gap-2 rounded-md bg-muted p-3 text-sm">
      <div>
        <p className="font-semibold">{displayDate(payment.payment_date || payment.created_at)}</p>
        <p className="text-muted-foreground">{payment.payment_mode}</p>
      </div>
      <div className="text-right">
        <p className="font-bold">{money(payment.amount)}</p>
        <button className="text-xs font-semibold text-primary" onClick={() => void openProof()} disabled={!payment.proof_urls.length}>
          Proof
        </button>
      </div>
    </div>
  );
}

function FilterTabs({ value, onChange }: { value: ExpenseFilter; onChange: (value: ExpenseFilter) => void }) {
  return (
    <div className="grid grid-cols-3 rounded-md bg-muted p-1 text-xs font-semibold">
      {[
        ["today", "Today"],
        ["week", "Week"],
        ["month", "Month"],
      ].map(([key, label]) => (
        <button key={key} onClick={() => onChange(key as ExpenseFilter)} className={`rounded px-2 py-2 ${value === key ? "bg-white shadow" : ""}`}>
          {label}
        </button>
      ))}
    </div>
  );
}
