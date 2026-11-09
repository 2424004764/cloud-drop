import {
  File,
  FileArchive,
  FileAudio,
  FileCode,
  FileImage,
  FileJson,
  FileSpreadsheet,
  FileText,
  FileVideo,
  type LucideIcon,
} from "lucide-react";
import type { FileKind } from "./types";

const TEXT_EXTS = new Set([
  "txt", "md", "markdown", "json", "jsonl", "ndjson", "csv", "tsv", "log",
  "yml", "yaml", "xml", "html", "htm", "css", "scss", "less", "js", "mjs",
  "cjs", "ts", "tsx", "jsx", "py", "rb", "go", "rs", "java", "c", "h", "cpp",
  "hpp", "cs", "php", "swift", "kt", "sh", "bat", "ps1", "sql", "ini", "toml",
  "conf", "env", "vue", "svelte", "astro", "dockerfile", "gitignore", "properties",
]);

const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico", "avif"]);

const ARCHIVE_EXTS = new Set(["zip", "rar", "7z", "tar", "gz", "tgz", "bz2", "xz", "zst"]);

const AUDIO_EXTS = new Set(["mp3", "wav", "flac", "ogg", "m4a", "aac"]);

const VIDEO_EXTS = new Set(["mp4", "mov", "webm", "avi", "mkv", "flv"]);

export function extOf(filename: string): string {
  const index = filename.lastIndexOf(".");
  return index > -1 ? filename.slice(index + 1).toLowerCase() : "";
}

export function isTextFile(filename: string): boolean {
  return TEXT_EXTS.has(extOf(filename));
}

export function isImageFile(filename: string): boolean {
  return IMAGE_EXTS.has(extOf(filename));
}

export function kindOf(filename: string): FileKind {
  const ext = extOf(filename);
  if (TEXT_EXTS.has(ext)) return "text";
  if (IMAGE_EXTS.has(ext)) return "image";
  if (ARCHIVE_EXTS.has(ext)) return "archive";
  if (ext === "pdf") return "pdf";
  if (AUDIO_EXTS.has(ext)) return "audio";
  if (VIDEO_EXTS.has(ext)) return "video";
  return "other";
}

interface KindMeta {
  label: string;
  icon: LucideIcon;
  /** 图标底色容器 */
  tile: string;
  /** 大图标颜色 */
  color: string;
}

const KIND_META: Record<FileKind, KindMeta> = {
  text: {
    label: "文本",
    icon: FileText,
    tile: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    color: "text-sky-500",
  },
  image: {
    label: "图片",
    icon: FileImage,
    tile: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    color: "text-emerald-500",
  },
  archive: {
    label: "压缩包",
    icon: FileArchive,
    tile: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    color: "text-amber-500",
  },
  pdf: {
    label: "PDF",
    icon: FileText,
    tile: "bg-red-500/10 text-red-600 dark:text-red-400",
    color: "text-red-500",
  },
  audio: {
    label: "音频",
    icon: FileAudio,
    tile: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
    color: "text-purple-500",
  },
  video: {
    label: "视频",
    icon: FileVideo,
    tile: "bg-pink-500/10 text-pink-600 dark:text-pink-400",
    color: "text-pink-500",
  },
  other: {
    label: "文件",
    icon: File,
    tile: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400",
    color: "text-zinc-500",
  },
};

const CODE_EXTS = new Set(["js", "mjs", "cjs", "ts", "tsx", "jsx", "py", "rb", "go", "rs", "java", "c", "h", "cpp", "hpp", "cs", "php", "swift", "kt", "vue", "svelte", "astro", "sh", "bat", "ps1", "sql"]);
const JSON_EXTS = new Set(["json", "jsonl", "ndjson"]);
const SHEET_EXTS = new Set(["csv", "tsv", "xls", "xlsx"]);

export function kindIconFor(filename: string): KindMeta {
  const kind = kindOf(filename);
  const ext = extOf(filename);
  if (kind === "text" && CODE_EXTS.has(ext)) {
    return { ...KIND_META.text, icon: FileCode, label: "代码" };
  }
  if (kind === "text" && JSON_EXTS.has(ext)) {
    return { ...KIND_META.text, icon: FileJson, label: "JSON" };
  }
  if (SHEET_EXTS.has(ext)) {
    return { ...KIND_META.other, icon: FileSpreadsheet, label: "表格" };
  }
  return KIND_META[kind];
}

/** 图片缩略图大小限制（超过则显示图标，避免拉取大图） */
export const IMAGE_THUMB_MAX_BYTES = 8 * 1024 * 1024;
