import type { MetadataRoute } from "next";
import { SITE_URL, absoluteUrl } from "@/lib/site";
import { loadFixtures } from "@/lib/fixtures";
import { matchSlug } from "@/lib/slug";

// Homepage + one indexable URL per match. Turns the site into 100+ long-tail
// landing pages ("Brazil vs Morocco World Cup 2026").
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const { payload } = await loadFixtures();

  const matches: MetadataRoute.Sitemap = payload.matches.map((m) => ({
    url: absoluteUrl(`/match/${matchSlug(m)}`),
    lastModified: now,
    changeFrequency: "hourly",
    priority: 0.8,
  }));

  return [
    {
      url: `${SITE_URL}/`,
      lastModified: now,
      changeFrequency: "hourly",
      priority: 1,
    },
    ...matches,
  ];
}
