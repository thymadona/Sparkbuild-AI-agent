import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({ dir: './' })

const config: Config = {
  testEnvironment: 'node',
  // Migrates TEST_DATABASE_URL before any suite runs, so tests can never
  // execute against a stale schema.
  globalSetup: '<rootDir>/jest.globalSetup.ts',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: ['**/__tests__/**/*.test.{ts,tsx}'],
  // __tests__/helpers/ holds shared fixtures, not suites.
  testPathIgnorePatterns: ['/node_modules/', '/.claude/worktrees/', '/__tests__/helpers/'],
}

export default createJestConfig(config)
