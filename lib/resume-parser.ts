import type { EducationItem, ExperienceItem, ParsedResume } from "@/types";
import { extractSkillsFromText } from "./skills";

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const PHONE_RE =
  /(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/;
const GITHUB_RE = /(?:https?:\/\/)?(?:www\.)?github\.com\/[a-zA-Z0-9_-]+/i;
const LINKEDIN_RE = /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+/i;
const GPA_RE = /GPA[:\s]*([0-9]\.[0-9]{1,2})/i;

const DATE_RANGE_RE =
  /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}|\d{1,2}\/\d{4}|\d{4})\s*[-–—to]+\s*((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}|\d{1,2}\/\d{4}|\d{4}|Present|Current)/gi;

const YEAR_RANGE_RE = /(\d{4})\s*[-–—]\s*(\d{4}|Present|Current)/gi;

const DEGREE_KEYWORDS = [
  "Bachelor", "Master", "PhD", "Ph.D", "B.S", "B.A", "M.S", "M.A",
  "B.Eng", "B.CS", "B.Sc", "M.Sc", "MBA", "Associate", "Diploma",
  "Certificate", "Bachelor of", "Master of",
];

const UNIVERSITY_KEYWORDS = [
  "University", "College", "Institute", "School", "Academy", "Polytechnic",
  "Coursera", "Udacity", "edX", "Bootcamp",
];

const TITLE_KEYWORDS = [
  "Intern", "Engineer", "Developer", "Analyst", "Scientist", "Designer",
  "Manager", "Lead", "Architect", "Consultant", "Associate", "Fellow",
  "Co-op", "Contractor", "Specialist", "Programmer", "Administrator",
];

const SECTION_HEADERS = {
  experience: /^(experience|work experience|employment|professional experience|work history)/i,
  education: /^(education|academic|qualifications)/i,
  skills: /^(skills|technical skills|core competencies|technologies)/i,
};

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

export async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

export function parseResumeText(text: string): ParsedResume {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const fullText = text.replace(/\s+/g, " ");

  const email = fullText.match(EMAIL_RE)?.[0] || "";
  const phone = fullText.match(PHONE_RE)?.[0] || "";
  const githubMatch = fullText.match(GITHUB_RE)?.[0];
  const github_url = githubMatch
    ? githubMatch.startsWith("http")
      ? githubMatch
      : `https://${githubMatch}`
    : "";

  const name = inferName(lines, email);
  const location = inferLocation(lines, fullText);
  const skills = extractSkillsFromText(fullText);
  const experience = extractExperience(lines, fullText);
  const education = extractEducation(lines, fullText);

  return {
    name,
    email,
    phone,
    location,
    skills,
    experience,
    education,
    github_url,
    portfolio_url: fullText.match(LINKEDIN_RE)?.[0] || "",
    work_authorization: inferWorkAuth(fullText),
  };
}

function inferName(lines: string[], email: string): string {
  if (email) {
    const local = email.split("@")[0];
    const parts = local.split(/[._-]/);
    if (parts.length >= 2) {
      return parts
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
        .join(" ");
    }
  }
  const first = lines[0] || "";
  if (first.length < 50 && !EMAIL_RE.test(first) && !PHONE_RE.test(first)) {
    return first;
  }
  return "";
}

function inferLocation(lines: string[], fullText: string): string {
  const cityStateRe =
    /([A-Z][a-z]+(?:\s[A-Z][a-z]+)?),\s*([A-Z]{2}|[A-Za-z]+)/;
  const match = fullText.match(cityStateRe);
  if (match) return match[0];

  for (const line of lines.slice(0, 8)) {
    if (cityStateRe.test(line) && line.length < 60) return line;
  }
  return "";
}

function inferWorkAuth(text: string): string {
  const patterns = [
    /eligible to work[^.]{0,40}/i,
    /authorized to work[^.]{0,40}/i,
    /work authorization[:\s]+[^.]{0,40}/i,
    /citizen|permanent resident|green card/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[0].trim();
  }
  return "";
}

function extractExperience(
  lines: string[],
  fullText: string
): ExperienceItem[] {
  const experiences: ExperienceItem[] = [];
  let inSection = false;
  let current: Partial<ExperienceItem> | null = null;
  const descLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (SECTION_HEADERS.education.test(line)) {
      if (current?.title) flushExperience(experiences, current, descLines);
      break;
    }
    if (SECTION_HEADERS.skills.test(line) && !inSection) continue;

    if (SECTION_HEADERS.experience.test(line)) {
      inSection = true;
      continue;
    }

    if (!inSection && i > 15) continue;

    const dateMatch = line.match(
      /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}|\d{4})\s*[-–—]\s*((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}|\d{4}|Present|Current)/i
    );

    const hasTitle = TITLE_KEYWORDS.some((k) =>
      line.toLowerCase().includes(k.toLowerCase())
    );

    if (dateMatch || (hasTitle && line.length < 80)) {
      if (current?.title) flushExperience(experiences, current, descLines);

      const dates = dateMatch
        ? { start: dateMatch[1], end: dateMatch[2] }
        : { start: "", end: "" };

      const parts = line
        .replace(dateMatch?.[0] || "", "")
        .split(/[|@·•]/)
        .map((p) => p.trim())
        .filter(Boolean);

      const title = parts[0] || line;
      let company = parts[1] || "";

      if (!company && lines[i + 1] && !DATE_RANGE_RE.test(lines[i + 1])) {
        company = lines[i + 1];
        i++;
      }

      current = {
        title: cleanTitle(title),
        company: company || "Company",
        start_date: dates.start,
        end_date: dates.end,
        description: "",
      };
      descLines.length = 0;
    } else if (current && (line.startsWith("•") || line.startsWith("-") || line.startsWith("·"))) {
      descLines.push(line.replace(/^[•\-·]\s*/, ""));
    } else if (current && descLines.length < 4 && line.length > 20) {
      descLines.push(line);
    }
  }

  if (current?.title) flushExperience(experiences, current, descLines);

  if (experiences.length === 0) {
    return extractExperienceFromRegex(fullText);
  }

  return experiences.slice(0, 6);
}

