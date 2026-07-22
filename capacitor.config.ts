import type { CapacitorConfig } from '@capacitor/cli'

// One codebase, two targets (spec 5). The Android build loads the same static
// bundle Firebase Hosting serves. A distinct applicationId per environment lets
// a development and a production build coexist on one device (spec 9.8) — the
// suffix is applied in the Gradle build, not here.
const config: CapacitorConfig = {
  appId: 'nl.huishouden.app',
  appName: 'Huishouden',
  webDir: 'dist',
  android: {
    // Deep links back into the webview after an auth redirect (spec 6.7).
    allowMixedContent: false,
  },
  server: {
    androidScheme: 'https',
  },
}

export default config
