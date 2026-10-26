import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Toaster } from "sonner";
import { AuthProvider } from "@/features/auth/auth-provider";
import { routing } from "@/i18n/routing";
import { QueryProvider } from "@/components/providers/query-provider";
import { ThemeProvider } from "@/components/providers/theme-provider";
import "leaflet/dist/leaflet.css";
import "../globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    default: "IndoBengkel — Book the bay. Skip the guesswork.",
    template: "%s · IndoBengkel",
  },
  description:
    "Book trusted motorcycle and car workshops, track service history, and shop pickup-only parts.",
  applicationName: "IndoBengkel",
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      suppressHydrationWarning
      className={`${inter.variable} ${spaceGrotesk.variable}`}
    >
      <body>
        <ThemeProvider>
          <NextIntlClientProvider messages={messages}>
            <QueryProvider>
              <AuthProvider>
                {children}
                <Toaster
                  position="top-center"
                  richColors
                  closeButton
                  toastOptions={{
                    classNames: {
                      toast: "font-sans",
                    },
                  }}
                />
              </AuthProvider>
            </QueryProvider>
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
