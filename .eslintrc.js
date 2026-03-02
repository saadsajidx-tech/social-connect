module.exports = {
  arrowParens: 'avoid',
  singleQuote: true,
  trailingComma: 'all',
};

// module.exports = {
//   root: true,
//   extends: ['@react-native'],
// parser: '@typescript-eslint/parser',
// parserOptions: {
//   ecmaFeatures: {
//     jsx: true,
//   },
//   ecmaVersion: 2021,
//   sourceType: 'module',
// },
// plugins: ['react', 'react-native', 'react-hooks', '@typescript-eslint', 'prettier', 'import'],
// env: {
//   'react-native/react-native': true,
//   es2021: true,
//   node: true,
//   jest: true,
// },
// rules: {},
// rules: {
//   // ============================================
//   // 🔴 CRITICAL PRODUCTION RULES
//   // ============================================

//   // React Hooks - Prevents infinite loops & stale closures
//   'react-hooks/rules-of-hooks': 'error',
//   'react-hooks/exhaustive-deps': 'error',

//   // Async/Await & Promises - Prevents unhandled rejections
//   'no-async-promise-executor': 'error',
//   'no-await-in-loop': 'warn',
//   'no-promise-executor-return': 'error',
//   'require-await': 'error',

//   // Null/Undefined Safety - Prevents crashes
//   'no-unsafe-optional-chaining': 'error',

//   // ============================================
//   // ⚡ PERFORMANCE & RE-RENDER PREVENTION
//   // ============================================

//   // Prevents unnecessary re-renders
//   'react/jsx-no-bind': [
//     'off',
//     {
//       allowArrowFunctions: false,
//       allowBind: false,
//       allowFunctions: false,
//     },
//   ],
//   'react/no-unstable-nested-components': ['error', { allowAsProps: true }],
//   'react/jsx-no-constructed-context-values': 'error',

//   // ============================================
//   // 🛡️ REACT BEST PRACTICES
//   // ============================================

//   'react/prop-types': 'off',
//   'react/react-in-jsx-scope': 'off',
//   'react/display-name': 'error',
//   'react/jsx-key': [
//     'error',
//     {
//       checkFragmentShorthand: true,
//       checkKeyMustBeforeSpread: true,
//     },
//   ],
//   'react/no-array-index-key': 'warn',
//   'react/no-children-prop': 'error',
//   'react/no-danger': 'warn',
//   'react/no-deprecated': 'error',
//   'react/no-direct-mutation-state': 'error',
//   'react/no-unescaped-entities': 'error',
//   'react/self-closing-comp': 'error',
//   'react/jsx-boolean-value': ['error', 'never'],
//   'react/jsx-curly-brace-presence': ['error', 'never'],
//   'react/jsx-fragments': ['error', 'syntax'],
//   'react/jsx-no-duplicate-props': 'error',
//   'react/jsx-no-useless-fragment': 'error',
//   'react/jsx-pascal-case': 'error',

//   // ============================================
//   // 📦 IMPORT/EXPORT ORGANIZATION
//   // ============================================

//   'import/order': [
//     'off',
//     {
//       groups: [
//         'builtin',
//         'external',
//         'internal',
//         'parent',
//         'sibling',
//         'index',
//       ],
//       'newlines-between': 'always',
//       pathGroups: [
//         {
//           pattern: 'react',
//           group: 'external',
//           position: 'before',
//         },
//         {
//           pattern: 'react-native',
//           group: 'external',
//           position: 'before',
//         },
//         {
//           pattern: '@/**',
//           group: 'internal',
//           position: 'before',
//         },
//       ],
//       pathGroupsExcludedImportTypes: ['react', 'react-native'],
//       alphabetize: {
//         order: 'asc',
//         caseInsensitive: true,
//       },
//     },
//   ],
//   'import/no-duplicates': 'error',
//   'import/no-unresolved': 'off',
//   'import/named': 'off',
//   'import/namespace': 'off',
//   'import/default': 'off',
//   'import/no-named-as-default-member': 'off',
//   'import/no-cycle': 'error',

//   // ============================================
//   // 🎯 TYPESCRIPT SPECIFIC
//   // ============================================

