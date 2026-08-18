"use client";

import { useCallback, useState } from "react";
import { FileText, Loader2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

interface ResumeUploadProps {
  onParsed: (data: unknown) => void;
  className?: string;
}

export function ResumeUpload({ onParsed, className }: ResumeUploadProps) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      const ext = file.name.split(".").pop()?.toLowerCase();
      if (!["pdf", "docx"].includes(ext || "")) {
        setError("Please upload a PDF or DOCX file.");
        return;
      }

      setLoading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/parse-resume", {
          method: "POST",
          body: formData,
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to parse resume");
        }

        const data = await res.json();
        onParsed(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setLoading(false);
      }
    },
    [onParsed]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <div className={cn("w-full max-w-2xl", className)}>
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center rounded-xl border border-border bg-card px-8 py-14 transition-colors",
          dragging && "border-blue bg-blue/5",
          loading && "pointer-events-none opacity-70"
        )}
      >
        <input
          type="file"
          accept=".pdf,.docx"
          className="hidden"
          disabled={loading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
        {loading ? (
          <Loader2 className="h-10 w-10 animate-spin text-blue" />
        ) : (
          <FileText className="h-10 w-10 text-muted" strokeWidth={1.5} />
        )}
        <p className="mt-4 text-lg font-semibold text-text">
          Upload your resume to get started
        </p>
        <p className="mt-2 text-sm text-muted">
          <span className="text-blue">Browse files</span> or drag and drop here
        </p>
        <div className="mt-4 flex gap-2">
          {["PDF", "DOCX"].map((fmt) => (
            <span
              key={fmt}
              className="rounded-md bg-bg3 px-2 py-0.5 font-mono text-xs text-muted"
            >
              {fmt}
            </span>
          ))}
        </div>
        {!loading && (
          <div className="mt-6 flex items-center gap-2 text-xs text-muted">
            <Upload className="h-3.5 w-3.5" />
            Drop file anywhere in this zone
          </div>
        )}
      </label>
      {error && (
        <p className="mt-3 text-center text-sm text-red">{error}</p>
      )}
    </div>
  );
}
