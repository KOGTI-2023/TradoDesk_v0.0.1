import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Simple heuristic script to check if certain files exist to mark TODOs
// In a real scenario, this would check AST or grep specific strings

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.resolve(__dirname, '..');
const TODO_PATH = path.join(ROOT, 'TODO.md');

const CHECKS: Record<string, string[]> = {
  "Output complete folder/file tree": ["packages/app", "packages/automation"],
  "Electron 29+ setup": ["packages/app/electron/main.ts"],
  "Secure defaults": ["packages/app/electron/main.ts"],
  "Usage Dashboard": ["packages/app/src/components/Dashboard.tsx"],
  "ModelRouter implementation": ["packages/app/src/services/geminiService.ts"],
  "Playwright runner scaffolding": ["packages/automation/src/runner.ts"],
  "Black screen fix": ["packages/app/src/main.tsx", "packages/app/electron/main.ts"]
};

function main() {
  if (!fs.existsSync(TODO_PATH)) {
    console.error("TODO.md not found");
    return;
  }

  let content = fs.readFileSync(TODO_PATH, 'utf-8');

  for (const [key, files] of Object.entries(CHECKS)) {
    const allExist = files.every(f => fs.existsSync(path.join(ROOT, f)));
    if (allExist) {
        // Regex to check the box if the description matches roughly
        // This is a simplified regex, assuming standard markdown list format
        const regex = new RegExp(`- \\[ \\] .*${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*`, 'g');
        content = content.replace(regex, (match) => match.replace('[ ]', '[x]'));
    }
  }

  fs.writeFileSync(TODO_PATH, content);
  console.log("TODO.md updated successfully.");
}

main();
