import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
  {
    // Legacy local-development-only Express/Socket.IO server (CommonJS).
    // NOT part of the Next.js production build. Uses require() by design.
    files: ['server/**/*.js'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // Browser extension (Manifest V3) — not part of the Next.js app.
    'Astryon_Extension/**',
  ]),
])

export default eslintConfig