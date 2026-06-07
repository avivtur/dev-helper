# Forklift: Verification Rules

## Testing Patterns
Follow `AGENTS.md` testing section and `.cursor/rules/testing.mdc` patterns:

- Test files: `*.test.ts` or `*.test.tsx`
- Place in `__tests__/` folder adjacent to the source file
- Use `@testing-library/react` for component/hook tests
- Mock i18n with utilities from `@test-utils/mockI18n`
