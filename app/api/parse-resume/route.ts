import { NextRequest, NextResponse } from "next/server";
import {
  extractTextFromDocx,
  extractTextFromPdf,
  getDemoParsedResume,
  parseResumeText,
} from "@/lib/resume-parser";
import {
  ALLOWED_RESUME_EXTENSIONS,
  MAX_RESUME_BYTES,
  MIN_EXTRACTED_TEXT_LENGTH,
  ParsedResumeSchema,
  formatIssues,
  normalizeParsedResume,
  type ResumeExtension,
} from "@/lib/schemas";

export const runtime = "nodejs";
export const maxDuration = 60;

function fail(error: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ error, ...extra }, { status });
}

export async function POST(req: NextRequest) {
  // Demo data is opt-in only. It is never used as a fallback for a document
  // that failed to parse - that would hand the user a fabricated resume.
  if (req.nextUrl.searchParams.get("demo") === "1") {
    return NextResponse.json(getDemoParsedResume());
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return fail("Malformed upload. Send the file as multipart/form-data.", 400);
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return fail("No file provided.", 400);
  }

  if (file.size === 0) {
    return fail("That file is empty.", 400);
  }

  if (file.size > MAX_RESUME_BYTES) {
    return fail(
      `That file is too large. The limit is ${Math.floor(
        MAX_RESUME_BYTES / (1024 * 1024)
      )} MB.`,
      413
    );
  }

  const ext = file.name.split(".").pop()?.toLowerCase();
  if (!ext || !ALLOWED_RESUME_EXTENSIONS.includes(ext as ResumeExtension)) {
    return fail("Unsupported file type. Use PDF or DOCX.", 415);
  }

  // --- Extraction ---------------------------------------------------------
  let text: string;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    text =
      ext === "pdf"
        ? await extractTextFromPdf(buffer)
        : await extractTextFromDocx(buffer);
  } catch (error) {
    console.error("Resume extraction error:", error);
    return fail(
      "Could not read that file. It may be corrupt, password-protected, or a scanned image.",
      422
    );
  }

  if (text.trim().length < MIN_EXTRACTED_TEXT_LENGTH) {
    return fail(
      "No readable text found. If this is a scanned resume, upload a text-based PDF or DOCX instead.",
      422
    );
  }

  // --- Parse + normalize + validate ---------------------------------------
  let normalized: unknown;
  try {
    normalized = normalizeParsedResume(parseResumeText(text));
  } catch (error) {
    console.error("Resume parse error:", error);
    return fail("Could not parse that resume.", 422);
  }

  const result = ParsedResumeSchema.safeParse(normalized);
  if (!result.success) {
    console.error("Resume validation failed:", formatIssues(result.error));
    return fail("That resume could not be validated.", 422, {
      issues: formatIssues(result.error),
    });
  }

  // Structurally valid but empty of substance - reject rather than return a
  // hollow profile the user then has to fill in by hand without being told.
  if (!result.data.skills.length && !result.data.experience.length) {
    return fail(
      "No skills or work experience found in that resume. Check the file, or fill in your profile manually.",
      422
    );
  }

  return NextResponse.json(result.data);
}
