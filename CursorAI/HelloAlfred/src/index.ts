import fs from 'fs';
import path from 'path';

function countLines(filePath: string): Promise<number> {
    return new Promise((resolve, reject) => {
        try {
            // Resolve the absolute path
            const absolutePath = path.resolve(filePath);
            
            // Read the file content
            const content = fs.readFileSync(absolutePath, 'utf-8');
            
            // Split by newlines and count
            const lines = content.split('\n').length;
            
            resolve(lines);
        } catch (error) {
            reject(error);
        }
    });
}

async function main() {
    // Get the filename from command line arguments
    const args = process.argv.slice(2);
    
    if (args.length !== 1) {
        console.error('Usage: npm start -- <filename>');
        process.exit(1);
    }

    const filename = args[0];

    try {
        const lineCount = await countLines(filename);
        console.log(`The file "${filename}" has ${lineCount} line(s).`);
    } catch (error) {
        console.error('Error:', (error as Error).message);
        process.exit(1);
    }
}

main(); 