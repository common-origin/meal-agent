import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  async redirects() {
    return [
      // The review page merged into /plan (#38): Details sheet and Confirm plan.
      { source: '/plan/review', destination: '/plan', permanent: true },
    ];
  },
};

export default nextConfig;
