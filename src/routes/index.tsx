import { createFileRoute } from "@tanstack/react-router";
import { useFinance } from "@/lib/finance/store";
import { UploadZone } from "@/components/app/UploadZone";
import { Dashboard } from "@/components/app/Dashboard";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CashPilot AI — Your AI Financial Coach (ZAR)" },
      { name: "description", content: "Upload a South African bank CSV. CashPilot AI categorises spending in Rand, spots money leaks, forecasts next month, and coaches you on the next move." },
      { property: "og:title", content: "CashPilot AI — Your AI Financial Coach" },
      { property: "og:description", content: "AI financial coaching for South African spenders. Upload, analyze, get advice." },
    ],
  }),
  component: Index,
});

function Index() {
  const { analysis } = useFinance();
  return analysis ? <Dashboard /> : <UploadZone />;
}
