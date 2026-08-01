import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Plus_Jakarta_Sans } from "next/font/google";
import { AuthProvider } from "@/components/auth-context";
import { CartProvider } from "@/components/cart-context";
import { SiteShell } from "@/components/site-shell";
import { siteInfo } from "@/data/site";
import { getSiteUrl } from "@/lib/store-config";
import "./globals.css";

const display = Cormorant_Garamond({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
});

const body = Plus_Jakarta_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

/**
 * The site is a light design with no dark variant. Without this, Chrome on
 * Android applies its Auto Dark Theme and inverts the page itself — which is
 * why the counter's input fields came out as unreadable dark boxes on Android
 * while iOS Safari, which does not force-darken, looked correct.
 *
 * Declaring the scheme tells the browser the page has already made its choice.
 */
export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#faf7f1",
};

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: "Aerthera | Sustainable Wellness Aromatherapy",
    template: "%s | Aerthera",
  },
  description:
    "Aerthera's Lemongrass Malaya storefront for sustainable wellness aromatherapy, with guest checkout, local assets, and a curated product range.",
  applicationName: siteInfo.name,
  openGraph: {
    type: "website",
    siteName: siteInfo.name,
    title: "Aerthera | Sustainable Wellness Aromatherapy",
    description:
      "Explore Aerthera's Lemongrass Malaya collection across body, home, fabric, and essential oil rituals.",
    url: getSiteUrl(),
    images: [
      {
        url: "/assets/brand/hero-portrait.png",
        alt: "Aerthera hero portrait",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Aerthera | Sustainable Wellness Aromatherapy",
    description:
      "Explore Aerthera's Lemongrass Malaya collection across body, home, fabric, and essential oil rituals.",
    images: ["/assets/brand/hero-portrait.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>
        <AuthProvider>
          <CartProvider>
            <SiteShell>{children}</SiteShell>
          </CartProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
