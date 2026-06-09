import fs from "node:fs";
import path from "node:path";

export type StoredLink = {
  slug: string;
  url: string;
  visits: number;
  createdAt: string;
  lastVisitedAt?: string;
};

type LinkRecord = Omit<StoredLink, "slug">;

type StoreFile = {
  links: Record<string, LinkRecord>;
};

export type LinkStore = {
  find(slug: string): StoredLink | null;
  list(): StoredLink[];
  create(slug: string, url: string): StoredLink | null;
  recordVisit(slug: string): StoredLink | null;
};

function ensureStoreFile(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify({ links: {} }, null, 2));
  }
}

function readStore(filePath: string): StoreFile {
  ensureStoreFile(filePath);
  const raw = fs.readFileSync(filePath, "utf8");

  if (!raw.trim()) {
    return { links: {} };
  }

  const parsed = JSON.parse(raw) as Partial<StoreFile>;
  return {
    links: parsed.links && typeof parsed.links === "object" ? parsed.links : {}
  };
}

function writeStore(filePath: string, store: StoreFile): void {
  ensureStoreFile(filePath);
  const tempPath = `${filePath}.tmp`;

  fs.writeFileSync(tempPath, JSON.stringify(store, null, 2));
  fs.renameSync(tempPath, filePath);
}

export function createLinkStore(filePath: string): LinkStore {
  return {
    find(slug) {
      const store = readStore(filePath);
      const link = store.links[slug];
      return link ? { slug, ...link } : null;
    },

    list() {
      const store = readStore(filePath);
      return Object.entries(store.links)
        .map(([slug, link]) => ({ slug, ...link }))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    create(slug, url) {
      const store = readStore(filePath);

      if (store.links[slug]) {
        return null;
      }

      const link: LinkRecord = {
        url,
        visits: 0,
        createdAt: new Date().toISOString()
      };

      store.links[slug] = link;
      writeStore(filePath, store);

      return { slug, ...link };
    },

    recordVisit(slug) {
      const store = readStore(filePath);
      const link = store.links[slug];

      if (!link) {
        return null;
      }

      link.visits += 1;
      link.lastVisitedAt = new Date().toISOString();
      writeStore(filePath, store);

      return { slug, ...link };
    }
  };
}
