import type { Metadata } from 'next';
import type { ReactNode } from 'react';

// The page is a client component, so its title is set here (#213).
export const metadata: Metadata = { title: 'Privacy policy · Meal Agent' };

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
