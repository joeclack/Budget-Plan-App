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

The SQLite schema is initialized through `SQLiteProvider` and versioned with `PRAGMA user_version`. Milestone 2 upgrades the foundation schema to version 2 transactionally.

## Budget persistence and calculations

The Budget tab now reads saved months and derives its figures from their rules. On an empty installation it saves one example budget in the current calendar month. Existing data is never replaced by this seed.

- Tap a fixed amount to edit it. Saving recalculates dependent rows and persists the complete month.
- Choose an unused month from the title picker, then start blank, copy a saved month, or use a template.
- Add a group or save the current month as a reusable template. Copies and templates have independent IDs and remapped references.
- Full row/rule editors and rearranging controls are the next milestone. Take-home remains a sample design until Milestone 4.

Native iPhone storage uses `expo-sqlite` in Expo Go, including across app restarts. The web target is a browser preview using a separate localStorage snapshot; browser data does not sync to the phone. Simultaneous browser tabs do not have SQLite's transaction guarantees.

The Apple-signed EAS build is deferred by agreement; Expo Go is the current device workflow. EAS configuration is retained for later use.

See [budget data and rounding rules](docs/budget-domain.md) for the domain/storage contracts and validation coverage.

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
