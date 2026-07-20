import { Sidebar } from "@/components/layout/sidebar";
import { ChatWidget } from "@/components/chat/chat-widget";
import { MonthProvider } from "@/lib/hooks/use-month";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <MonthProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <div className="flex-1 min-w-0 flex flex-col">{children}</div>
        <ChatWidget />
      </div>
    </MonthProvider>
  );
}
