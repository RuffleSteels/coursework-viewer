import fs from "fs";
import path from "path";
import sharp from "sharp";

const [id, qualityArg] = process.argv.slice(2);
const quality = Number(qualityArg || 75);

function log(msg) {
    const ts = new Date().toISOString();
    console.log(`[recompress ${id}] ${ts} ${msg}`);
}

async function run() {
    const dir = path.join(process.cwd(), "public", "slides", id);

    const sourceFiles = fs
        .readdirSync(dir)
        .filter(f => f.startsWith("source-") && f.endsWith(".webp"))
        .sort(); // important: stable order

    log(`Starting recompress: ${sourceFiles.length} slides, quality=${quality}`);

    for (let i = 0; i < sourceFiles.length; i++) {
        const file = sourceFiles[i];

        const sourcePath = path.join(dir, file);
        const padNum = file.match(/source-(\d+)\.webp/)?.[1];
        if (!padNum) continue;

        const slidePath = path.join(dir, `slide-${padNum}.webp`);

        log(`Processing ${i + 1}/${sourceFiles.length} → slide ${padNum}`);

        await sharp(sourcePath)
            .webp({ quality: Math.min(100, Math.max(1, quality)), effort: 6 })
            .toFile(slidePath + ".tmp");

        if (fs.existsSync(slidePath)) fs.unlinkSync(slidePath);
        fs.renameSync(slidePath + ".tmp", slidePath);
    }

    log(`DONE recompressing ${id}`);
}

run().catch(err => {
    console.error(`[recompress ${id}] FAILED`, err);
    process.exit(1);
});