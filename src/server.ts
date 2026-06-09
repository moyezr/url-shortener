import http from "node:http";
import path from "node:path";
import { createApp } from "./app";
import { DEFAULT_PORT } from "./constants";
import { createLinkStore } from "./store";
import type { AppOptions } from "./types";

export { createApp } from "./app";
export { generateSlug, isValidDestination } from "./utils";

export function createServer(options: AppOptions): http.Server {
  return http.createServer(createApp(options));
}

function main(): void {
  const port = Number(process.env.PORT || DEFAULT_PORT);
  const dataFile = process.env.LINKS_FILE || path.join(__dirname, "..", "..", "data", "links.json");
  const store = createLinkStore(dataFile);
  const server = createServer({
    store,
    adminToken: process.env.ADMIN_TOKEN || "",
    baseUrl: process.env.BASE_URL || ""
  });

  const host = process.env.HOST || "127.0.0.1";

  server.listen(port, host, () => {
    console.log(`url-shortener listening on http://${host}:${port}`);
  });
}

if (require.main === module) {
  main();
}