//   '@typescript-eslint/explicit-function-return-type': 'off',
//   '@typescript-eslint/explicit-module-boundary-types': 'off',
//   '@typescript-eslint/no-explicit-any': 'error',
//   '@typescript-eslint/no-unused-vars': [
//     'error',
//     {
//       argsIgnorePattern: '^_',
//       varsIgnorePattern: '^_',
//     },
//   ],
//   '@typescript-eslint/no-use-before-define': [
//     'error',
//     {
//       functions: true,
//       classes: true,
//       variables: false,
//     },
//   ],
//   '@typescript-eslint/no-shadow': 'error',

//   // ============================================
//   // 💅 CODE QUALITY & STYLE
//   // ============================================

//   'no-console': ['warn', { allow: ['warn', 'error'] }],
//   'no-debugger': 'error',
//   'no-alert': 'error',
//   'no-var': 'error',
//   'prefer-const': 'error',
//   'prefer-arrow-callback': 'error',
//   'prefer-template': 'error',
//   'no-nested-ternary': 'warn',
//   'no-unneeded-ternary': 'error',
//   eqeqeq: ['error', 'always'],
//   curly: ['error', 'all'],
//   'no-else-return': 'error',
//   'no-return-await': 'error',
//   'no-useless-return': 'error',
//   'no-duplicate-imports': 'error',

//   // ============================================
//   // 📱 REACT NATIVE SPECIFIC
//   // ============================================

//   'react-native/no-unused-styles': 'error',
//   'react-native/split-platform-components': 'warn',
//   'react-native/no-inline-styles': 'warn',
//   'react-native/no-color-literals': 'off',
//   'react-native/no-raw-text': [
//     'error',
//     {
//       skip: ['Button'],
//     },
//   ],

//   // ============================================
//   // 🎨 PRETTIER INTEGRATION
//   // ============================================

//   'prettier/prettier': [
//     'error',
//     {
//       singleQuote: true,
//       trailingComma: 'all',
//       arrowParens: 'avoid',
//       bracketSpacing: true,
//       endOfLine: 'auto',
//     },
//   ],
// },
// settings: {
//   react: {
//     version: 'detect',
//   },
//   'import/resolver': {
//     typescript: {},
//     node: {
//       extensions: ['.js', '.jsx', '.ts', '.tsx'],
//     },
//   },
// },
// overrides: [
//   // TypeScript files with type-aware rules
//   {
//     files: ['*.ts', '*.tsx'],
//     extends: [
//       'plugin:@typescript-eslint/recommended',
//       'plugin:@typescript-eslint/recommended-requiring-type-checking',
//     ],
//     parserOptions: {
//       project: './tsconfig.json',
//     },
//     rules: {
//       '@typescript-eslint/no-floating-promises': 'error',
//       '@typescript-eslint/no-misused-promises': 'error',
//       '@typescript-eslint/no-non-null-assertion': 'error',
//       '@typescript-eslint/no-unnecessary-condition': 'warn',
//       '@typescript-eslint/prefer-nullish-coalescing': 'error',
//       '@typescript-eslint/prefer-optional-chain': 'error',
//       'no-void': ['error', { allowAsStatement: true }],
//       '@typescript-eslint/naming-convention': [
//         'error',
//         {
//           selector: 'interface',
//           format: ['PascalCase'],
//           prefix: ['I'],
//         },
//         {
//           selector: 'typeAlias',
//           format: ['PascalCase'],
//         },
//         {
//           selector: 'enum',
//           format: ['PascalCase'],
//         },
//       ],
//     },
//   },
//   // Test files
//   {
//     files: ['**/__tests__/**', '**/*.test.ts', '**/*.test.tsx'],
//     env: {
//       jest: true,
//     },
//     rules: {
//       '@typescript-eslint/no-explicit-any': 'off',
//     },
//   },
// ],
// ignorePatterns: [
//   'node_modules/',
//   'build/',
//   'dist/',
//   'coverage/',
//   '.expo/',
//   'android/',
//   'ios/',
//   '*.config.js',
//   'metro.config.js',
//   'babel.config.js',
// ],
// };
