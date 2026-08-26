import {
  ALLOWED_RESUME_EXTENSIONS,
  MAX_RESUME_BYTES,
  ParsedResumeSchema,
  ProfileUpsertSchema,
  formatIssues,
  normalizeParsedResume,
} from '@/lib/schemas';
import { parseResumeText } from '@/lib/resume-parser';

const VALID_RESUME = {
  name: 'Jane Smith',
  email: 'jane.smith@example.com',
  phone: '(416) 555-0142',
  location: 'Toronto, ON',
  skills: ['React', 'TypeScript'],
  experience: [
    {
      title: 'Software Engineer Intern',
      company: 'Shopify',
      start_date: 'May 2024',
      end_date: 'Aug 2024',
      description: 'Built internal tooling.',
      tag: 'SWE',
    },
  ],
  education: [
    {
      school: 'University of Waterloo',
      degree: 'Bachelor',
      field: 'Computer Science',
      start_year: 2021,
      end_year: 2025,
      gpa: '3.8',
      type: 'degree' as const,
    },
  ],
  github_url: 'https://github.com/janesmith',
  portfolio_url: 'linkedin.com/in/janesmith',
  work_authorization: '',
};

describe('upload constraints', () => {
  it('caps uploads at 5 MB', () => {
    expect(MAX_RESUME_BYTES).toBe(5 * 1024 * 1024);
  });

  it('accepts only pdf and docx', () => {
    expect([...ALLOWED_RESUME_EXTENSIONS]).toEqual(['pdf', 'docx']);
  });
});

describe('ParsedResumeSchema', () => {
  it('accepts a well-formed resume', () => {
    expect(ParsedResumeSchema.safeParse(VALID_RESUME).success).toBe(true);
  });

  it('accepts empty strings for optional contact fields', () => {
    const result = ParsedResumeSchema.safeParse({
      ...VALID_RESUME,
      email: '',
      github_url: '',
      phone: '',
    });

    expect(result.success).toBe(true);
  });

  it('rejects a malformed email address', () => {
    const result = ParsedResumeSchema.safeParse({ ...VALID_RESUME, email: 'not-an-email' });

    expect(result.success).toBe(false);
    expect(formatIssues(result.error!).map((i) => i.path)).toContain('email');
  });

  it('rejects a github_url that is not a URL', () => {
    const result = ParsedResumeSchema.safeParse({ ...VALID_RESUME, github_url: 'janesmith' });

    expect(result.success).toBe(false);
  });

  it('rejects unknown top-level keys', () => {
    const result = ParsedResumeSchema.safeParse({ ...VALID_RESUME, ssn: '123-45-6789' });

    expect(result.success).toBe(false);
  });

  it('rejects a missing required key', () => {
    const withoutSkills = { ...VALID_RESUME } as Partial<typeof VALID_RESUME>;
    delete withoutSkills.skills;

    expect(ParsedResumeSchema.safeParse(withoutSkills).success).toBe(false);
  });

  it('rejects a NaN graduation year', () => {
    const result = ParsedResumeSchema.safeParse({
      ...VALID_RESUME,
      education: [{ ...VALID_RESUME.education[0], start_year: NaN }],
    });

    expect(result.success).toBe(false);
  });

  it('rejects an experience entry with no title', () => {
    const result = ParsedResumeSchema.safeParse({
      ...VALID_RESUME,
      experience: [{ ...VALID_RESUME.experience[0], title: '' }],
    });

    expect(result.success).toBe(false);
  });

  it('rejects a skills array longer than 30', () => {
    const result = ParsedResumeSchema.safeParse({
      ...VALID_RESUME,
      skills: Array.from({ length: 31 }, (_, i) => `skill_${i}`),
    });

    expect(result.success).toBe(false);
  });

  it('rejects a non-object payload', () => {
    expect(ParsedResumeSchema.safeParse(null).success).toBe(false);
    expect(ParsedResumeSchema.safeParse('a string').success).toBe(false);
  });
});

