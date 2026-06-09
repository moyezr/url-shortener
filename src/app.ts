import express, { type ErrorRequestHandler } from "express";
import { JSON_BODY_LIMIT } from "./constants";
import { createRoutes } from "./routes";
import type { AppOptions } from "./types";

export function createApp(options: AppOptions): express.Express {
  if (!options.store) {
    throw new Error("A link store is required");
  }

  const app = express();

  app.use(express.json({ limit: JSON_BODY_LIMIT }));
  app.use(createRoutes(options));

  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
    if (error instanceof SyntaxError) {
      res.status(400).json({ error: "Request body must be valid JSON" });
      return;
    }

    res.status(500).json({ error: "Internal server error" });
  };

  app.use(errorHandler);

  return app;
}
