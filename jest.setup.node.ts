/**
 * next/jest calls loadEnvConfig(), which reads .env.local into the Jest
 * process. Without this, a real GEMINI_API_KEY in .env.local would make
 * `npm run verify` issue live provider requests from the route tests.
 * Tests that exercise the LLM path set this variable explicitly.
 */
delete process.env.GEMINI_API_KEY;
delete process.env.GEMINI_MODEL;

export {};
