export default {
    extends: ['@commitlint/config-conventional'],
    ignores: [commit => /^[^\r\n]*\[skip ci\]/.test(commit)]
};
