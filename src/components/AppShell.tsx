import { LogOut, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./ui/Button";
import { Employee } from "../lib/types";
import { signOut } from "../lib/api";

export function AppShell({ employee, children }: { employee: Employee; children: ReactNode }) {
  return (
    <div className="mx-auto min-h-screen max-w-6xl bg-background">
      <header className="sticky top-0 z-10 border-b border-border bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase text-primary">SGTPL</p>
            <h1 className="text-lg font-bold">Expense Wallet</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm sm:flex">
              <UserRound size={16} />
              {employee.name}
            </div>
            <Button aria-label="Sign out" variant="ghost" onClick={() => void signOut()}>
              <LogOut size={18} />
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-4 sm:py-6">{children}</main>
    </div>
  );
}
