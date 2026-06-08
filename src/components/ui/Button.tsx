import { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
};

export function Button({ className, variant = "primary", ...props }: Props) {
  return (
    <button
      className={cn(
        "inline-flex h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "bg-primary text-primary-foreground shadow-soft hover:bg-teal-800",
        variant === "secondary" && "border border-border bg-white text-foreground hover:bg-muted",
        variant === "danger" && "bg-danger text-white hover:bg-red-800",
        variant === "ghost" && "text-muted-foreground hover:bg-muted",
        className,
      )}
      {...props}
    />
  );
}
