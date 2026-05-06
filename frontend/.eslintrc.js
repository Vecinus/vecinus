module.exports = {
  extends: ['expo'],
  plugins: ['import'],
  settings: {
    'import/resolver': {
      typescript: {
        alwaysTryTypes: true,
        project: './tsconfig.json',
      },
    },
  },
  ignorePatterns: ['dist/*', '.expo/*', 'node_modules/*'],
};
