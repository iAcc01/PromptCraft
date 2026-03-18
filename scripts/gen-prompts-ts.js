// Generate a separate defaultPrompts.ts data file
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('/tmp/pm_all_prompts.json', 'utf8'));

let code = `// Auto-generated from Prompt Minder (https://www.prompt-minder.com/public)
// Total: ${data.length} prompts across ${new Set(data.map(p => p.category)).size} categories

export interface DefaultPromptData {
  title: string
  description: string
  content: string
  category: string
  tags: string[]
  variables: { name: string; description: string; defaultValue: string }[]
}

export const DEFAULT_PROMPTS: DefaultPromptData[] = [\n`;

for (const p of data) {
  const title = JSON.stringify(p.title);
  const content = JSON.stringify(p.content);
  const category = JSON.stringify(p.category);

  // Extract variables
  const varMatches = [...p.content.matchAll(/\{\{(\w+)\}\}/g)];
  const uniqueVars = [...new Set(varMatches.map(m => m[1]))];
  const varsArr = uniqueVars.map(v => `{ name: ${JSON.stringify(v)}, description: ${JSON.stringify(v)}, defaultValue: '' }`);

  // Generate description
  const desc = p.content.replace(/[#*\n\r]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80).trim();

  // Generate tags from category
  const tags = [p.category];

  code += `  {
    title: ${title},
    description: ${JSON.stringify(desc)},
    content: ${content},
    category: ${category},
    tags: ${JSON.stringify(tags)},
    variables: [${varsArr.join(', ')}]
  },\n`;
}

code += `]\n`;

fs.writeFileSync('/Users/iacc/WorkBuddy/PromptCraft/src/renderer/data/defaultPrompts.ts', code);
console.log('Generated ' + data.length + ' prompts to src/renderer/data/defaultPrompts.ts');
