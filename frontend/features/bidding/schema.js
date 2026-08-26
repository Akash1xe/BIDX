import { z } from "zod";

export function createBidSchema(minimum) {
  return z.object({
    amount: z.coerce.number().int("Bid must be a whole number").min(minimum, `Bid must be at least ₹${minimum.toLocaleString("en-IN")}`),
  });
}

