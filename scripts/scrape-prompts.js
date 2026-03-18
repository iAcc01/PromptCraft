// Script to extract prompts from all pages using agent-browser eval
// Run: node scripts/scrape-prompts.js

const { execSync } = require('child_process');

const CATEGORIES = [
  'IT/编程', '商业管理', '技术开发', '语言翻译', '生活服务',
  '写作辅助', '教育培训', '娱乐游戏', '医疗健康', 'SEO',
  '创意艺术', '专业咨询', '技术培训', '哲学/宗教', '社区贡献', '商业办公'
];

const extractScript = `
const cards = document.querySelectorAll('.rounded-xl.text-card-foreground');
const cats = ${JSON.stringify(CATEGORIES)};
const data = Array.from(cards).map(card => {
  const title = card.querySelector('.text-lg.font-bold')?.textContent?.trim() || '';
  const paragraphs = card.querySelectorAll('p');
  let content = '';
  for (const p of paragraphs) {
    if (p.textContent.trim().length > 15) { content = p.textContent.trim(); break; }
  }
  const badges = card.querySelectorAll('span');
  let category = '';
  for (const b of badges) {
    const t = b.textContent.trim();
    if (cats.includes(t)) { category = t; break; }
  }
  return {title, content, category};
});
JSON.stringify(data);
`;

function run(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }).trim();
  } catch (e) {
    console.error('Command failed:', cmd.substring(0, 100));
    return '';
  }
}

async function main() {
  const allPrompts = [];

  for (let page = 1; page <= 7; page++) {
    console.log(`Scraping page ${page}/7...`);

    if (page > 1) {
      // Click next page button
      run(`agent-browser click "button:has-text('${page}')" 2>&1`);
      run('agent-browser wait 2000 2>&1');
    }

    const result = run(`agent-browser eval "${extractScript.replace(/"/g, '\\"').replace(/\n/g, ' ')}" 2>&1`);

    try {
      // Parse the result - agent-browser wraps in quotes
      const cleaned = result.replace(/^"/, '').replace(/"$/, '').replace(/\\"/g, '"').replace(/\\\\n/g, '\\n');
      const items = JSON.parse(cleaned);
      console.log(`  Found ${items.length} prompts on page ${page}`);
      allPrompts.push(...items);
    } catch (e) {
      console.error(`  Failed to parse page ${page}:`, e.message);
    }
  }

  console.log(`\nTotal prompts scraped: ${allPrompts.length}`);

  const fs = require('fs');
  const outputPath = require('path').join(__dirname, '..', 'scraped-prompts.json');
  fs.writeFileSync(outputPath, JSON.stringify(allPrompts, null, 2));
  console.log(`Saved to ${outputPath}`);
}

main();
