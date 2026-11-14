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
  title: "Countersign",
  description:
    "AI reviews. A named human countersigns, on evidence they can check.",
};

export default function RootLayout({ children }: Readonly<LayoutProps<"/">>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetBrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <MotionProvider>
          <CommandMenuProvider>{children}</CommandMenuProvider>
          <Toaster theme="dark" />
        </MotionProvider>
      </body>
    </html>
  );
}
