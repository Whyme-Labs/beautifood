import { z } from "zod";
import { ALLERGENS } from "../shared/allergens";

export const ModifierGroup = z.object({
  name: z.string().min(1).max(30),
  min: z.number().int().min(0).max(10),
  max: z.number().int().min(0).max(20),
  options: z.array(z.object({ name: z.string().min(1).max(40), price: z.number().int().min(0) })).min(1).max(30),
});

export const ItemInput = z.object({
  categoryId: z.string(),
  name: z.string().trim().min(1).max(80),
  description: z.string().max(500).optional(),
  price: z.number().int().min(0).max(10_000_000),
  imageUrl: z.string().url().nullable().optional(),
  allergens: z.array(z.enum(ALLERGENS)).optional(),
  dietary: z.array(z.string().max(30)).max(10).optional(),
  spiceLevel: z.number().int().min(0).max(3).optional(),
  story: z.string().max(1000).optional(),
  isSignature: z.boolean().optional(),
  tags: z.array(z.string().max(30)).max(10).optional(),
  station: z.enum(["kitchen", "bar", "dessert"]).optional(),
  modifiers: z.array(ModifierGroup).max(10).optional(),
  active: z.boolean().optional(),
  sort: z.number().int().optional(),
});
