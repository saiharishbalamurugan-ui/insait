import { cn } from "@/lib/utils";

export function PageContent({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("px-[30px] pt-[26px] pb-[60px] max-w-[1360px] w-full mx-auto", className)}>{children}</div>
  );
}
