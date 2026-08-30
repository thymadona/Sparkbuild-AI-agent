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
  // Every database-backed suite shares one TEST_DATABASE_URL and truncates it
  // between tests (__tests__/helpers/db.ts). Jest's default is a worker per
  // core, so two such suites would run concurrently and wipe each other's rows
  // mid-assertion — which shows up as unrelated suites failing at random.
  // Serialising is the cheap fix: the whole suite runs in ~2s.
  maxWorkers: 1,
  // __tests__/helpers/ holds shared fixtures, not suites.
  testPathIgnorePatterns: ['/node_modules/', '/.claude/worktrees/', '/__tests__/helpers/'],
}

export default createJestConfig(config)
