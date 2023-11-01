/** @type {import("eslint").Linter.Config} */
module.exports = {
  extends: [ '../.eslintrc.js' ],
  rules: {
    ...require('@cenk1cenk2/eslint-config/utils').generateImportGroups({ tsconfigDir: __dirname })
  }
}
