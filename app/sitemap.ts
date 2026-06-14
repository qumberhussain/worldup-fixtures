import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Single-page app: the homepage is the only indexable URL. It changes often
// during the tournament, so we flag it as frequently-updated, high-priority.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${SITE_URL}/`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 1,
    },
  ];
}
