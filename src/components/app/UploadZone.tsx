import { useRef, useState } from "react";
import { Upload, FileText, Sparkles } from "lucide-react";
import { parseCSV, SAMPLE_CSV } from "@/lib/finance/csv";
import { useFinance } from "@/lib/finance/store";
import { toast } from "sonner";

export function UploadZone() {
  const { loadTransactions } = useFinance();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleFile(file: File) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File too large (max 10MB)");
      return;
    }
    setLoading(true);
    try {
      const text = await file.text();
      const txns = parseCSV(text);
      if (txns.length === 0) {
        toast.error("Couldn't read any transactions. Expecting columns like Date, Description, Amount.");
        return;
      }
      toast.success(`Parsed ${txns.length} transactions`);
      loadTransactions(txns);
    } catch (e) {
      toast.error("Could not parse the CSV file");
    } finally {
      setLoading(false);
    }
  }

  function trySample() {
    const txns = parseCSV(SAMPLE_CSV);
    toast.success(`Loaded ${txns.length} sample transactions`);
    loadTransactions(txns);
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6 py-12">
      <div className="mb-3 flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-emerald-ai">
        <Sparkles className="size-3.5" />
        Your AI financial co-pilot
      </div>
      <h1 className="text-balance text-center text-4xl font-bold tracking-tight md:text-5xl">
        Drop a bank statement.<br />
        <span className="text-emerald-ai">Get a coach.</span>
      </h1>
      <p className="mt-4 max-w-lg text-pretty text-center text-muted-foreground">
        Upload a CSV from FNB, ABSA, Nedbank, Capitec or Standard Bank. CashPilot categorises every transaction in ZAR,
        spots money leaks, and tells you what to do next.
      </p>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) handleFile(f);
        }}
        onClick={() => inputRef.current?.click()}
        className={`mt-10 flex w-full cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed bg-surface p-12 transition-all ${
          dragOver ? "border-emerald-ai bg-emerald-ai/5" : "border-border hover:border-emerald-ai/40"
        }`}
      >
        <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-background ring-1 ring-border">
          {loading ? <FileText className="size-6 animate-pulse text-emerald-ai" /> : <Upload className="size-6 text-muted-foreground" />}
        </div>
        <p className="text-base font-medium">{loading ? "Reading your statement..." : "Drop your CSV here or click to browse"}</p>
        <p className="mt-1 text-xs text-muted-foreground">Processed locally in your browser. Nothing leaves until you ask the coach.</p>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
      </div>

      <button
        onClick={trySample}
        className="mt-6 text-xs font-medium text-emerald-ai underline-offset-4 hover:underline"
      >
        Try with sample South African statement →
      </button>

      <div className="mt-16 grid w-full grid-cols-3 gap-4 text-center">
        {[
          { n: "01", t: "Upload", d: "Drop your CSV" },
          { n: "02", t: "Analyze", d: "Auto-categorised in ZAR" },
          { n: "03", t: "Insights", d: "Coach gives you the next move" },
        ].map((s) => (
          <div key={s.n} className="rounded-2xl border border-border bg-surface p-5">
            <p className="font-mono text-[10px] uppercase tracking-widest text-emerald-ai">{s.n}</p>
            <p className="mt-2 font-medium">{s.t}</p>
            <p className="text-xs text-muted-foreground">{s.d}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
