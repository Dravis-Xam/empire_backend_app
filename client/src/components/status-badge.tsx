import { cn } from "@/lib/utils";

const styles = {
  pending: "bg-yellow-100 text-yellow-700 border-yellow-200",
  processing: "bg-blue-100 text-blue-700 border-blue-200",
  shipped: "bg-indigo-100 text-indigo-700 border-indigo-200",
  delivered: "bg-emerald-100 text-emerald-700 border-emerald-200",
  cancelled: "bg-red-100 text-red-700 border-red-200",
  out_for_delivery: "bg-purple-100 text-purple-700 border-purple-200",
};

export function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase().replace(/ /g, '_');
  const style = styles[normalized as keyof typeof styles] || "bg-gray-100 text-gray-700 border-gray-200";

  return (
    <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-semibold border uppercase tracking-wider", style)}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}
