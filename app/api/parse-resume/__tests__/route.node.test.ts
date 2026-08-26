import { NextRequest } from 'next/server';

jest.mock('@/lib/resume-parser', () => {
  const actual = jest.requireActual('@/lib/resume-parser');
  return {
    ...actual,
    extractTextFromPdf: jest.fn(),
    extractTextFromDocx: jest.fn(),
  };
});

import { POST } from '../route';
import { extractTextFromDocx, extractTextFromPdf } from '@/lib/resume-parser';
import { MAX_RESUME_BYTES } from '@/lib/schemas';

const mockPdf = extractTextFromPdf as jest.Mock;
const mockDocx = extractTextFromDocx as jest.Mock;

const GOOD_RESUME_TEXT = `Jane Smith
jane.smith@example.com | (416) 555-0142 | Toronto, ON
github.com/janesmith

SKILLS
React, TypeScript, PostgreSQL

EXPERIENCE
Software Engineer Intern | Shopify
May 2024 - Aug 2024

EDUCATION
University of Waterloo
Bachelor of Computer Science, 2021 - 2025
GPA: 3.8
`;

function makeRequest(
  file: File | null,
  { query = '' }: { query?: string } = {},
) {
  const form = new FormData();
  if (file) form.append('file', file);

  return new NextRequest(`http://localhost:3000/api/parse-resume${query}`, {
    method: 'POST',
    body: file ? form : new FormData(),
  });
}

function makeFile(name: string, contents = 'x'.repeat(200)) {
  return new File([contents], name, { type: 'application/octet-stream' });
}

let errorSpy: jest.SpyInstance;

beforeAll(() => {
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterAll(() => {
  errorSpy.mockRestore();
});

beforeEach(() => {
  jest.clearAllMocks();
  mockPdf.mockResolvedValue(GOOD_RESUME_TEXT);
  mockDocx.mockResolvedValue(GOOD_RESUME_TEXT);
});

describe('POST /api/parse-resume - file gating', () => {
  it('returns 400 when no file is attached', async () => {
    const res = await POST(makeRequest(null));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toHaveProperty('error');
    expect(mockPdf).not.toHaveBeenCalled();
  });

  it('returns 400 for a zero-byte file', async () => {
    const res = await POST(makeRequest(new File([], 'resume.pdf')));

    expect(res.status).toBe(400);
    expect(mockPdf).not.toHaveBeenCalled();
  });

  it('returns 413 for a file over the size limit', async () => {
    const oversized = new File(['x'.repeat(MAX_RESUME_BYTES + 1)], 'resume.pdf');
    const res = await POST(makeRequest(oversized));

    expect(res.status).toBe(413);
    expect(mockPdf).not.toHaveBeenCalled();
  });

  it('returns 415 for an unsupported extension', async () => {
    const res = await POST(makeRequest(makeFile('resume.txt')));

    expect(res.status).toBe(415);
    expect(mockPdf).not.toHaveBeenCalled();
  });

  it('returns 415 for a file with no extension', async () => {
    expect((await POST(makeRequest(makeFile('resume')))).status).toBe(415);
  });

  it('accepts a .docx and routes it to the docx extractor', async () => {
    const res = await POST(makeRequest(makeFile('resume.docx')));

    expect(res.status).toBe(200);
    expect(mockDocx).toHaveBeenCalled();
    expect(mockPdf).not.toHaveBeenCalled();
  });

  it('matches the extension case-insensitively', async () => {
    expect((await POST(makeRequest(makeFile('RESUME.PDF')))).status).toBe(200);
  });
});

describe('POST /api/parse-resume - extraction failures', () => {
  it('returns 422 when the extractor throws', async () => {
    mockPdf.mockRejectedValue(new Error('corrupt pdf'));

    const res = await POST(makeRequest(makeFile('resume.pdf')));

    expect(res.status).toBe(422);
    await expect(res.json()).resolves.toHaveProperty('error');
  });

  it('returns 422 when the document yields no readable text', async () => {
    mockPdf.mockResolvedValue('   \n  ');

    expect((await POST(makeRequest(makeFile('resume.pdf')))).status).toBe(422);
  });

  it('returns 422 for text too short to be a resume', async () => {
    mockPdf.mockResolvedValue('Jane');

    expect((await POST(makeRequest(makeFile('resume.pdf')))).status).toBe(422);
  });

  it('does not leak the underlying extractor error to the client', async () => {
    mockPdf.mockRejectedValue(new Error('ENOENT /var/secret/path'));

    const { error } = await (await POST(makeRequest(makeFile('resume.pdf')))).json();

    expect(error).not.toContain('ENOENT');
    expect(error).not.toContain('/var/secret');
  });
});

describe('POST /api/parse-resume - no silent demo fallback', () => {
  it('returns 422 rather than fabricated demo data when nothing parses', async () => {
    // Deliberately avoids the letters "c" and "r": extractSkillsFromText
    // matches the single-letter skills "C" and "R" against any text
    // containing them (see the known-bug tests in resume-parser.node.test.ts),
    // which would otherwise smuggle phantom skills past the content gate.
    mockPdf.mockResolvedValue('this file has no useful data. it may be just plain empty text.');

    const res = await POST(makeRequest(makeFile('resume.pdf')));
    const body = await res.json();

    expect(res.status).toBe(422);
    // The old behaviour returned getDemoParsedResume() here.
    expect(body).not.toHaveProperty('skills');
    expect(JSON.stringify(body)).not.toContain('Alex Chen');
  });

  it.failing('rejects arbitrary prose that contains no real skills', async () => {
    // BUG: the "C"/"R" substring match means ordinary prose yields a non-empty
    // skills array, so the content gate lets it through with a 200.
    mockPdf.mockResolvedValue(
      'the quick brown fox jumps over the lazy dog and keeps on running for a while',
    );

    expect((await POST(makeRequest(makeFile('resume.pdf')))).status).toBe(422);
  });

  it('serves demo data only when explicitly requested', async () => {
    const res = await POST(makeRequest(null, { query: '?demo=1' }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.name).toBe('Alex Chen');
    expect(mockPdf).not.toHaveBeenCalled();
  });
});

describe('POST /api/parse-resume - success', () => {
  it('returns a validated ParsedResume', async () => {
    const res = await POST(makeRequest(makeFile('resume.pdf')));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.email).toBe('jane.smith@example.com');
    expect(body.skills).toEqual(expect.arrayContaining(['React', 'TypeScript']));
    expect(body.experience[0].title).toBe('Software Engineer Intern');
  });

  it('returns exactly the ParsedResume keys and nothing else', async () => {
    const body = await (await POST(makeRequest(makeFile('resume.pdf')))).json();

    expect(Object.keys(body).sort()).toEqual(
      [
        'education',
        'email',
        'experience',
        'github_url',
        'location',
        'name',
        'phone',
        'portfolio_url',
        'skills',
        'work_authorization',
      ].sort(),
    );
  });

  it('returns normalized years as numbers, never NaN', async () => {
    const body = await (await POST(makeRequest(makeFile('resume.pdf')))).json();

    for (const entry of body.education) {
      expect(typeof entry.start_year).toBe('number');
      expect(Number.isNaN(entry.start_year)).toBe(false);
    }
  });
});