describe('normalizeParsedResume', () => {
  it('repairs NaN years to zero so validation can proceed', () => {
    const normalized = normalizeParsedResume({
      ...VALID_RESUME,
      education: [{ ...VALID_RESUME.education[0], start_year: NaN, end_year: NaN }],
    }) as typeof VALID_RESUME;

    expect(normalized.education[0].start_year).toBe(0);
    expect(ParsedResumeSchema.safeParse(normalized).success).toBe(true);
  });

  it('collapses whitespace and trims', () => {
    const normalized = normalizeParsedResume({
      ...VALID_RESUME,
      name: '  Jane   Smith \n',
    }) as typeof VALID_RESUME;

    expect(normalized.name).toBe('Jane Smith');
  });

  it('lowercases the email', () => {
    const normalized = normalizeParsedResume({
      ...VALID_RESUME,
      email: 'Jane.Smith@Example.COM',
    }) as typeof VALID_RESUME;

    expect(normalized.email).toBe('jane.smith@example.com');
  });

  it('deduplicates and drops empty skills', () => {
    const normalized = normalizeParsedResume({
      ...VALID_RESUME,
      skills: ['React', 'React', '', '   ', 'Go'],
    }) as typeof VALID_RESUME;

    expect(normalized.skills).toEqual(['React', 'Go']);
  });

  it('drops experience entries with no title', () => {
    const normalized = normalizeParsedResume({
      ...VALID_RESUME,
      experience: [{ ...VALID_RESUME.experience[0], title: '   ' }],
    }) as typeof VALID_RESUME;

    expect(normalized.experience).toHaveLength(0);
  });

  it('truncates over-long arrays to the schema limits', () => {
    const normalized = normalizeParsedResume({
      ...VALID_RESUME,
      skills: Array.from({ length: 60 }, (_, i) => `skill_${i}`),
    }) as typeof VALID_RESUME;

    expect(normalized.skills).toHaveLength(30);
    expect(ParsedResumeSchema.safeParse(normalized).success).toBe(true);
  });

  it('strips unknown keys so strict validation passes', () => {
    const normalized = normalizeParsedResume({ ...VALID_RESUME, ssn: '123-45-6789' });

    expect(normalized).not.toHaveProperty('ssn');
    expect(ParsedResumeSchema.safeParse(normalized).success).toBe(true);
  });

  it('returns non-objects untouched for the schema to reject', () => {
    expect(normalizeParsedResume(null)).toBeNull();
    expect(ParsedResumeSchema.safeParse(normalizeParsedResume(null)).success).toBe(false);
  });
});

describe('normalize + validate on real parser output', () => {
  const RESUME_TEXT = `Jane Smith
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

  it('accepts the output of parseResumeText end to end', () => {
    const result = ParsedResumeSchema.safeParse(
      normalizeParsedResume(parseResumeText(RESUME_TEXT)),
    );

    expect(result.success).toBe(true);
  });

  it('accepts empty parser output structurally (content gating is the route\'s job)', () => {
    const result = ParsedResumeSchema.safeParse(normalizeParsedResume(parseResumeText('')));

    expect(result.success).toBe(true);
    expect(result.data!.skills).toEqual([]);
    expect(result.data!.experience).toEqual([]);
  });
});

describe('ProfileUpsertSchema', () => {
  const VALID_PROFILE = {
    userId: 'demo-abc',
    profile: {
      name: 'Jane Smith',
      location: 'Toronto, ON',
      skills: ['React'],
      github_url: 'https://github.com/janesmith',
      preferences: {
        remote: 'any' as const,
        location: 'Toronto',
        industries: ['Tech'],
        salary_min: 0,
        salary_max: 120000,
      },
    },
    experiences: [],
    education: [],
  };

  it('accepts a well-formed payload', () => {
    expect(ProfileUpsertSchema.safeParse(VALID_PROFILE).success).toBe(true);
  });

  it('strips extra UserProfile fields the client sends', () => {
    const result = ProfileUpsertSchema.safeParse({
      ...VALID_PROFILE,
      profile: { ...VALID_PROFILE.profile, user_id: 'demo-abc', xp: 100, rank: 'Bronze' },
    });

    expect(result.success).toBe(true);
    expect(result.data!.profile).not.toHaveProperty('xp');
  });

  it('defaults experiences and education to empty arrays', () => {
    const withoutLists = { ...VALID_PROFILE } as Partial<typeof VALID_PROFILE>;
    delete withoutLists.experiences;
    delete withoutLists.education;
    const result = ProfileUpsertSchema.safeParse(withoutLists);

    expect(result.success).toBe(true);
    expect(result.data!.experiences).toEqual([]);
    expect(result.data!.education).toEqual([]);
  });

  it('rejects a missing userId', () => {
    const withoutId = { ...VALID_PROFILE } as Partial<typeof VALID_PROFILE>;
    delete withoutId.userId;

    expect(ProfileUpsertSchema.safeParse(withoutId).success).toBe(false);
  });

  it('rejects an invalid remote preference', () => {
    const result = ProfileUpsertSchema.safeParse({
      ...VALID_PROFILE,
      profile: {
        ...VALID_PROFILE.profile,
        preferences: { ...VALID_PROFILE.profile.preferences, remote: 'sometimes' },
      },
    });

    expect(result.success).toBe(false);
  });

  it('rejects a non-numeric salary', () => {
    const result = ProfileUpsertSchema.safeParse({
      ...VALID_PROFILE,
      profile: {
        ...VALID_PROFILE.profile,
        preferences: { ...VALID_PROFILE.profile.preferences, salary_max: '120k' },
      },
    });

    expect(result.success).toBe(false);
  });
});

describe('formatIssues', () => {
  it('returns a path and message per issue without echoing input values', () => {
    const result = ParsedResumeSchema.safeParse({ ...VALID_RESUME, email: 'nope' });
    const issues = formatIssues(result.error!);

    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0]).toEqual({ path: expect.any(String), message: expect.any(String) });
    expect(JSON.stringify(issues)).not.toContain('nope');
  });

  it('labels root-level errors', () => {
    const result = ParsedResumeSchema.safeParse('a string');

    expect(formatIssues(result.error!)[0].path).toBe('(root)');
  });

  it('caps the issue list at 20', () => {
    const result = ParsedResumeSchema.safeParse({});

    expect(formatIssues(result.error!).length).toBeLessThanOrEqual(20);
  });
});
