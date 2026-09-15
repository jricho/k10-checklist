import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",

  async redirects() {
    return [
      // /diagnostics shipped in v0.9.0 and was renamed in v0.10.0. The route was
      // public for a matter of hours, but a readiness assessment is worked
      // through over days and links to it get pasted into tickets — a 404 there
      // reads as "the tool was withdrawn", which is worse than the redirect is
      // expensive. Permanent so it can be dropped later without leaving a
      // cached 302 behind.
      { source: "/diagnostics", destination: "/cluster-capture", permanent: true },
    ];
  },
};

export default nextConfig;
