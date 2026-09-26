"use client";

import { AuthProvider } from "@/components/auth/AuthProvider";
import { GenerationActivityProvider } from "@/components/generation/GenerationActivityProvider";

// ThemeProvider temporarily disabled due to styled-components compatibility
// Will re-enable once design system team resolves the issue

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <GenerationActivityProvider>{children}</GenerationActivityProvider>
    </AuthProvider>
  );
}