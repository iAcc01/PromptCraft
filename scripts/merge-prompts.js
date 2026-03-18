const fs = require('fs');
const allPrompts = [];
const seen = new Set();

for (let i = 1; i <= 7; i++) {
  try {
    let raw = fs.readFileSync('/tmp/pm_page' + i + '.json', 'utf8').trim();
    // The files have a leading newline and the content is a JSON-encoded string
    // First parse removes the outer string quoting, second parse gets the array
    let data;
    try {
      // Try double-parse (JSON string containing JSON array)
      const inner = JSON.parse(raw);
      if (typeof inner === 'string') {
        data = JSON.parse(inner);
      } else if (Array.isArray(inner)) {
        data = inner;
      }
    } catch(e) {
      // Try single parse
      try {
        data = JSON.parse(raw);
      } catch(e2) {
        console.log('Page ' + i + ' parse error: ' + e2.message);
        continue;
      }
    }
    if (Array.isArray(data)) {
      for (const p of data) {
        if (p && p.title && p.content) {
          const key = p.title.trim();
          if (!seen.has(key)) {
            seen.add(key);
            allPrompts.push({
              title: p.title.trim(),
              content: p.content.trim(),
              category: (p.category || '自定义').trim()
            });
          }
        }
      }
      console.log('Page ' + i + ': parsed ' + data.length + ' items');
    } else {
      console.log('Page ' + i + ': not an array, type=' + typeof data);
    }
  } catch(e) {
    console.log('Page ' + i + ' error: ' + e.message);
  }
}

console.log('Total unique prompts: ' + allPrompts.length);

const cats = {};
for (const p of allPrompts) {
  cats[p.category] = (cats[p.category] || 0) + 1;
}
console.log('Categories:', JSON.stringify(cats, null, 2));

fs.writeFileSync('/tmp/pm_all_prompts.json', JSON.stringify(allPrompts, null, 2));
console.log('Saved to /tmp/pm_all_prompts.json');
