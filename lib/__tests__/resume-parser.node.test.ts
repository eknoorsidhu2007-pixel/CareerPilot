import { getDemoParsedResume, parseResumeText } from '@/lib/resume-parser';
import { extractSkillsFromText, skillsOverlap } from '@/lib/skills';

const RESUME = `Jane Smith
jane.smith@example.com | (416) 555-0142 | Toronto, ON
github.com/janesmith | linkedin.com/in/janesmith

SKILLS
React, TypeScript, PostgreSQL, Docker, Python

EXPERIENCE
Software Engineer Intern | Shopify
May 2024 - Aug 2024
• Built internal tooling with React and TypeScript
• Reduced dashboard load time by 40%

Backend Developer | Acme Corp
Jan 2023 - Apr 2023
• Designed PostgreSQL schemas and REST APIs

EDUCATION
University of Waterloo
Bachelor of Computer Science, 2021 - 2025
GPA: 3.8
`;

describe('parseResumeText - contact details', () => {
  const parsed = parseResumeText(RESUME);

  it('extracts the email address', () => {
    expect(parsed.email).toBe('jane.smith@example.com');
  });

  it('extracts the phone number', () => {
    expect(parsed.phone).toBe('(416) 555-0142');
  });

  it('derives the name from the email local part', () => {
    expect(parsed.name).toBe('Jane Smith');
  });

  it('extracts a city/province location', () => {
    expect(parsed.location).toBe('Toronto, ON');
  });

  it('normalises a bare GitHub URL to https', () => {
    expect(parsed.github_url).toBe('https://github.com/janesmith');
  });

  it('captures the LinkedIn URL', () => {
    // NOTE: LinkedIn is stored in portfolio_url - the schema has no
    // dedicated linkedin_url field.
    expect(parsed.portfolio_url).toContain('linkedin.com/in/janesmith');
  });
});

describe('parseResumeText - skills', () => {
  const parsed = parseResumeText(RESUME);

  it('extracts the skills listed in the resume', () => {
    for (const skill of ['React', 'TypeScript', 'PostgreSQL', 'Docker', 'Python']) {
      expect(parsed.skills).toContain(skill);
    }
  });

  it('caps the skill list at 30 entries', () => {
    expect(parsed.skills.length).toBeLessThanOrEqual(30);
  });

  it.failing('does not report single-letter skills that appear inside other words', () => {
    // BUG: extractSkillsFromText falls back to a bare `lower.includes(skill)`
    // check, so "C" and "R" match any text containing those letters.
    expect(parsed.skills).not.toContain('C');
    expect(parsed.skills).not.toContain('R');
  });

  it.failing('does not report skills that are substrings of unrelated words', () => {
    // BUG: "Gin" matches because "engineer" contains "gin".
    expect(parsed.skills).not.toContain('Gin');
  });
});

describe('parseResumeText - experience', () => {
  const parsed = parseResumeText(RESUME);

  it('extracts one entry per role', () => {
    expect(parsed.experience).toHaveLength(2);
  });

  it('splits title and company on the pipe delimiter', () => {
    expect(parsed.experience[0].title).toBe('Software Engineer Intern');
    expect(parsed.experience[0].company).toBe('Shopify');
    expect(parsed.experience[1].title).toBe('Backend Developer');
    expect(parsed.experience[1].company).toBe('Acme Corp');
  });

  it('tags internship roles as SWE', () => {
    expect(parsed.experience[0].tag).toBe('SWE');
  });

  it('caps experience at six entries', () => {
    expect(parsed.experience.length).toBeLessThanOrEqual(6);
  });

  it.failing('captures start and end dates when they sit on their own line', () => {
    // BUG: a standalone date line is treated as a new role. cleanTitle strips
    // the date, leaving an empty title, so the entry is silently discarded and
    // the dates never reach the preceding role.
    expect(parsed.experience[0].start_date).toBe('May 2024');
    expect(parsed.experience[0].end_date).toBe('Aug 2024');
  });

  it.failing('captures bullet-point descriptions', () => {
    // BUG: same root cause - the phantom date entry resets descLines, so
    // bullets belonging to the previous role are dropped.
    expect(parsed.experience[0].description).toContain('internal tooling');
  });
});

