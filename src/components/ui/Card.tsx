import { HTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export function Card(props: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cn("rounded-lg border border-border bg-card p-4 shadow-soft", props.className)} />;
}
