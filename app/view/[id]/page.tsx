import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { SlideViewer } from "@/app/components/SlideViewer";
import { getPresentationMeta } from "@/app/lib/pdf-processor";
import { Suspense } from "react";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/lib/auth";

interface Props {
    params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { id } = await params;
    const meta = getPresentationMeta(id);
    if (!meta) return { title: "Not Found" };
    return {
        title: `${meta.title} — Folium`,
        openGraph: {
            title: meta.title,
            images: [`/slides/${id}/thumb-0001.webp`],
        },
    };
}

export default async function ViewPage({ params }: Props) {
    const { id } = await params;
    const meta = getPresentationMeta(id);

    if (!meta) notFound();

    // Pass authOptions here so it knows how to decode the token/role
    const session = await getServerSession(authOptions) as any;
    const isAdmin = session?.user?.role === 'admin';

    // If it's not public and not admin, redirect to sign in
    if (!meta.isPublic && !isAdmin) {
        redirect("/auth/signin?callbackUrl=/view/" + id);
    }

    // Note: If meta.isPublic is true, we show the SlideViewer.
    // The SlideViewer itself now handles the password gate if the user isn't an admin.

    return (
        <Suspense fallback={<div className="editor-loading"><div className="spinner" />Loading viewer…</div>}>
            {
                isAdmin ? <header className="editor-topbar">
                    <a href="/" className="nav-logo">Folium</a>
                    <span className="editor-title">{meta.title}</span>
                </header> : null
            }

            <SlideViewer
                presentationId={id}
                totalPages={meta.totalPages}
                aspectRatio={meta.aspectRatio}
                title={meta.title}
                isPublic={meta.isPublic}
            />
        </Suspense>
    );
}