describe('parseResumeText - education', () => {
  const parsed = parseResumeText(RESUME);

  it('identifies the school', () => {
    expect(parsed.education.map((e) => e.school)).toContain('University of Waterloo');
  });

  it('extracts the degree and field of study', () => {
    const degrees = parsed.education.map((e) => e.degree);
    const fields = parsed.education.map((e) => e.field);
    expect(degrees).toContain('Bachelor');
    expect(fields).toContain('Computer Science');
  });

  it('extracts the GPA', () => {
    expect(parsed.education[0].gpa).toBe('3.8');
  });

  it('caps education at five entries', () => {
    expect(parsed.education.length).toBeLessThanOrEqual(5);
  });

  it.failing('produces one entry per school rather than one per line', () => {
    // BUG: every line inside the EDUCATION section becomes its own entry, so
    // "Bachelor of Computer Science" and "GPA: 3.8" are recorded as schools.
    expect(parsed.education).toHaveLength(1);
  });

  it.failing('parses the graduation years as numbers', () => {
    // BUG: YEAR_RANGE_RE carries the /g flag, so String.match returns whole
    // matches rather than capture groups and parseInt receives undefined.
    const waterloo = parsed.education.find((e) => e.school.includes('Waterloo'));
    expect(waterloo?.start_year).toBe(2021);
    expect(waterloo?.end_year).toBe(2025);
  });

  it.failing('never records a numeric year as NaN', () => {
    for (const entry of parsed.education) {
      expect(Number.isNaN(entry.start_year)).toBe(false);
      expect(Number.isNaN(entry.end_year)).toBe(false);
    }
  });
});

describe('parseResumeText - degenerate input', () => {
  it('returns an empty structure for empty input without throwing', () => {
    const parsed = parseResumeText('');

    expect(parsed.name).toBe('');
    expect(parsed.email).toBe('');
    expect(parsed.skills).toEqual([]);
    expect(parsed.experience).toEqual([]);
    expect(parsed.education).toEqual([]);
  });

  it('handles whitespace-only input', () => {
    expect(() => parseResumeText('   \n\n  \r\n ')).not.toThrow();
  });

  it('handles text with no recognisable resume structure', () => {
    const parsed = parseResumeText('the quick brown fox jumps over the lazy dog');

    expect(parsed.email).toBe('');
    expect(Array.isArray(parsed.skills)).toBe(true);
  });
});

describe('getDemoParsedResume', () => {
  it('returns a fully populated ParsedResume shape', () => {
    const demo = getDemoParsedResume();

    expect(demo.name).toBeTruthy();
    expect(demo.email).toBeTruthy();
    expect(demo.skills.length).toBeGreaterThan(0);
    expect(demo.experience.length).toBeGreaterThan(0);
    expect(demo.education.length).toBeGreaterThan(0);
  });
});

describe('extractSkillsFromText', () => {
  it('finds multi-word skills', () => {
    expect(extractSkillsFromText('Experience with Machine Learning')).toContain(
      'Machine Learning',
    );
  });

  it('is case-insensitive', () => {
    expect(extractSkillsFromText('built with react and typescript')).toEqual(
      expect.arrayContaining(['React', 'TypeScript']),
    );
  });

  it('returns an empty-safe array for empty input', () => {
    expect(Array.isArray(extractSkillsFromText(''))).toBe(true);
  });
});

describe('skillsOverlap', () => {
  it('partitions job skills into matching and missing', () => {
    const { matching, missing } = skillsOverlap(
      ['React', 'TypeScript'],
      ['React', 'Kubernetes'],
    );

    expect(matching).toEqual(['React']);
    expect(missing).toEqual(['Kubernetes']);
  });

  it('treats everything as missing when the user has no skills', () => {
    const { matching, missing } = skillsOverlap([], ['React', 'Go']);

    expect(matching).toEqual([]);
    expect(missing).toEqual(['React', 'Go']);
  });
});
