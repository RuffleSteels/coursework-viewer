import fs from 'fs';
import path from 'path';

const slidesDir = path.join(process.cwd(), 'public', 'slides');

if (!fs.existsSync(slidesDir)) {
    console.error('Slides directory not found');
    process.exit(1);
}

const presentations = fs.readdirSync(slidesDir).filter(f => 
    fs.statSync(path.join(slidesDir, f)).isDirectory()
);

console.log(`Found ${presentations.length} presentations.`);

for (const id of presentations) {
    const dir = path.join(slidesDir, id);
    const files = fs.readdirSync(dir);
    
    // Convert existing slide-XXXX.webp to source-XXXX.webp
    // This allows existing presentations to be "recompressed" using 
    // their current WebP files as the source.
    const webpSlides = files.filter(f => f.startsWith('slide-') && f.endsWith('.webp'));
    
    console.log(`Processing ${id}: Found ${webpSlides.length} slides.`);
    
    for (const webp of webpSlides) {
        const webpPath = path.join(dir, webp);
        const sourcePath = webpPath.replace('slide-', 'source-');
        
        if (!fs.existsSync(sourcePath)) {
            fs.copyFileSync(webpPath, sourcePath);
            console.log(`  Created source file: ${webp} -> ${path.basename(sourcePath)}`);
        }
    }
}

console.log('Done! All slides now have high-quality source-XXXX.webp counterparts.');
