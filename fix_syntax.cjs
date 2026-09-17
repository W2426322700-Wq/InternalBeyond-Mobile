const fs = require('fs');
const lines = fs.readFileSync('custom/extension.js', 'utf8').split('\n');

const linesToFix = [5573, 5585, 5606, 5634]; // 0-indexed is line - 1
for (let i of linesToFix) {
    if (lines[i].includes('});')) {
        lines[i] = lines[i].replace('});', '};');
    }
}

fs.writeFileSync('custom/extension.js', lines.join('\n'));
console.log("FIXED");
