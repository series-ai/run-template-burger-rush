// Stub for Capacitor modules - not needed for web-only builds
export const Capacitor = { isNativePlatform: () => false, getPlatform: () => "web" }
export const Preferences = { get: async () => ({}), set: async () => {}, remove: async () => {} }
export const LocalNotifications = { schedule: async () => {}, addListener: () => ({ remove: () => {} }) }
export const App = { addListener: () => ({ remove: () => {} }) }
export const SplashScreen = { hide: async () => {} }
