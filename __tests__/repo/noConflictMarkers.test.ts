import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '../..');
const SCAN_DIRS = ['app', 'lib', 'utils', '__tests__'];
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.sql', '.css', '.md']);
const CONFLICT_MARKER_REGEX = /^(<<<<<<< .+|=======|>>>>>>> .+)$/m;

function walk(dir: string): string[] {
    if (!fs.existsSync(dir)) return [];

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === '.git') continue;
            files.push(...walk(fullPath));
        } else if (entry.isFile() && EXTENSIONS.has(path.extname(entry.name))) {
            files.push(fullPath);
        }
    }

    return files;
}

describe('Repository hygiene', () => {
    it('has no unresolved merge conflict markers in source files', () => {
        const files = SCAN_DIRS.flatMap((dir) => walk(path.join(ROOT, dir)));
        const offenders: string[] = [];

        for (const file of files) {
            const content = fs.readFileSync(file, 'utf8');
            if (CONFLICT_MARKER_REGEX.test(content)) {
                offenders.push(path.relative(ROOT, file));
            }
        }

        expect(offenders).toEqual([]);
    });
});
