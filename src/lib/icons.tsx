import {
  si7zip,
  siAnaconda,
  siBlender,
  siCursor,
  siDocker,
  siEclipseadoptium,
  siFfmpeg,
  siGit,
  siIntellijidea,
  siLmstudio,
  siNodedotjs,
  siNotepadplusplus,
  siOllama,
  siPostgresql,
  siPycharm,
  siPython,
  siSteam,
  siTrae,
  siVlcmediaplayer,
} from "simple-icons";

type BrandIcon = { title: string; hex: string; path: string };

const PURE_BLACK = new Set(["000000", ""]);

// simple-icons v16 已移除微软系（VS Code / Visual Studio）以及 Qoder、
// Everything、Rufus 的图标，这几个走首字母兜底。
const REGISTRY: Record<string, BrandIcon> = {
  "Python 3.13": siPython as BrandIcon,
  Steam: siSteam as BrandIcon,
  "PyCharm Community": siPycharm as BrandIcon,
  "IntelliJ IDEA Community": siIntellijidea as BrandIcon,
  Trae: siTrae as BrandIcon,
  Cursor: siCursor as BrandIcon,
  Git: siGit as BrandIcon,
  "Node.js": siNodedotjs as BrandIcon,
  "Eclipse Temurin JDK": siEclipseadoptium as BrandIcon,
  "Docker Desktop": siDocker as BrandIcon,
  PostgreSQL: siPostgresql as BrandIcon,
  Anaconda: siAnaconda as BrandIcon,
  Ollama: siOllama as BrandIcon,
  "LM Studio": siLmstudio as BrandIcon,
  FFmpeg: siFfmpeg as BrandIcon,
  "VLC media player": siVlcmediaplayer as BrandIcon,
  "7-Zip": si7zip as BrandIcon,
  "Notepad++": siNotepadplusplus as BrandIcon,
  Blender: siBlender as BrandIcon,
};

const MONOGRAM_HUES = [168, 196, 262, 288, 42, 12];

function hueOf(name: string): number {
  let hash = 0;
  for (const ch of name) {
    hash = (hash * 31 + ch.codePointAt(0)!) % 9973;
  }
  return MONOGRAM_HUES[hash % MONOGRAM_HUES.length];
}

function monogramLetter(name: string): string {
  const cleaned = name.replace(/[^A-Za-z\u4e00-\u9fff0-9]/g, "");
  const digit = name.match(/\d/);
  if (digit && /^[0-9]/.test(name)) {
    return digit[0];
  }
  return (cleaned[0] ?? name[0] ?? "?").toUpperCase();
}

export function iconColor(name: string): { fill: string; glow: string } {
  const icon = REGISTRY[name];
  if (icon && !PURE_BLACK.has(icon.hex.toLowerCase())) {
    return { fill: `#${icon.hex}`, glow: `#${icon.hex}44` };
  }
  const hue = hueOf(name);
  return { fill: `hsl(${hue} 78% 66%)`, glow: `hsl(${hue} 78% 66% / 0.28)` };
}

export function IconGlyph({ name, size = 26 }: { name: string; size?: number }): React.ReactElement {
  const icon = REGISTRY[name];
  const { fill } = iconColor(name);

  if (icon) {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" role="presentation">
        <path d={icon.path} fill={fill} />
      </svg>
    );
  }

  const hue = hueOf(name);
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" role="presentation">
      <rect
        x="1.5"
        y="1.5"
        width="21"
        height="21"
        rx="6"
        fill={`hsl(${hue} 60% 16%)`}
        stroke={`hsl(${hue} 70% 55% / 0.55)`}
        strokeWidth="1.2"
      />
      <text
        x="12"
        y="16.6"
        textAnchor="middle"
        fontSize="11"
        fontWeight="700"
        fontFamily="ui-monospace, monospace"
        fill={fill}
      >
        {monogramLetter(name)}
      </text>
    </svg>
  );
}
