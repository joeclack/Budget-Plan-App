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

The SQLite schema is initialized through `SQLiteProvider` and versioned with `PRAGMA user_version`.

## Validation

```bash
npm run lint
npm run format:check
npm run typecheck
npx expo-doctor@latest
npx expo export --platform ios
```
