// app/lib/auth.ts
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
const isProd = process.env.NODE_ENV === "production";
const basePath = isProd ? "/coursework" : "";
export const authOptions: NextAuthOptions = {
    providers: [
        CredentialsProvider({
            name: "Credentials",
            credentials: {
                username: { label: "Username", type: "text" },
                password: { label: "Password", type: "password" }
            },
            async authorize(credentials) {
                if (credentials?.username === "admin" && credentials?.password === process.env.ADMIN_PASSWORD) {
                    return { id: "1", name: "Admin", email: "admin@folium.com", role: "admin" };
                }
                return null;
            }
        })
    ],
    callbacks: {
        async redirect({ url, baseUrl }) {
            // Handle relative URLs
            if (url.startsWith("/")) {
                return `${baseUrl}${basePath}${url}`;
            }

            // Allow same-origin URLs
            if (url.startsWith(baseUrl)) {
                return url;
            }

            // Fallback
            return `${baseUrl}${basePath}`;
        },

        async jwt({ token, user }) {
            if (user) {
                token.role = (user as any).role;
            }
            return token;
        },

        async session({ session, token }) {
            if (session.user) {
                (session.user as any).role = token.role;
            }
            return session;
        }
    },
    pages: {
        signIn: `${basePath}/auth/signin`,
    },
    secret: process.env.NEXTAUTH_SECRET,
};
