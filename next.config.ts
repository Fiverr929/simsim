import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@glideapps/glide-data-grid"],
  turbopack: {
    resolveAlias: {
      "lodash/clamp.js": "lodash/clamp",
      "lodash/debounce.js": "lodash/debounce",
      "lodash/flatten.js": "lodash/flatten",
      "lodash/groupBy.js": "lodash/groupBy",
      "lodash/has.js": "lodash/has",
      "lodash/range.js": "lodash/range",
      "lodash/throttle.js": "lodash/throttle",
      "lodash/uniq.js": "lodash/uniq",
    },
  },
};

export default nextConfig;
