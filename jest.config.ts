import type { Config } from 'jest';
import nextJest from 'next/jest.js';

const createJestConfig = nextJest({ dir: './' });

export default async (): Promise<Config> => {
  const nextJestConfig = (await createJestConfig({
    testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/.next/'],
  })()) as Config;

  const { projects: _projects, ...projectBase } = nextJestConfig;

  const moduleNameMapper = {
    ...(nextJestConfig.moduleNameMapper as Record<string, string> | undefined),
    '^@/(.*)$': '<rootDir>/$1',
  };

  return {
    ...nextJestConfig,
    projects: [
      {
        ...projectBase,
        displayName: 'node',
        testEnvironment: 'node',
        testMatch: ['<rootDir>/**/__tests__/**/*.node.test.ts'],
        moduleNameMapper,
      },
      {
        ...projectBase,
        displayName: 'jsdom',
        testEnvironment: 'jest-environment-jsdom',
        testMatch: ['<rootDir>/**/__tests__/**/*.dom.test.ts?(x)'],
        moduleNameMapper,
        setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
      },
    ],
  };
};
