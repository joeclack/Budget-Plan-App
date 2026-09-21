# Budget Plan

An offline-first personal budgeting app for iPhone, built with Expo, React Native, TypeScript, Expo Router and SQLite.

## Development

Install dependencies:

```bash
npm install
```

Start the app in Expo Go:

```bash
npx expo start --go
```

The project targets Expo SDK 57. Native tabs use the SDK 57 `expo-router/unstable-native-tabs` API and adopt the system tab appearance. Liquid Glass controls use `expo-glass-effect` on supported iOS versions and an opaque accessible fallback elsewhere.

The SQLite schema is initialized through `SQLiteProvider` and versioned with `PRAGMA user_version`. The current schema is version 3; upgrades preserve existing budgets and add optional payment days transactionally.

## Budget persistence and calculations

The Budget tab reads saved months and derives its figures from their rules. A new installation starts empty, and legacy generated example months are removed without changing personal months.

- Tap any row to edit its name, notes, group and amount rule. Choose a fixed amount, percentage of another row/group, group total or custom arithmetic calculation.
- Give allocation rows an optional payment day from 1 to 31. The budget shows the effective date on each row and lists today's and future payments in date order; a day beyond the end of a short month uses that month's final day.
- Use Add row and Edit group to build income, spending and savings groups. Each editor previews the new totals and connected amounts before saving; Close discards the draft.
- Use Arrange to reorder groups and rows, or choose another group in a row's editor to move it. References follow the row's identity when it moves or is renamed.
- Delete from the row/group editor. The confirmation previews the effect; deletion is blocked if surviving rules depend on the removed items.
- Lock completed months to prevent edits; explicitly unlock them when needed. Copies and saved templates remain available while locked.
- Choose an unused month from the title picker, then start blank, copy a saved month, or use a template.
- Add a group or save the current month as a reusable template. Copies and templates have independent IDs and remapped references.
- Use Manage templates at the bottom of the Budget page to rename or delete templates, or replace a template's saved groups, rows, amounts and payment days with the current month. Existing budget months remain independent.
- Edits affect only the selected month. Templates are independent snapshots; save a new template to reuse a revised structure.

The Take-home tab calculates a monthly estimate from annual salary, a whole-salary pension rate and pension method. It supports England, Wales and Northern Ireland for tax years 2025/26 and 2026/27. Applying an estimate lets you choose an unlocked month's income row and saves the row change with a versioned calculation snapshot in one transaction.

Milestone 4 is the final planned product milestone. Milestones 5 and 6 are intentionally outside this app's scope.

Native iPhone storage uses `expo-sqlite` in Expo Go, including across app restarts. The web target is a browser preview using a separate localStorage snapshot; browser data does not sync to the phone. Simultaneous browser tabs do not have SQLite's transaction guarantees.

The Apple-signed EAS build is deferred by agreement; Expo Go is the current device workflow. EAS configuration is retained for later use.

See [budget data and rounding rules](docs/budget-domain.md) and [take-home calculator rules](docs/pay-calculator.md) for the domain, storage and calculation contracts.

## Validation

```bash
npm run lint
npm run format:check
npm run typecheck
npm test
npx expo-doctor@latest
npx expo export --platform ios
npx expo export --platform web
```

Tests require Node 22.13+ and use real temporary SQLite files through Node's built-in SQLite adapter. Native SQLite bridge behavior and keyboard positioning still need checking in Expo Go on the iPhone.
