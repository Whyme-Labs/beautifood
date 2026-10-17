export interface Env {
  HYPERDRIVE: Hyperdrive; // pooled connection to Postgres (PlanetScale in production)
  KV: KVNamespace;
  EVENTS: Queue;
  ASSETS?: Fetcher;
  JWT_SECRET: string;
  ENVIRONMENT: string; // "dev" | "test" | "production"
  PUBLIC_URL?: string;
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_MODEL?: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
}
