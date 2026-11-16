import { z } from "zod";

export const explorationSchema = z
  .object({
    memoryId: z.string().min(1),
    visitedHotspots: z.array(z.string().min(1)).default([]),
    lastVisitedAt: z.number().int().nonnegative(),
  })
  .strict()
  .superRefine((exploration, ctx) => {
    const seen = new Set();
    exploration.visitedHotspots.forEach((hotspotId, index) => {
      if (seen.has(hotspotId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate visited hotspot: ${hotspotId}`,
          path: ["visitedHotspots", index],
        });
      }
      seen.add(hotspotId);
    });
  });

export const explorationPatchSchema = z
  .object({
    visitedHotspots: z.array(z.string().min(1)),
    lastVisitedAt: z.number().int().nonnegative(),
  })
  .strict()
  .partial();
