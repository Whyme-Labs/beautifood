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
  /** Timed menus it is served on; [] = all day; omitted = unchanged. */
  menuIds: z.array(z.string().max(40)).max(20).optional(),
});

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM");
export const Window = z.object({ days: z.array(z.number().int().min(0).max(6)).min(1).max(7), from: hhmm, to: hhmm }).strict();
const Branches = z.array(z.string().max(40)).max(50);

export const TimedMenuInput = z
  .object({
    id: z.string().max(40).optional(),
    name: z.string().trim().min(1).max(40),
    windows: z.array(Window).min(1).max(14),
    branches: Branches.default(["*"]),
    active: z.boolean().optional(),
    sort: z.number().int().optional(),
  })
  .strict();

export const PriceRuleInput = z
  .object({
    id: z.string().max(40).optional(),
    name: z.string().trim().min(1).max(40),
    kind: z.enum(["percent", "amount"]),
    value: z.number().positive(),
    categories: z.array(z.string().max(40)).max(50).default([]),
    items: z.array(z.string().max(40)).max(200).default([]),
    windows: z.array(Window).min(1).max(14),
    branches: Branches.default(["*"]),
    active: z.boolean().optional(),
  })
  .strict()
  .refine((r) => r.kind !== "percent" || r.value < 100, { message: "A percentage must be under 100", path: ["value"] });
