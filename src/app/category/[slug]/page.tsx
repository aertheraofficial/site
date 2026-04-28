import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CatalogBrowser } from "@/components/catalog-browser";
import {
  categories,
  getCategoryBySlug,
  getProductsForCategory,
} from "@/data/products";

type CategoryPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateStaticParams() {
  return categories.map((category) => ({ slug: category.slug }));
}

export async function generateMetadata({
  params,
}: CategoryPageProps): Promise<Metadata> {
  const { slug } = await params;
  const category = getCategoryBySlug(slug);

  if (!category) {
    return {
      title: "Category Not Found",
    };
  }

  return {
    title: category.name,
    description: category.description,
  };
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;
  const category = getCategoryBySlug(slug);

  if (!category) {
    notFound();
  }

  const products = getProductsForCategory(slug);

  return (
    <div className="bg-[#f7f2ea] pb-20">
      <section className="relative overflow-hidden border-b border-[color:var(--line)]">
        <div className="absolute inset-0">
          <Image
            src={category.heroImage}
            alt={category.name}
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[rgba(17,17,14,0.72)] via-[rgba(17,17,14,0.44)] to-[rgba(17,17,14,0.14)]" />
        </div>

        <div className="page-frame relative">
          <div className="wide-shell flex min-h-[340px] items-end py-14 sm:min-h-[420px] sm:py-16">
            <div className="max-w-2xl space-y-4 text-white">
              <div className="text-[0.78rem] text-white/72">
                <Link href="/" className="hover:text-white">
                  Home
                </Link>
                <span className="mx-2">/</span>
                <span>{category.name}</span>
              </div>
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-[#d1c5ae]">
                {category.eyebrow}
              </p>
              <h1 className="font-display text-[3.6rem] leading-[0.92] tracking-[-0.05em] sm:text-[4.8rem]">
                {category.name}
              </h1>
              <p className="max-w-xl text-[1rem] leading-8 text-white/78">{category.intro}</p>
            </div>
          </div>
        </div>
      </section>

      <CatalogBrowser category={category} products={products} />
    </div>
  );
}
