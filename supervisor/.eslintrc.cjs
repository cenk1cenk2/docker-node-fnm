/** @type {import("eslint").Linter.Config} */
module.exports = {
  extends: [ '../.eslintrc.cjs' ],
  rules: {
    ...require('@cenk1cenk2/eslint-config/utils').generateImportGroups({ tsconfigDir: __dirname })
  }
}
