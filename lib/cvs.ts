import { z } from "zod";

export type CvVersion = {
  id: string;
  name: string;
  summary: string;
  skills: string;
  filePath?: string;
  fileName?: string;
  isDefault: boolean;
  createdAt: string;
};

export const cvInputSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(200),
  summary: z.string().trim().max(30000).default(""),
  skills: z.string().trim().max(8000).default(""),
  filePath: z.string().max(1000).nullable().optional(),
  fileName: z.string().max(255).nullable().optional(),
  fileSize: z.number().int().min(0).max(5 * 1024 * 1024).nullable().optional(),
  isDefault: z.boolean().default(false)
});

export type CvRow = {
  id: string; name: string; parsed_text: string | null; parsed_skills: string[];
  file_path: string | null; file_name: string | null; is_default: boolean; created_at: string;
};

export function toCvVersion(row: CvRow): CvVersion {
  return { id: row.id, name: row.name, summary: row.parsed_text ?? "", skills: (row.parsed_skills ?? []).join(", "),
    filePath: row.file_path ?? undefined, fileName: row.file_name ?? undefined, isDefault: row.is_default, createdAt: row.created_at };
}

export function isOwnCvPath(path: string | null | undefined, userId: string) {
  return !path || (path.startsWith(`${userId}/`) && !path.split("/").some((part) => part === ".." || part === "."));
}

export function parseLegacyCvs(raw: string | null, userId: string): CvVersion[] {
  if (!raw) return [];
  let rows: unknown;
  try { rows = JSON.parse(raw); } catch { return []; }
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row) => {
    const parsed = cvInputSchema.safeParse(row);
    if (!parsed.success || !parsed.data.id || !isOwnCvPath(parsed.data.filePath, userId)) return [];
    return [{ ...parsed.data, id: parsed.data.id, filePath: parsed.data.filePath ?? undefined,
      fileName: parsed.data.fileName ?? undefined, createdAt: typeof row.createdAt === "string" ? row.createdAt : "" }];
  });
}
