import { Router } from "express";
import { SLUG_PATTERN } from "./constants";
import type { AppOptions, ShortenRequestBody } from "./types";
import { generateSlug, getRequestOrigin, isValidDestination, requiresAdmin, sendUnauthorized } from "./utils";

export function createRoutes(options: AppOptions): Router {
  const { store, adminToken = "", baseUrl = "" } = options;
  const router = Router();

  router.get("/health", (_req, res) => {
    res.json({ status: "healthy" });
  });

  router.get("/api/links", (req, res) => {
    if (requiresAdmin(req, adminToken)) {
      sendUnauthorized(res);
      return;
    }

    res.json({ links: store.list() });
  });

  router.post("/api/shorten", (req, res) => {
    if (requiresAdmin(req, adminToken)) {
      sendUnauthorized(res);
      return;
    }

    const body = req.body as ShortenRequestBody;
    const destination = String(body.url || "").trim();
    const requestedSlug = body.slug ? String(body.slug).trim() : "";

    if (!isValidDestination(destination)) {
      res.status(400).json({ error: "url must be a valid http or https URL" });
      return;
    }

    if (requestedSlug && !SLUG_PATTERN.test(requestedSlug)) {
      res.status(400).json({ error: "slug must be 3-32 chars: letters, numbers, _ or -" });
      return;
    }

    let slug = requestedSlug || generateSlug();
    let link = store.create(slug, destination);

    for (let attempts = 0; !link && !requestedSlug && attempts < 5; attempts += 1) {
      slug = generateSlug();
      link = store.create(slug, destination);
    }

    if (!link) {
      res.status(409).json({ error: "slug already exists" });
      return;
    }

    const publicBaseUrl = baseUrl || getRequestOrigin(req);
    res.status(201).json({
      slug: link.slug,
      url: link.url,
      shortUrl: `${publicBaseUrl}/${link.slug}`
    });
  });

  router.get("/:slug", (req, res) => {
    const { slug } = req.params;

    if (SLUG_PATTERN.test(slug)) {
      const link = store.recordVisit(slug);

      if (link) {
        res.redirect(302, link.url);
        return;
      }
    }

    res.status(404).json({ error: "Not found" });
  });

  return router;
}
