export const STANDARD_EDITOR_CONFIG = `
# EditorConfig is awesome: https://EditorConfig.org

# top-most EditorConfig file
root = true

[*]
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true
indent_style = space
indent_size = 2

[*.{cmp,page,component}]
indent_style = space
indent_size = 2

[*.{html,js,json,md,ts,yaml,yml}]
indent_style = space
indent_size = 2
`;
