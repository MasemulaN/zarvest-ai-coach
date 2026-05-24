import { Sidebar } from "./Sidebar";
import { UploadZone } from "./UploadZone";
import { useFinance } from "@/lib/finance/store";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { analysis } = useFinance();
  if (!analysis) return <UploadZone />;
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="md:ml-64">
        <div className="mx-auto max-w-7xl px-6 py-10 md:px-10">
          {children}
        </div>
      </main>
    </div>
  );
}
