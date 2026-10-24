import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // Stable styled-components class names, so server-rendered markup (e.g. the
  // plan's loading cards) hydrates with the same classes as the client.
  compiler: {
    styledComponents: true,
  },
  async redirects() {
    return [
      // The review page merged into /plan (#38): Details sheet and Confirm plan.
      { source: '/plan/review', destination: '/plan', permanent: true },
    ];
  },
};

export default nextConfig;
