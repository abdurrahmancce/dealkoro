import firebaseRulesPlugin from '@firebase/eslint-plugin-security-rules';

export default [
  {
    ignores: ['dist/**/*', 'app/**/*', 'gradle/**/*']
  },
  firebaseRulesPlugin.configs['flat/recommended']
];
