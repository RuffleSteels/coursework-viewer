/** @type {import('next').NextConfig} */
const nextConfig = {
    experimental: {
        serverComponentsExternalPackages: ["sharp"],
        serverActionsBodySizeLimit: "210mb",
        serverActions: {
            bodySizeLimit: '200mb', // or '5mb', '20mb', etc.
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

    webpack: (config) => {
        config.resolve.alias.canvas = false;
        return config;
    },
};

export default nextConfig;
