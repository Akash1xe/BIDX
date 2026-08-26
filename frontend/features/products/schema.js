import { z } from "zod";

export const PRODUCT_CONDITIONS = ["NEW", "LIKE_NEW", "USED", "REFURBISHED"];

export const productSchema = z.object({
  name: z.string().trim().min(2, "Enter a product name").max(200),
  description: z.string().trim().max(5000, "Description must be 5,000 characters or fewer"),
  category: z.string().trim().min(2, "Enter a category").max(80),
  condition: z.enum(PRODUCT_CONDITIONS),
  imageUrls: z.string().refine((value) => value.split(/\r?\n/).filter(Boolean).every((url) => {
    try { new URL(url.trim()); return true; } catch { return false; }
  }), "Enter one valid image URL per line"),
});

export function toProductPayload(values) {
  return {
    name: values.name.trim(),
    description: values.description.trim(),
    category: values.category.trim().toLowerCase(),
    condition: values.condition,
    images: values.imageUrls.split(/\r?\n/).map((url) => url.trim()).filter(Boolean),
  };
}
