import fs from 'node:fs/promises';
await fs.mkdir('extension/vendor',{recursive:true});
for(const file of ['pdf.min.mjs','pdf.worker.min.mjs']) await fs.copyFile('node_modules/pdfjs-dist/build/'+file,'extension/vendor/'+file);
await fs.copyFile('node_modules/pdfjs-dist/LICENSE','extension/vendor/pdfjs-LICENSE');
await fs.copyFile('node_modules/mammoth/mammoth.browser.min.js','extension/vendor/mammoth.browser.min.js');
await fs.copyFile('node_modules/mammoth/LICENSE','extension/vendor/mammoth-LICENSE');
console.log('Bundled PDF and DOCX parsers refreshed.');
