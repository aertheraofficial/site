import type { MetadataRoute } from "next";
import { categories, products } from "@/data/products";
import { getSiteUrl } from "@/lib/store-config";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();
  const routes = [
    "",
    "/blank",
    "/blank-1",
    "/checkout/cancel",
  ].map((path) => ({
    url: `${siteUrl}${path}`,
    lastModified: new Date(),
  }));

  const categoryRoutes = categories.map((category) => ({
    url: `${siteUrl}/category/${category.slug}`,
    lastModified: new Date(),
  }));

  const productRoutes = products.map((product) => ({
    url: `${siteUrl}/product-page/${product.slug}`,
    lastModified: new Date(),
  }));

  return [...routes, ...categoryRoutes, ...productRoutes];
}
