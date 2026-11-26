import { z } from 'zod';

const nullableString = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((val) => {
    if (val === null || val === undefined) return null;
    return String(val);
  });

const nullableScalar = z.union([z.string(), z.number(), z.null()]).optional();
const requiredNullableScalar = z.union([z.string(), z.number(), z.null()]);

export const PortalAwlListItemSchema = z
  .object({
    Grouping: z.string().nullable().optional(),
  })
  .passthrough();

export const PortalAwlListSchema = z.array(PortalAwlListItemSchema);

export const PortalStationMetaSchema = z
  .object({
    PieRecordID: z.string().min(1, 'PieRecordID wajib diisi'),
    estCode: nullableString.optional(),
    estCodeDesc: nullableString.optional(),
    Block: nullableString.optional(),
    Typeunit: nullableString.optional(),
    deviceId: nullableScalar,
    deviceName: nullableString.optional(),
    calibrasi: nullableScalar,
  })
  .passthrough();

export const PortalIotRecordSchema = z
  .object({
    PieRecordID: z.string().min(1),
    recordDate: nullableScalar,
    addTime: nullableScalar,
    valueFinal: requiredNullableScalar,
  })
  .passthrough();

export const PortalRainRecordSchema = z
  .object({
    Station_ID: nullableString.optional(),
    Date: nullableScalar,
    Tanggal: nullableScalar,
    ketinggian: nullableScalar,
    value: nullableScalar,
    EstCode: nullableString.optional(),
    estateBaru: nullableString.optional(),
    EstNewCode: nullableString.optional(),
  })
  .passthrough();

export const PortalManualRecordSchema = z
  .object({
    PieRecordID: z.string().min(1),
    Ketinggian: requiredNullableScalar,
    tglInput: nullableScalar,
    Date: nullableScalar,
    tgl: nullableScalar,
  })
  .passthrough();

export const PortalDatasetSchema = z.object({
  Table: z.array(PortalStationMetaSchema).default([]),
  Table1: z.array(z.unknown()).optional(),
  Table2: z.array(PortalIotRecordSchema).default([]),
  Table3: z.array(PortalRainRecordSchema).default([]),
  Table4: z.array(PortalManualRecordSchema).default([]),
});

export function parsePortalDatasetPayload(rawJson: unknown) {
  const parsed = PortalDatasetSchema.safeParse(rawJson);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const pathLabel = issue ? issue.path.join('.') : 'root';
    throw new Error(
      `Skema payload portal tidak sesuai pada "${pathLabel}": ${issue?.message ?? parsed.error.message}`
    );
  }
  return parsed.data;
}

export function parsePortalCoveragesPayload(rawJson: unknown): string[] {
  const parsed = PortalAwlListSchema.safeParse(rawJson);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(
      `Skema daftar coverage portal tidak valid: ${issue?.message ?? parsed.error.message}`
    );
  }
  const seen = new Set<string>();
  const coverages: string[] = [];
  for (const item of parsed.data) {
    const name = item.Grouping?.trim();
    if (name && !seen.has(name)) {
      seen.add(name);
      coverages.push(name);
    }
  }
  return coverages;
}
