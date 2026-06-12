import * as pdfjs from 'pdfjs-dist';
import mammoth from 'mammoth';

// Set worker for pdfjs using Vite-compatible worker loading
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url,
).toString();

export async function extractTextFromFile(file: File): Promise<string> {
    const fileType = file.type;

    try {
        if (fileType === 'application/pdf') {
            return await extractTextFromPDF(file);
        } else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
            return await extractTextFromDOCX(file);
        } else if (fileType.startsWith('text/')) {
            return await file.text();
        }
    } catch (error) {
        console.error(`Error extracting text from ${file.name}:`, error);
        return `[ERREUR D'EXTRACTION SUR LE FICHIER ${file.name}]`;
    }
    
    return '';
}

async function extractTextFromPDF(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjs.getDocument({ 
        data: arrayBuffer,
        useSystemFonts: true,
        disableFontFace: true
    });
    
    const pdf = await loadingTask.promise;
    let fullText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        
        if (textContent.items.length === 0) {
            fullText += `[PAGE ${i}: Aucun texte détecté sur cette page - Elle est peut-être scannée ou vide]\n`;
            continue;
        }

        // Group items by Y coordinate to preserve lines
        const items = textContent.items as any[];
        const lines: { [key: number]: any[] } = {};
        
        items.forEach(item => {
            const y = Math.round(item.transform[5]);
            if (!lines[y]) lines[y] = [];
            lines[y].push(item);
        });

        // Sort Y coordinates descending (top to bottom)
        const sortedY = Object.keys(lines)
            .map(Number)
            .sort((a, b) => b - a);

        const pageText = sortedY.map(y => {
            // Sort items in the same line by X coordinate
            return lines[y]
                .sort((a, b) => a.transform[4] - b.transform[4])
                .map(item => item.str)
                .join(' ');
        }).join('\n');
            
        fullText += `--- PAGE ${i} ---\n${pageText}\n`;
    }

    if (fullText.trim().length === 0) {
        return "[LE FICHIER PDF SEMBLE ÊTRE UNE IMAGE SANS TEXTE SÉLECTIONNABLE. ANALYSE VISUELLE IMPOSSIBLE SANS OCR.]";
    }

    return fullText;
}

async function extractTextFromDOCX(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    return result.value;
}
