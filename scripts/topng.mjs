/** TEMPORARY: rasterise the sample receipt so the layout can be reviewed. */
import fs from "fs";
import { pdfToPng } from "pdf-to-png-converter";

const input = process.argv[2] ?? "docs/sample-receipt.pdf";
const output = process.argv[3] ?? "docs/receipt-preview.png";

const pages = await pdfToPng(input, { viewportScale: 2.0 });
fs.writeFileSync(output, pages[0].content);
console.log(`wrote ${output} (${pages[0].content.length} bytes)`);
