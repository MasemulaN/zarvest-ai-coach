import { useRef, useState } from "react";
import { Upload, FileText, Sparkles } from "lucide-react";
import { parseCSV, SAMPLE_CSV } from "@/lib/finance/csv";
import { parsePDF } from "@/lib/finance/pdf";
import { useFinance } from "@/lib/finance/store";
import { toast } from "sonner";

export function UploadZone() {
  const { loadTransactions } = useFinance();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);

  async function readAsText(file: File): Promise<string> {
    // Try UTF-8 first, fall back to windows-1252 (common for SA bank CSV exports)
    const buf = await file.arrayBuffer();
    try {
      const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(buf);
      // Heuristic: if it contains replacement char clusters, try latin1
      if (/\uFFFD{2,}/.test(utf8)) throw new Error("bad utf8");
      return utf8;
    } catch {
      return new TextDecoder("windows-1252").decode(buf);
    }
  }

  async function handleFile(file: File) {
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      toast.error("File too large (max 15MB)");
      return;
    }
    const isPDF = /\.pdf$/i.test(file.name) || file.type === "application/pdf";
    const isCSV = /\.(csv|txt|tsv)$/i.test(file.name) || /csv|excel|text/.test(file.type);
    if (!isPDF && !isCSV) {
      toast.error("Unsupported file type. Upload a CSV, TSV or PDF bank statement.");
      return;
    }
    setLoading(true);
    try {
      const txns = isPDF ? await parsePDF(file) : parseCSV(await readAsText(file));
      if (txns.length === 0) {
        toast.error(
          isPDF
            ? "Couldn't extract transactions. Try a text-based PDF (not a scan) or your bank's CSV export."
            : "Couldn't read any transactions. Make sure the file has Date, Description and Amount columns.",
        );
        return;
      }
      toast.success(`Parsed ${txns.length} transactions across ${new Set(txns.map((t) => t.date.slice(0, 7))).size} month(s)`);
      loadTransactions(txns);
    } catch (e) {
      console.error("Upload parse error", e);
      toast.error(isPDF ? "Could not read this PDF. If it's a scanned image, export the CSV instead." : "Could not parse this CSV. Try a different export format.");
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
        Upload a CSV or PDF statement from FNB, ABSA, Nedbank, Capitec or Standard Bank. CashPilot categorises every transaction in ZAR,
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
        <p className="text-base font-medium">{loading ? "Reading your statement..." : "Drop your CSV or PDF here or click to browse"}</p>
        <p className="mt-1 text-xs text-muted-foreground">Processed locally in your browser. Nothing leaves until you ask the coach.</p>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv,.pdf,application/pdf"
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
