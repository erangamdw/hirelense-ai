import { Skeleton } from "@/components/ui/skeleton";

export function LoadingGrid() {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Skeleton className="h-40 rounded-[28px]" />
      <Skeleton className="h-40 rounded-[28px]" />
      <Skeleton className="h-40 rounded-[28px]" />
    </div>
  );
}
