const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(function(file) {
        if (file === 'node_modules' || file === '.git' || file === 'dist') return;
        file = path.resolve(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) { 
            /* Recurse */
            results = results.concat(walk(file));
        } else {
            /* Is a file */
            results.push({ file, mtime: stat.mtimeMs });
        }
    });
    return results;
}

const files = walk('/workspace');
files.sort((a,b) => b.mtime - a.mtime);
console.log(files.slice(0, 10));
