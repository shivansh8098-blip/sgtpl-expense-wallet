import { useEffect, useState } from "react";
import { WalletCards } from "lucide-react";
import { supabase } from "./lib/supabase";
import { getCurrentEmployee, signInWithGoogle } from "./lib/api";
import type { Employee } from "./lib/types";
import { AppShell } from "./components/AppShell";
import { Button } from "./components/ui/Button";
import { Card } from "./components/ui/Card";
import { EmployeeApp } from "./features/employee/EmployeeApp";
import { AdminApp } from "./features/admin/AdminApp";

export default function App() {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    async function load() {
      const { data } = await supabase.auth.getSession();
      setSignedIn(Boolean(data.session));
      if (data.session) setEmployee(await getCurrentEmployee());
      setLoading(false);
    }

    void load();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(Boolean(session));
      if (!session) setEmployee(null);
      if (session) void getCurrentEmployee().then(setEmployee);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  if (loading) {
    return <Centered message="Opening wallet..." />;
  }

  if (!signedIn) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="w-full max-w-sm space-y-5 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <WalletCards size={30} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">SGTPL Expense Wallet</h1>
            <p className="mt-2 text-sm text-muted-foreground">Sign in with your company Gmail account.</p>
          </div>
          <Button className="w-full" onClick={() => void signInWithGoogle()}>
            Continue with Google
          </Button>
        </Card>
      </div>
    );
  }

  if (!employee) {
  return <Centered message="LOGIN SUCCESSFUL BUT EMPLOYEE NOT FOUND" />
}

  return <AppShell employee={employee}>{employee.role === "admin" ? <AdminApp /> : <EmployeeApp employee={employee} />}</AppShell>;
}

function Centered({ message }: { message: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 text-center">
      <Card className="max-w-sm">
        <p className="font-semibold">{message}</p>
      </Card>
    </div>
  );
}
