/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production';

const nextConfig = {
    // Only apply the subpath prefix when building for production
    basePath: isProd ? '/coursework' : '',
    assetPrefix: isProd ? '/coursework' : '',

    // These moved out of 'experimental' in Next.js 15
    serverExternalPackages: ["sharp"],

    experimental: {
        serverActions: {
            bodySizeLimit: '210mb',
        },
    },

    async headers() {
        return [
            {
                source: "/slides/:presentationId/:file",
                headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
            },
            {
                source: "/slides/:presentationId/videos/:file",
                headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
            },
            {
                source: "/slides/:presentationId/video-overlays.json",
                headers: [{ key: "Cache-Control", value: "public, s-maxage=60, stale-while-revalidate=300" }],
            },
            {
                source: "/api/presentations/:id",
                headers: [{ key: "Cache-Control", value: "public, s-maxage=3600, stale-while-revalidate=86400" }],
            },
        ];
    },

    webpack: (config: { resolve: { alias: { canvas: boolean; }; }; }) => {
        config.resolve.alias.canvas = false;
        return config;
    },

    // Ensure standalone output for Docker
    output: 'standalone',
};

export default nextConfig;