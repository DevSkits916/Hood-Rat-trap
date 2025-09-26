import { z } from "zod";

export const clientPayloadSchema = z.object({
  consent: z.boolean().optional(),
  tz: z.string().max(100).optional(),
  lang: z.string().max(100).optional(),
  languages: z.array(z.string()).max(20).optional(),
  platform: z.string().max(120).optional(),
  ua: z.string().max(1024).optional(),
  vendor: z.string().max(256).optional(),
  hw: z
    .object({
      memoryGB: z.number().nonnegative().optional(),
      cores: z.number().int().nonnegative().optional()
    })
    .optional(),
  screen: z
    .object({
      width: z.number().int().positive().optional(),
      height: z.number().int().positive().optional(),
      availWidth: z.number().int().positive().optional(),
      availHeight: z.number().int().positive().optional(),
      colorDepth: z.number().int().positive().optional(),
      pixelRatio: z.number().positive().optional()
    })
    .optional(),
  ref: z.string().max(2048).optional()
});
