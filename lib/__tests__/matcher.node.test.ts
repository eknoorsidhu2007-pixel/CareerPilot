import {
  analyzeSkillGaps,
  generateMatchExplanation,
  rankJobsForProfile,
  scoreMatch,
} from '@/lib/matcher';
import type { Job, UserProfile, WorkPreferences } from '@/types';

const basePrefs: WorkPreferences = {
  remote: 'any',
  location: '',
  industries: [],
  salary_min: 0,
  salary_max: 200000,
};

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: 'job_1',
    title: 'Software Engineer',
    company: 'Acme',
    location: 'Toronto, ON',
    remote: 'On-site',
    description: '',
    skills_required: [],
    salary_range: null,
    url: 'https://example.com/job_1',
    source: 'seed',
    posted_date: '2026-01-01T00:00:00.000Z',
    scraped_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    user_id: 'demo-user',
    name: 'Test User',
    location: '',
    skills: [],
    github_url: '',
    portfolio_url: '',
    work_auth: '',
    preferences: basePrefs,
    xp: 0,
    rank: 'Bronze',
    streak: 0,
    last_active: '',
    ...overrides,
  };
}

describe('scoreMatch', () => {
  it('awards the full skill weighting for a perfect overlap', () => {
    const job = makeJob({ skills_required: ['React', 'TypeScript', 'Node.js'] });
    const result = scoreMatch(
      ['React', 'TypeScript', 'Node.js'],
      job.skills_required,
      basePrefs,
      job,
    );

    expect(result.score).toBe(60);
    expect(result.matchingSkills).toHaveLength(3);
    expect(result.missingSkills).toHaveLength(0);
  });

  it('scores zero when no skills overlap', () => {
    const job = makeJob({ skills_required: ['React', 'TypeScript'] });
    const result = scoreMatch(['Fortran', 'COBOL'], job.skills_required, basePrefs, job);

    expect(result.score).toBe(0);
    expect(result.matchingSkills).toHaveLength(0);
    expect(result.missingSkills).toEqual(['React', 'TypeScript']);
  });

  it('weights partial overlap proportionally', () => {
    const job = makeJob({
      skills_required: ['React', 'TypeScript', 'Node.js', 'Python'],
    });
    const result = scoreMatch(['React', 'Python'], job.skills_required, basePrefs, job);

    expect(result.score).toBe(30);
    expect(result.missingSkills).toEqual(['TypeScript', 'Node.js']);
  });

  it('adds a remote bonus when the role is remote and the user is open to it', () => {
    const onsite = makeJob({ skills_required: ['React'] });
    const remote = makeJob({ skills_required: ['React'], remote: 'Remote' });

    const onsiteScore = scoreMatch(['React'], ['React'], basePrefs, onsite).score;
    const remoteScore = scoreMatch(['React'], ['React'], basePrefs, remote).score;

    expect(remoteScore - onsiteScore).toBe(10);
  });

  it('withholds the remote bonus when the user wants onsite only', () => {
    const remote = makeJob({ skills_required: ['React'], remote: 'Remote' });
    const prefs: WorkPreferences = { ...basePrefs, remote: 'onsite' };

    expect(scoreMatch(['React'], ['React'], prefs, remote).score).toBe(60);
  });

  it('adds a location bonus when the job matches the preferred location', () => {
    const job = makeJob({ skills_required: ['React'], location: 'Toronto, ON' });
    const prefs: WorkPreferences = { ...basePrefs, location: 'Toronto' };

    expect(scoreMatch(['React'], ['React'], prefs, job).score).toBe(70);
  });

  it('boosts early-career titles and penalises senior titles', () => {
    const intern = makeJob({ title: 'Software Engineer Intern', skills_required: ['React'] });
    const junior = makeJob({ title: 'Junior Developer', skills_required: ['React'] });
    const senior = makeJob({ title: 'Senior Software Engineer', skills_required: ['React'] });

    expect(scoreMatch(['React'], ['React'], basePrefs, intern).score).toBe(65);
    expect(scoreMatch(['React'], ['React'], basePrefs, junior).score).toBe(63);
    expect(scoreMatch(['React'], ['React'], basePrefs, senior).score).toBe(55);
  });

  it('clamps the score to the 0-100 range', () => {
    const job = makeJob({
      title: 'Software Engineer Intern',
      remote: 'Remote',
      location: 'Toronto, ON',
      skills_required: ['React'],
    });
    const prefs: WorkPreferences = { ...basePrefs, location: 'Toronto' };
    const score = scoreMatch(['React'], ['React'], prefs, job).score;

    expect(score).toBeLessThanOrEqual(100);
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it('treats an empty requirement list as a zero score rather than dividing by zero', () => {
    const job = makeJob({ skills_required: [] });
    const result = scoreMatch(['React'], [], basePrefs, job);

    expect(Number.isNaN(result.score)).toBe(false);
    expect(result.score).toBe(0);
  });

  it('matches skills by substring in either direction (known limitation)', () => {
    // "Java" is reported as matching a "JavaScript" requirement because
    // skillsOverlap does a bidirectional includes() check.
    const job = makeJob({ skills_required: ['JavaScript'] });
    const result = scoreMatch(['Java'], job.skills_required, basePrefs, job);

    expect(result.matchingSkills).toEqual(['Java']);
    expect(result.missingSkills).toHaveLength(0);
  });
});

describe('generateMatchExplanation', () => {
  it('names the matched skills and the score', () => {
    const job = makeJob({ skills_required: ['React'] });
    const text = generateMatchExplanation(72, job, ['React', 'Node.js'], [], basePrefs);

    expect(text).toContain('72%');
    expect(text).toContain('React');
  });

  it('suggests the first missing skill when the score is weak', () => {
    const job = makeJob({ skills_required: ['React', 'Kubernetes'] });
    const text = generateMatchExplanation(30, job, ['React'], ['Kubernetes'], basePrefs);

    expect(text).toContain('Kubernetes');
  });

  it('omits the improvement hint on a strong match', () => {
    const job = makeJob({ skills_required: ['React'] });
    const text = generateMatchExplanation(85, job, ['React'], ['Kubernetes'], basePrefs);

    expect(text).not.toContain('could improve your fit');
  });
});

describe('rankJobsForProfile', () => {
  const profile = makeProfile({ skills: ['React', 'TypeScript'] });
  const jobs = [
    makeJob({ id: 'weak', skills_required: ['Fortran', 'COBOL'] }),
    makeJob({ id: 'strong', skills_required: ['React', 'TypeScript'] }),
    makeJob({ id: 'partial', skills_required: ['React', 'Rust'] }),
  ];

  it('returns results sorted descending by score', () => {
    const ranked = rankJobsForProfile(profile, jobs);

    for (let i = 1; i < ranked.length; i++) {
      expect(ranked[i - 1].score).toBeGreaterThanOrEqual(ranked[i].score);
    }
    expect(ranked[0].job.id).toBe('strong');
  });

  it('respects the limit parameter', () => {
    expect(rankJobsForProfile(profile, jobs, 2)).toHaveLength(2);
  });

  it('attaches an explanation to every result', () => {
    for (const match of rankJobsForProfile(profile, jobs)) {
      expect(typeof match.explanation).toBe('string');
      expect(match.explanation!.length).toBeGreaterThan(0);
    }
  });

  it('returns an empty array when there are no jobs', () => {
    expect(rankJobsForProfile(profile, [])).toEqual([]);
  });

  it('falls back to skills inferred from the description when none are listed', () => {
    const inferred = makeJob({
      id: 'inferred',
      skills_required: [],
      description: 'We are looking for someone strong in React and TypeScript.',
    });
    const [match] = rankJobsForProfile(profile, [inferred]);

    expect(match.score).toBeGreaterThan(0);
    expect(match.matchingSkills.length).toBeGreaterThan(0);
  });
});

describe('analyzeSkillGaps', () => {
  it('ranks the most frequently required missing skills first', () => {
    const profile = makeProfile({ skills: ['React'] });
    const jobs = [
      makeJob({ id: 'a', skills_required: ['React', 'Kubernetes'] }),
      makeJob({ id: 'b', skills_required: ['React', 'Kubernetes'] }),
      makeJob({ id: 'c', skills_required: ['React', 'Rust'] }),
    ];

    const gaps = analyzeSkillGaps(profile, jobs);

    expect(gaps[0].skill).toBe('Kubernetes');
    expect(gaps[0].rolesUnlocked).toBe(2);
    expect(gaps[0].priority).toBe('high');
  });

  it('never reports a skill the user already has', () => {
    const profile = makeProfile({ skills: ['React', 'TypeScript'] });
    const jobs = [makeJob({ skills_required: ['React', 'TypeScript'] })];

    expect(analyzeSkillGaps(profile, jobs)).toEqual([]);
  });

  it('returns at most five gaps and assigns descending priority', () => {
    const profile = makeProfile({ skills: [] });
    const jobs = [
      makeJob({
        skills_required: ['Rust', 'Kubernetes', 'Terraform', 'Kafka', 'Redis', 'Docker', 'Go'],
      }),
    ];

    const gaps = analyzeSkillGaps(profile, jobs);

    expect(gaps.length).toBeLessThanOrEqual(5);
    expect(gaps[0].priority).toBe('high');
    expect(gaps[1].priority).toBe('medium');
    expect(gaps[4].priority).toBe('low');
  });
});
