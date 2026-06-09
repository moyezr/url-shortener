import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../src/server";
import { createLinkStore } from "../src/store";

type TestAppOptions = {
  adminToken?: string;
  baseUrl?: string;
};

const tempDirs: string[] = [];

function createTestApp(options: TestAppOptions = {}) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "url-shortener-"));
  tempDirs.push(tempDir);

  const store = createLinkStore(path.join(tempDir, "links.json"));
  return createApp({ store, ...options });
}

afterEach(() => {
  for (const tempDir of tempDirs.splice(0)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});

describe("url shortener API", () => {
  it("returns health status", async () => {
    const app = createTestApp();

    const response = await request(app).get("/health").expect(200);
  });

  it("creates a short link and redirects through it", async () => {
    const app = createTestApp({ baseUrl: "https://short.example" });

    const createResponse = await request(app)
      .post("/api/shorten")
      .send({ url: "https://example.com/docs", slug: "docs" })
      .expect(201);

    expect(createResponse.body).toMatchObject({
      slug: "docs",
      url: "https://example.com/docs",
      shortUrl: "https://short.example/docs"
    });

    await request(app)
      .get("/docs")
      .expect(302)
      .expect("Location", "https://example.com/docs");
  });

  it("rejects unsupported URL schemes", async () => {
    const app = createTestApp();

    const response = await request(app)
      .post("/api/shorten")
      .send({ url: "file:///etc/passwd" })
      .expect(400);

    expect(response.body.error).toMatch(/valid http or https/);
  });

  it("requires admin token when configured", async () => {
    const app = createTestApp({ adminToken: "secret" });

    await request(app).get("/api/links").expect(401);
    await request(app).get("/api/links").set("X-Admin-Token", "secret").expect(200);
  });

  it("returns not found for missing slugs", async () => {
    const app = createTestApp();

    const response = await request(app).get("/missing-url").expect(404);

    expect(response.body.error).toBe("Not found");
  });

  it("returns conflict for duplicate slugs", async () => {
    const app = createTestApp();
    const payload = { url: "https://example.com", slug: "example" };

    await request(app).post("/api/shorten").send(payload).expect(201);
    const response = await request(app).post("/api/shorten").send(payload).expect(409);

    expect(response.body.error).toMatch(/already exists/);
  });

  it("returns bad request for invalid JSON", async () => {
    const app = createTestApp();

    const response = await request(app)
      .post("/api/shorten")
      .set("Content-Type", "application/json")
      .send("{")
      .expect(400);

    expect(response.body.error).toMatch(/valid JSON/);
  });

  it("increments visits when a short link is opened", async () => {
    const app = createTestApp({ adminToken: "supersecret" });

    const getVisitCount = async (slug: string) => {
      const response = await request(app)
        .get("/api/links")
        .set("X-Admin-Token", "supersecret")
        .expect(200);
      const link = response.body.links.find((item: { slug: string }) => item.slug === slug);

      return link ? link.visits : null;
    };

    await request(app)
      .post("/api/shorten")
      .set("X-Admin-Token", "supersecret")
      .send({ url: "https://example.com", slug: "example" })
      .expect(201);

    expect(await getVisitCount("example")).toBe(0);

    await request(app)
      .get("/example")
      .expect(302)
      .expect("Location", "https://example.com");

    expect(await getVisitCount("example")).toBe(1);
  });
});
