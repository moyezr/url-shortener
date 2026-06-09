import type { LinkStore } from "./store";

export type AppOptions = {
  store: LinkStore;
  adminToken?: string;
  baseUrl?: string;
};

export type ShortenRequestBody = {
  url?: unknown;
  slug?: unknown;
};
