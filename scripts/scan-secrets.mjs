import { readdir, readFile } from "node:fs/promises";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, "..");
const ignoredDirectories = new Set([".git", "node_modules"]);
const ignoredFiles = new Set(["scripts/scan-secrets.mjs"]);
const textExtensions = new Set([
  "", ".css", ".example", ".html", ".js", ".json", ".md", ".mjs", ".txt", ".yaml", ".yml",
]);

// 검사 코드 자체는 제외하고, 소스에 실제 키나 비밀번호가 들어간 경우에만 실패합니다.
const secretPatterns = [
  { label: "Supabase secret key", expression: /sb_secret_[A-Za-z0-9_-]{12,}/g },
  { label: "hardcoded Supabase publishable key", sourceOnly: true, expression: /sb_publishable_(?!your_key_here)[A-Za-z0-9_-]{20,}/g },
  { label: "JWT-like credential", expression: /eyJ[A-Za-z0-9_-]{40,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g },
  { label: "database URL with password", expression: /postgres(?:ql)?:\/\/[^\s/:]+:[^\s@]+@[^\s]+/gi },
];

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.isDirectory() && (ignoredDirectories.has(entry.name) || entry.name.startsWith(".phase"))) continue;

    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectFiles(absolutePath));
    } else if (entry.isFile()) {
      files.push(absolutePath);
    }
  }

  return files;
}

const findings = [];
const files = await collectFiles(projectRoot);

for (const filePath of files) {
  const relativePath = relative(projectRoot, filePath).replaceAll("\\", "/");
  if (ignoredFiles.has(relativePath) || !textExtensions.has(extname(filePath).toLowerCase())) continue;

  const content = await readFile(filePath, "utf8");
  for (const pattern of secretPatterns) {
    // production 브라우저 설정에는 publishable 키가 들어가야 하지만, 원본 소스에는 고정하지 않습니다.
    if (pattern.sourceOnly && relativePath.startsWith("dist/")) continue;
    pattern.expression.lastIndex = 0;
    if (pattern.expression.test(content)) {
      findings.push(`${relativePath}: ${pattern.label}`);
    }
  }
}

if (findings.length > 0) {
  console.error("비밀값으로 의심되는 문자열을 발견했습니다.");
  findings.forEach((finding) => console.error(`- ${finding}`));
  process.exitCode = 1;
} else {
  console.log(`비밀값 검사 통과: ${files.length}개 파일을 확인했습니다.`);
}
