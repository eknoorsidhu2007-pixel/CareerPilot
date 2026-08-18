import { NextRequest, NextResponse } from "next/server";
import {
  extractTextFromDocx,
  extractTextFromPdf,
  getDemoParsedResume,
  parseResumeText,
} from "@/lib/resume-parser";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = file.name.split(".").pop()?.toLowerCase();

    let text = "";

    if (ext === "pdf") {
      text = await extractTextFromPdf(buffer);
    } else if (ext === "docx") {
      text = await extractTextFromDocx(buffer);
    } else {
      return NextResponse.json(
        { error: "Unsupported file type. Use PDF or DOCX." },
        { status: 400 }
      );
    }

    if (!text.trim()) {
      return NextResponse.json(getDemoParsedResume());
    }

    const parsed = parseResumeText(text);

    if (!parsed.skills.length && !parsed.experience.length) {
      const demo = getDemoParsedResume();
      return NextResponse.json({
        ...demo,
        name: parsed.name || demo.name,
        email: parsed.email || demo.email,
        location: parsed.location || demo.location,
        github_url: parsed.github_url || demo.github_url,
      });
    }

    return NextResponse.json(parsed);
  } catch (error) {
    console.error("Resume parse error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to parse resume",
      },
      { status: 500 }
    );
  }
}
