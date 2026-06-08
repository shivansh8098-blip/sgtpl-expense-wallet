export type Role = "admin" | "employee";
export type ExpenseStatus = "pending" | "approved" | "rejected";
export type PaymentMode = "Bank Transfer" | "UPI" | "Cash" | "Cheque" | "Other";

export type Employee = {
  id: string;
  name: string;
  email: string;
  mobile: string | null;
  role: Role;
  active: boolean;
  created_at: string;
};

export type Expense = {
  id: string;
  employee_id: string;
  expense_category: string;
  other_expense_text: string | null;
  amount: number;
  expense_date: string;
  notes: string | null;
  photo_urls: string[];
  status: ExpenseStatus;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  rejection_reason: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  created_at: string;
  updated_at: string;
  employees?: Pick<Employee, "name" | "email">;
};

export type Advance = {
  id: string;
  employee_id: string;
  amount: number;
  payment_date: string;
  payment_mode: PaymentMode;
  proof_urls: string[];
  remarks: string | null;
  created_at: string;
  employees?: Pick<Employee, "name" | "email">;
};

export type Balance = {
  employee_id: string;
  name: string;
  email: string;
  mobile: string | null;
  total_advances: number;
  total_approved_expenses: number;
  available_balance: number;
};
