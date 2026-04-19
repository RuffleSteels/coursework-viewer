import Link from "next/link";
import { UploadZone } from "@/app/components/UploadZone";
import { listPresentations } from "@/app/lib/pdf-processor";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/lib/auth";

// This page is a Server Component — it reads the filesystem directly.
// No need for a fetch to /api/presentations here.
export const dynamic = "force-dynamic"; // always fresh list

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function HomePage() {
  const presentations = listPresentations();
  const session = await getServerSession(authOptions);
  const isAdmin = (session?.user as any)?.role === 'admin';

  return (
      <div className="page">
        <nav className="nav">
          <a href="/" className="nav-logo">Folium</a>
        </nav>

        <main className="home-main">
          <div className="home-hero">
            <h1>
              PDF presentations,<br />
              <em>fast as static files.</em>
            </h1>
            <p>
              Upload a PDF and get a CDN-cached, instantly-loading presentation
              with selectable text — no JavaScript PDF rendering.
            </p>
          </div>

          <div>
            {isAdmin && <UploadZone />}

            {presentations.length > 0 && (
                <div className="presentations-section" style={{ marginTop: 48 }}>
                  <h2>Your presentations</h2>
                  <div className="presentations-list">
                    {presentations.map((p) => (
                        <Link
                            key={p.id}
                            href={`/view/${p.id}`}
                            className="presentation-row"
                        >
                          <span className="presentation-title">{p.title}</span>
                          <span className="presentation-meta">
                      {p.totalPages} slides · {formatDate(p.createdAt)}
                    </span>
                        </Link>
                    ))}
                  </div>
                </div>
            )}

            {presentations.length === 0 && (
                <div className="empty-state" style={{ marginTop: 32 }}>
                  No presentations yet — {isAdmin ? "upload your first PDF above." : "ask an admin to upload one."}
                </div>
            )}
          </div>
        </main>
      </div>
  );
}