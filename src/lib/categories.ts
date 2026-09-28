import {
  BrainCircuit,
  Boxes,
  Clapperboard,
  Database,
  Braces,
  Gamepad2,
  HardDrive,
  Wrench,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type CategoryMeta = {
  id: string;
  name: string;
  blurb: string;
  Icon: LucideIcon;
  /** 卡片辉光色，与站点深色底搭配，全部走低饱和霓虹。 */
  tint: string;
};

/**
 * 分区定义。id 必须与 db/data.csv「分区」列里的取值逐字一致 ——
 * CSV 是唯一数据源，这里只管展示名、说明与图标。
 */
export const CATEGORIES: CategoryMeta[] = [
  {
    id: "编程语言",
    name: "编程语言",
    blurb: "解释器、编译器与运行时：Python、Node.js、JDK 这类基础环境",
    Icon: Braces,
    tint: "#37e6d4",
  },
  {
    id: "开发工具",
    name: "开发工具",
    blurb: "代码编辑器与 IDE，写代码每天要用到的那几件",
    Icon: Wrench,
    tint: "#7aa2f7",
  },
  {
    id: "AI工具",
    name: "AI 工具",
    blurb: "AI 编程助手，以及能在本机跑起来的大模型工具",
    Icon: BrainCircuit,
    tint: "#c084fc",
  },
  {
    id: "计算机系统工具",
    name: "计算机系统工具",
    blurb: "压缩、秒搜、播放器、启动盘……重装电脑后的必备件",
    Icon: HardDrive,
    tint: "#f0b429",
  },
  {
    id: "虚拟机与容器",
    name: "虚拟机与容器",
    blurb: "把「在我电脑上能跑」变成一键复现的盒子",
    Icon: Boxes,
    tint: "#4ec9b0",
  },
  {
    id: "数据库",
    name: "数据库",
    blurb: "学 SQL、做后端要装的关系型数据库服务",
    Icon: Database,
    tint: "#6cb6ff",
  },
  {
    id: "图形与制作",
    name: "图形与制作",
    blurb: "三维建模与音视频处理这类创作工具",
    Icon: Clapperboard,
    tint: "#ff8b6b",
  },
  {
    id: "生活与游戏",
    name: "生活与游戏",
    blurb: "游戏平台与日常娱乐软件",
    Icon: Gamepad2,
    tint: "#8bd5a0",
  },
];

export function categoryById(id: string): CategoryMeta | undefined {
  return CATEGORIES.find((category) => category.id === id);
}

/** 首字母模式的分组键：英文名取首字母；数字/中文等归入 #。 */
export function initialOf(name: string): string {
  const first = name.trim()[0] ?? "";
  return /[a-zA-Z]/.test(first) ? first.toUpperCase() : "#";
}

export function groupByInitial<T>(items: T[], nameOf: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = initialOf(nameOf(item));
    const bucket = groups.get(key);
    if (bucket) {
      bucket.push(item);
    } else {
      groups.set(key, [item]);
    }
  }
  // 26 个字母在前，#（非字母开头）垫底；组内按名字排。
  const ordered = [...groups.entries()].sort(([a], [b]) => {
    if (a === "#") return 1;
    if (b === "#") return -1;
    return a.localeCompare(b);
  });
  for (const [, bucket] of ordered) bucket.sort((x, y) => nameOf(x).localeCompare(nameOf(y)));
  return new Map(ordered);
}