function flushExperience(
  list: ExperienceItem[],
  current: Partial<ExperienceItem>,
  descLines: string[]
) {
  list.push({
    title: current.title || "",
    company: current.company || "",
    start_date: current.start_date || "",
    end_date: current.end_date || "",
    description: descLines.join(" ").slice(0, 400),
    tag: inferExpTag(current.title || ""),
  });
  descLines.length = 0;
}

function inferExpTag(title: string): string | undefined {
  const t = title.toLowerCase();
  if (t.includes("intern") || t.includes("co-op")) return "SWE";
  if (t.includes("contract")) return "Contract";
  return undefined;
}

function cleanTitle(s: string): string {
  return s.replace(DATE_RANGE_RE, "").trim();
}

function extractExperienceFromRegex(text: string): ExperienceItem[] {
  const items: ExperienceItem[] = [];
  const blocks = text.split(
    /(?=(?:Software|Frontend|Backend|Full[- ]?Stack|Data|ML|Machine Learning|Junior|Senior)\s+\w+)/i
  );

  for (const block of blocks.slice(0, 4)) {
    const dateMatch = block.match(DATE_RANGE_RE);
    const titleMatch = block.match(
      /((?:Software|Frontend|Backend|Full[- ]?Stack|Data|ML|Machine Learning|Junior|Senior|Web|Mobile)\s+(?:Engineer|Developer|Intern|Analyst|Scientist)[\w\s]*)/i
    );
    if (titleMatch) {
      items.push({
        title: titleMatch[1].trim(),
        company: "Company",
        start_date: dateMatch?.[1] || "",
        end_date: dateMatch?.[2] || "",
        description: block.slice(0, 300).trim(),
      });
    }
  }
  return items;
}

function extractEducation(lines: string[], fullText: string): EducationItem[] {
  const education: EducationItem[] = [];
  let inSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (SECTION_HEADERS.education.test(line)) {
      inSection = true;
      continue;
    }
    if (inSection && SECTION_HEADERS.experience.test(line)) break;

    const isEdu =
      UNIVERSITY_KEYWORDS.some((k) => line.includes(k)) ||
      DEGREE_KEYWORDS.some((k) => line.includes(k));

    if (isEdu || (inSection && line.length > 5)) {
      const gpaMatch = line.match(GPA_RE) || fullText.match(GPA_RE);
      const yearMatch = line.match(YEAR_RANGE_RE);

      const degree = DEGREE_KEYWORDS.find((k) => line.includes(k)) || "";
      const isCert =
        line.toLowerCase().includes("certificate") ||
        line.toLowerCase().includes("coursera");

      education.push({
        school: line.split(/[|,·]/)[0].trim(),
        degree: degree || (isCert ? "Certificate" : ""),
        field: inferField(line),
        start_year: yearMatch ? parseInt(yearMatch[1]) : 0,
        end_year: yearMatch
          ? yearMatch[2] === "Present"
            ? new Date().getFullYear()
            : parseInt(yearMatch[2])
          : 0,
        gpa: gpaMatch?.[1] || "",
        type: isCert ? "certificate" : "degree",
      });
    }
  }

  return education.slice(0, 5);
}

function inferField(line: string): string {
  const fields = [
    "Computer Science", "Software Engineering", "Electrical Engineering",
    "Data Science", "Information Technology", "Mathematics", "Physics",
    "Business", "Economics", "Mechanical Engineering",
  ];
  return fields.find((f) => line.includes(f)) || "";
}

export function getDemoParsedResume(): ParsedResume {
  return {
    name: "Alex Chen",
    email: "alex.chen@email.com",
    phone: "",
    location: "Waterloo, ON",
    skills: [
      "Python", "React", "TypeScript", "Node.js", "Machine Learning",
      "PostgreSQL", "Git",
    ],
    experience: [
      {
        title: "Software Engineering Intern",
        company: "Shopify",
        start_date: "May 2024",
        end_date: "Aug 2024",
        description:
          "Built internal tooling with React and Ruby. Improved dashboard load time by 40%.",
        tag: "SWE",
      },
      {
        title: "Junior Developer",
        company: "Startup (Contract)",
        start_date: "Jan 2024",
        end_date: "Apr 2024",
        description:
          "Developed full-stack features using Next.js and PostgreSQL.",
        tag: "Contract",
      },
    ],
    education: [
      {
        school: "University of Waterloo",
        degree: "B.CS",
        field: "Computer Science",
        start_year: 2022,
        end_year: 2026,
        gpa: "3.8",
      },
    ],
    github_url: "https://github.com/alexchen",
    portfolio_url: "",
    work_authorization: "Eligible to work in Canada",
  };
}
