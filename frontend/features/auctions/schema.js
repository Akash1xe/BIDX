import { z } from "zod";

const positiveMoney = z.coerce.number().positive("Enter a positive amount");
const dateTime = z.string().min(1, "Choose a date and time");

const auctionFields = z.object({
  productId: z.string().trim().min(12, "Enter the product ID returned by BidX"),
  startingPrice: positiveMoney,
  minimumIncrement: positiveMoney,
  startTime: dateTime,
  endTime: dateTime,
});

function validWindow(schema) {
  return schema.refine((values) => new Date(values.endTime) > new Date(values.startTime), {
  message: "End time must be after start time",
  path: ["endTime"],
  });
}

export const createAuctionSchema = validWindow(auctionFields);
export const updateAuctionSchema = validWindow(auctionFields.omit({ productId: true }));

export function toAuctionPayload(values) {
  return {
    ...(values.productId ? { productId: values.productId.trim() } : {}),
    startingPrice: Number(values.startingPrice),
    minimumIncrement: Number(values.minimumIncrement),
    startTime: new Date(values.startTime).toISOString(),
    endTime: new Date(values.endTime).toISOString(),
  };
}
