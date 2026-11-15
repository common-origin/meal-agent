import type { Metadata } from "next";
// Inter, the design system's font, in the weights its tokens use. The package loads no fonts and
// its tokens ask for the family 'Inter' by name, so it's loaded under that name with Fontsource:
// next/font would rename the family and the tokens wouldn't match it (design system usage guide).
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
// The design system's CSS variables (--co-*), before the app's globals that use them
import "@common-origin/design-system/tokens.css";
import "./globals.css";
import Providers from "./providers";
import Header from "@/components/navigation/Header";
import StyledComponentsRegistry from "@/lib/styledRegistry";

export const metadata: Metadata = {
  title: "Meal Agent",
  description: "Family meal planning with Common Origin Design System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <StyledComponentsRegistry>
          <Providers>
            <Header />
            {children}
          </Providers>
        </StyledComponentsRegistry>
      </body>
    </html>
  );
}
