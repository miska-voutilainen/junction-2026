import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { CommandMenuProvider } from "@/components/CommandMenu";
import { MotionProvider } from "@/components/MotionProvider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Resolves the social preview image to an absolute URL, which link crawlers need.
  metadataBase: new URL("https://countersign-junction.com"),
  title: "Countersign",
  description: "AI reviews. A named human countersigns, on evidence they can check.",
  // X shows the small card unless asked; the preview image is made for the large one.
  twitter: { card: "summary_large_image" },
};

/**
 * The shell around every page: fonts, the motion provider (reduced-motion
 * aware), the command menu (Cmd/Ctrl+K from any page) and the toast outlet.
 */
export default function RootLayout({ children }: Readonly<LayoutProps<"/">>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetBrainsMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <MotionProvider>
          <CommandMenuProvider>{children}</CommandMenuProvider>
          <Toaster theme="dark" />
        </MotionProvider>
      </body>
    </html>
  );
}
