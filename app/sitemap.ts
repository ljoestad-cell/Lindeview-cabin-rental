import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

/** Kun de offentlige sidene – admin og API er stengt i robots.ts. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return [
    { url: base, changeFrequency: "monthly", priority: 1 },
    { url: `${base}/book`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/vilkar`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/personvern`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
