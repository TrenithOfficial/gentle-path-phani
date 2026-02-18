// Central place for API base URL.
//
// Resolution order:
// 1) VITE_API_BASE_URL (recommended)
// 2) VITE_API_BASE (older name)
// 3) fallback:
//    - dev: http://localhost:8081 (local Go backend)
//    - prod build: Cloud Run URL

const fromEnv = (
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ||
  (import.meta.env.VITE_API_BASE as string | undefined) ||
  ""
)
  .trim()
  .replace(/\/+$/, "");

export const API_BASE =
  fromEnv ||
  (import.meta.env.DEV
    ? "http://localhost:8081"
    : "https://gentle-path-api-883951071472.us-central1.run.app");
