import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, AlertCircle, StopCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: "pending" | "running" | "completed" | "failed" | "stopped";
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = {
    pending: { label: "Initializing", icon: Loader2, color: "bg-blue-500/10 text-blue-400 border-blue-500/20", animate: true },
    running: { label: "Processing", icon: Loader2, color: "bg-green-500/10 text-green-400 border-green-500/20", animate: true },
    completed: { label: "Completed", icon: CheckCircle2, color: "bg-green-500/10 text-green-400 border-green-500/20", animate: false },
    failed: { label: "Failed", icon: XCircle, color: "bg-red-500/10 text-red-400 border-red-500/20", animate: false },
    stopped: { label: "Stopped", icon: StopCircle, color: "bg-orange-500/10 text-orange-400 border-orange-500/20", animate: false },
  };

  const { label, icon: Icon, color, animate } = config[status];

  return (
    <Badge variant="outline" className={cn("px-3 py-1.5 gap-2 text-sm font-medium capitalize", color)}>
      <Icon className={cn("w-4 h-4", animate && "animate-spin")} />
      {label}
    </Badge>
  );
}
