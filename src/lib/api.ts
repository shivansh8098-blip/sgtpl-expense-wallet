import { endOfMonth, endOfWeek, startOfMonth, startOfToday, startOfWeek } from "date-fns";
import { supabase } from "./supabase";
import type { Advance, Balance, Employee, Expense, ExpenseStatus } from "./types";

export type ExpenseFilter = "today" | "week" | "month" | "all";

function rangeFor(filter: ExpenseFilter) {
  const now = new Date();
  if (filter === "today") return { from: startOfToday(), to: now };
  if (filter === "week") return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) };
  if (filter === "month") return { from: startOfMonth(now), to: endOfMonth(now) };
  return null;
}

export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin },
  });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentEmployee(): Promise<Employee | null> {
  const { data: sessionData } = await supabase.auth.getSession();
  const email = sessionData.session?.user.email;
  if (!email) return null;

  const { data, error } = await supabase
    .from("employees")
    .select("*")
    .eq("email", email)
    .eq("active", true)
    .maybeSingle();

  if (error) throw error;
  return data as Employee | null;
}

export async function listEmployees() {
  const { data, error } = await supabase.from("employees").select("*").order("name");
  if (error) throw error;
  return data as Employee[];
}

export async function saveEmployee(payload: {
  id?: string;
  name: string;
  email: string;
  mobile?: string;
  role: "admin" | "employee";
  active: boolean;
}) {
  const record = {
    name: payload.name.trim(),
    email: payload.email.trim().toLowerCase(),
    mobile: payload.mobile?.trim() || null,
    role: payload.role,
    active: payload.active,
  };

  const request = payload.id
    ? supabase.from("employees").update(record).eq("id", payload.id)
    : supabase.from("employees").insert(record);
  const { error } = await request;
  if (error) throw error;
}

export async function listExpenses(filter: ExpenseFilter = "all") {
  let query = supabase
    .from("expenses")
    .select("*, employees(name,email)")
    .order("expense_date", { ascending: false })
    .order("created_at", { ascending: false });

  const range = rangeFor(filter);
  if (range) {
    query = query.gte("expense_date", range.from.toISOString().slice(0, 10)).lte("expense_date", range.to.toISOString().slice(0, 10));
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as Expense[];
}

export async function listAdvances() {
  const { data, error } = await supabase
    .from("advances")
    .select("*, employees(name,email)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as Advance[];
}

export async function getBalances() {
  const { data, error } = await supabase.from("employee_balances").select("*").order("name");
  if (error) throw error;
  return data as Balance[];
}

export async function uploadBillPhotos(files: File[], employeeId: string) {
  const urls: string[] = [];
  for (const file of files) {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${employeeId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("expense-bills").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });
    if (error) throw error;
    urls.push(path);
  }
  return urls;
}

export async function uploadAdvanceProofs(files: File[], employeeId: string) {
  const urls: string[] = [];
  for (const file of files) {
    const ext = file.name.split(".").pop() || "pdf";
    const path = `${employeeId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("advance-proofs").upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });
    if (error) throw error;
    urls.push(path);
  }
  return urls;
}

export async function createExpense(payload: {
  employee_id: string;
  expense_category: string;
  other_expense_text?: string;
  amount: number;
  expense_date: string;
  notes?: string;
  photo_urls: string[];
  location?: string;
  latitude?: number;
  longitude?: number;
}) {
  const { error } = await supabase.from("expenses").insert(payload);
  if (error) throw error;
}

export async function updateExpenseStatus(id: string, status: ExpenseStatus, rejectionReason?: string) {
  const auditPatch =
    status === "approved"
      ? { approved_at: new Date().toISOString(), rejected_at: null }
      : status === "rejected"
        ? { rejected_at: new Date().toISOString() }
        : {};
  const { error } = await supabase.from("expenses").update({ status, rejection_reason: rejectionReason || null, ...auditPatch }).eq("id", id);
  if (error) throw error;
}

export async function addAdvance(payload: {
  employeeId: string;
  amount: number;
  paymentDate: string;
  paymentMode: string;
  proofUrls: string[];
  remarks?: string;
}) {
  const { error } = await supabase.from("advances").insert({
    employee_id: payload.employeeId,
    amount: payload.amount,
    payment_date: payload.paymentDate,
    payment_mode: payload.paymentMode,
    proof_urls: payload.proofUrls,
    remarks: payload.remarks || null,
  });
  if (error) throw error;
}

export async function getBillSignedUrl(path: string) {
  const { data, error } = await supabase.storage.from("expense-bills").createSignedUrl(path, 60 * 10);
  if (error) throw error;
  return data.signedUrl;
}

export async function getAdvanceProofSignedUrl(path: string) {
  const { data, error } = await supabase.storage.from("advance-proofs").createSignedUrl(path, 60 * 10);
  if (error) throw error;
  return data.signedUrl;
}
