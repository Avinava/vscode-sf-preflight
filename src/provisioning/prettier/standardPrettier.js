export const STANDARD_PRETTIER_RC = {
  trailingComma: "none",
  singleQuote: true,
  printWidth: 120,
  tabWidth: 2,
  useTabs: false,
  overrides: [
    {
      files: "**/lwc/**/*.html",
      options: { parser: "lwc" },
    },
    {
      files: "*.{cmp,page,component}",
      options: { parser: "html" },
    },
  ],
  plugins: ["prettier-plugin-apex"],
};

export const STANDARD_PRETTIER_IGNORE = `
# .prettierignore
.sf/
.sfdx/
.localdevserver/
dist/
node_modules/
coverage/
.DS_Store
package-lock.json
`;
