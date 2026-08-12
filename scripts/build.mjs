import { copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, "..");
const outputDirectory = resolve(projectRoot, "dist");
const sourceFiles = [
  { source: "index.html", output: "index.html" },
  { source: "styles.css", output: "greenon-styles.css" },
  { source: "app.js", output: "app.js" },
  { source: "assets/carrier-hvac-logo.png", output: "assets/carrier-hvac-logo.png" },
  { source: "assets/carrier-favicon.png", output: "assets/carrier-favicon.png" },
  { source: "assets/carrier-energy-mascot.png", output: "assets/carrier-energy-mascot.png" },
  { source: "assets/videos/carrier-greenon-intro.mp4", output: "assets/videos/carrier-greenon-intro.mp4" },
  { source: "assets/rewards/starbucks-americano.jpg", output: "assets/rewards/starbucks-americano.jpg" },
  { source: "assets/rewards/starbucks-tumbler.jpg", output: "assets/rewards/starbucks-tumbler.jpg" },
  { source: "assets/rewards/sungsimdang-zero-cookie.jpg", output: "assets/rewards/sungsimdang-zero-cookie.jpg" },
  { source: "assets/rewards/oral-b-io10.png", output: "assets/rewards/oral-b-io10.png" },
  { source: "assets/rewards/carrier-circulator.jpg", output: "assets/rewards/carrier-circulator.jpg" },
  { source: "assets/rewards/carrier-air-purifier.jpg", output: "assets/rewards/carrier-air-purifier.jpg" },
];

function requireEnvironmentVariable(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} 환경변수가 필요합니다.`);
  return value;
}

function validateHttpsUrl(name, value) {
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error(`${name}은 HTTPS URL이어야 합니다.`);
  return url.toString();
}

const supabaseUrl = validateHttpsUrl("SUPABASE_URL", requireEnvironmentVariable("SUPABASE_URL"));
const publishableKey = requireEnvironmentVariable("SUPABASE_PUBLISHABLE_KEY");
const weatherApiUrl = validateHttpsUrl(
  "WEATHER_API_URL",
  process.env.WEATHER_API_URL?.trim() || "https://api.open-meteo.com/v1/forecast",
);

if (!publishableKey.startsWith("sb_publishable_")) {
  throw new Error("SUPABASE_PUBLISHABLE_KEY에는 브라우저용 sb_publishable_ 키만 사용할 수 있습니다.");
}

// 출력 경로가 프로젝트 바로 아래의 dist인지 확인한 뒤에만 기존 산출물을 지웁니다.
if (dirname(outputDirectory) !== projectRoot || relative(projectRoot, outputDirectory) !== "dist") {
  throw new Error("안전하지 않은 production 출력 경로입니다.");
}

await rm(outputDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });

for (const { source, output } of sourceFiles) {
  const destination = join(outputDirectory, output);
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(join(projectRoot, source), destination);
}

const browserConfig = `// production 빌드가 환경변수에서 생성한 공개 클라이언트 설정입니다.\nwindow.GREENON_SUPABASE_CONFIG = Object.freeze(${JSON.stringify({
  url: supabaseUrl,
  publishableKey,
}, null, 2)});\n\nwindow.GREENON_WEATHER_CONFIG = Object.freeze(${JSON.stringify({
  apiUrl: weatherApiUrl,
}, null, 2)});\n`;

await writeFile(join(outputDirectory, "greenon-config.js"), browserConfig, "utf8");
console.log(`production build 완료: ${sourceFiles.length + 1}개 파일 → ${outputDirectory}`);
