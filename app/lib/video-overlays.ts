import * as fs from "fs";
import * as path from "path";

export interface VideoOverlay {
    id: string;
    filename: string;
    slideNumber: number;
    x: number;      // % of slide width
    y: number;      // % of slide height
    width: number;  // % of slide width
    height: number; // % of slide height
    autoplay: boolean;
    loop: boolean;
    muted: boolean;
    // Object-fit positioning (0-100%)
    posX?: number; 
    posY?: number;
}

function overlayPath(presentationId: string) {
    return path.join(
        process.cwd(),
        "public", "slides", presentationId, "video-overlays.json"
    );
}

export function getVideoOverlays(presentationId: string): VideoOverlay[] {
    const p = overlayPath(presentationId);
    if (!fs.existsSync(p)) return [];
    try {
        return JSON.parse(fs.readFileSync(p, "utf-8"));
    } catch {
        return [];
    }
}

export function saveVideoOverlays(presentationId: string, overlays: VideoOverlay[]) {
    fs.writeFileSync(overlayPath(presentationId), JSON.stringify(overlays, null, 2));
}