import nextPlugin from '@next/eslint-plugin-next'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'

// Next.js 16 removed `next lint`, and @next/eslint-plugin-next now defaults to
// flat config. This is the plugin's recommended ruleset plus core-web-vitals —
// the same rules `eslint-config-next` applied before, nothing custom.
export default [
  {
    ignores: ['.next/**', 'node_modules/**', 'coverage/**', 'public/**'],
  },
  {
    files: ['**/*.{js,jsx,mjs,ts,tsx}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    plugins: { '@next/next': nextPlugin, 'react-hooks': reactHooks },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs['core-web-vitals'].rules,
      // The two hook rules eslint-config-next enabled. The plugin's current
      // `recommended` set adds React Compiler rules that flag long-standing
      // patterns across this codebase — adopt those deliberately, not as a
      // side effect of the Next 16 upgrade.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
]
