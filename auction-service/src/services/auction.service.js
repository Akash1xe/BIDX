const { ApiError, KAFKA_TOPICS } = require("@bidx/shared");
const publisher = require("@bidx/shared/kafka/producer");
const auctionRepository = require("../repositories/auction.repository");
const productRepository = require("../repositories/product.repository");
const { publishCompletionEvents } = require("./completion.service");
const { AUCTION_STATUS, TRANSITIONS } = require("../models/auction.model");

async function safePublish(topic, data, key) {
  try {
    await publisher.publish(topic, data, { key });
  } catch (err) {
    console.error(`Event publish failed for ${topic}: ${err.message}`);
  }
}

function requireOwnership(auction, userId) {
  if (auction.sellerId.toString() !== String(userId)) {
    throw ApiError.forbidden("You do not own this auction");
  }
}

function assertTransition(from, to) {
  if (!TRANSITIONS[from] || !TRANSITIONS[from].includes(to)) {
    throw ApiError.conflict(`Invalid status transition: ${from} -> ${to}`);
  }
}

function parseDate(value, field) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw ApiError.badRequest(`Field '${field}' must be a valid date`);
  }
  return date;
}

class AuctionService {
  async create({ sellerId, productId, startingPrice, minimumIncrement, startTime, endTime }) {
    const product = await productRepository.findById(productId);
    if (!product) {
      throw ApiError.notFound("Product not found");
    }
    if (product.sellerId.toString() !== String(sellerId)) {
      throw ApiError.forbidden("You can only auction your own products");
    }

    const start = parseDate(startTime, "startTime");
    const end = parseDate(endTime, "endTime");
    const now = Date.now();
    if (start.getTime() < now - 5 * 60 * 1000) {
      throw ApiError.badRequest("startTime cannot be more than 5 minutes in the past");
    }
    if (end <= start) {
      throw ApiError.badRequest("endTime must be after startTime");
    }

    const price = Number(startingPrice);
    const increment = Number(minimumIncrement);
    if (!Number.isFinite(price) || price < 1) {
      throw ApiError.badRequest("startingPrice must be a positive number");
    }
    if (!Number.isFinite(increment) || increment < 1) {
      throw ApiError.badRequest("minimumIncrement must be a positive number");
    }

    const auction = await auctionRepository.create({
      productId: product._id,
      product: {
        name: product.name,
        description: product.description,
        images: product.images,
        category: product.category,
        condition: product.condition
      },
      sellerId: product.sellerId,
      startingPrice: price,
      minimumIncrement: increment,
      startTime: start,
      endTime: end,
      status: AUCTION_STATUS.DRAFT
    });

    await safePublish(
      KAFKA_TOPICS.AUCTION_CREATED,
      {
        auctionId: auction._id.toString(),
        productId: auction.productId.toString(),
        sellerId: auction.sellerId.toString(),
        name: auction.product.name,
        description: auction.product.description,
        images: auction.product.images,
        category: auction.product.category,
        condition: auction.product.condition,
        startingPrice: auction.startingPrice,
        minimumIncrement: auction.minimumIncrement,
        startTime: auction.startTime,
        endTime: auction.endTime,
        status: auction.status
      },
      auction._id.toString()
    );

    return auction.toPublic();
  }

  async getById(auctionId) {
    const auction = await auctionRepository.findById(auctionId);
    if (!auction) {
      throw ApiError.notFound("Auction not found");
    }
    return auction.toPublic();
  }

  async list({ status, sellerId, category, page, limit }) {
    const safePage = Math.max(1, parseInt(page || "1", 10));
    const safeLimit = Math.min(50, Math.max(1, parseInt(limit || "20", 10)));

    const query = {};
    if (status) {
      query.status = Array.isArray(status) ? { $in: status } : status;
    }
    if (sellerId) {
      query.sellerId = sellerId;
    }
    if (category) {
      query["product.category"] = String(category).toLowerCase();
    }

    const [items, total] = await Promise.all([
      auctionRepository.list({
        ...query,
        page: safePage,
        limit: safeLimit
      }),
      auctionRepository.count(query)
    ]);

    return {
      items: items.map((auction) => auction.toPublic()),
      pagination: { page: safePage, limit: safeLimit, total }
    };
  }

  async update(auctionId, userId, updates) {
    const auction = await auctionRepository.findById(auctionId);
    if (!auction) {
      throw ApiError.notFound("Auction not found");
    }
    requireOwnership(auction, userId);

    if (![AUCTION_STATUS.DRAFT, AUCTION_STATUS.SCHEDULED].includes(auction.status)) {
      throw ApiError.conflict("Only DRAFT or SCHEDULED auctions can be edited");
    }

    const allowed = {};
    if (updates.startingPrice !== undefined) {
      const price = Number(updates.startingPrice);
      if (!Number.isFinite(price) || price < 1) {
        throw ApiError.badRequest("startingPrice must be a positive number");
      }
      allowed.startingPrice = price;
    }
    if (updates.minimumIncrement !== undefined) {
      const increment = Number(updates.minimumIncrement);
      if (!Number.isFinite(increment) || increment < 1) {
        throw ApiError.badRequest("minimumIncrement must be a positive number");
      }
      allowed.minimumIncrement = increment;
    }
    if (updates.startTime !== undefined) {
      allowed.startTime = parseDate(updates.startTime, "startTime");
    }
    if (updates.endTime !== undefined) {
      allowed.endTime = parseDate(updates.endTime, "endTime");
    }
    if (Object.keys(allowed).length === 0) {
      throw ApiError.badRequest("No updatable fields provided");
    }

    const nextStart = allowed.startTime || auction.startTime;
    const nextEnd = allowed.endTime || auction.endTime;
    if (nextEnd <= nextStart) {
      throw ApiError.badRequest("endTime must be after startTime");
    }

    const updated = await auctionRepository.updateById(auctionId, allowed);

    await safePublish(
      KAFKA_TOPICS.AUCTION_UPDATED,
      {
        auctionId: updated._id.toString(),
        updatedFields: Object.keys(allowed),
        updates: allowed,
        status: updated.status
      },
      updated._id.toString()
    );

    return updated.toPublic();
  }

  async remove(auctionId, userId) {
    const auction = await auctionRepository.findById(auctionId);
    if (!auction) {
      throw ApiError.notFound("Auction not found");
    }
    requireOwnership(auction, userId);

    if (auction.status !== AUCTION_STATUS.DRAFT) {
      throw ApiError.conflict("Only DRAFT auctions can be deleted");
    }

    await auctionRepository.deleteById(auction._id);

    await safePublish(
      KAFKA_TOPICS.AUCTION_DELETED,
      { auctionId },
      auctionId
    );

    return { removed: true };
  }

  async start(auctionId, userId) {
    const auction = await auctionRepository.findById(auctionId);
    if (!auction) {
      throw ApiError.notFound("Auction not found");
    }
    requireOwnership(auction, userId);
    assertTransition(auction.status, AUCTION_STATUS.LIVE);

    if (auction.endTime.getTime() <= Date.now()) {
      throw ApiError.badRequest("endTime has already passed");
    }

    auction.startedAt = new Date();
    auction.status = AUCTION_STATUS.LIVE;
    await auction.save();

    await safePublish(
      KAFKA_TOPICS.AUCTION_STARTED,
      {
        auctionId: auction._id.toString(),
        startedAt: auction.startedAt,
        endTime: auction.endTime
      },
      auction._id.toString()
    );

    return auction.toPublic();
  }

  async end(auctionId, userId) {
    const auction = await auctionRepository.findById(auctionId);
    if (!auction) {
      throw ApiError.notFound("Auction not found");
    }
    requireOwnership(auction, userId);
    assertTransition(auction.status, AUCTION_STATUS.ENDED);

    const hasBids = auction.currentBid > 0 && auction.highestBidderId;
    auction.endedAt = new Date();
    auction.winningBidderId = hasBids ? auction.highestBidderId : null;
    auction.finalPrice = hasBids ? auction.currentBid : 0;
    auction.status = hasBids ? AUCTION_STATUS.ENDED : AUCTION_STATUS.UNSOLD;
    await auction.save();

    await publishCompletionEvents(auction);

    return auction.toPublic();
  }

  async history(auctionId) {
    const auction = await auctionRepository.findById(auctionId);
    if (!auction) {
      throw ApiError.notFound("Auction not found");
    }
    return {
      auctionId,
      note: "Bid history lives in the Bidding Service (Part 6)",
      items: []
    };
  }
}

module.exports = new AuctionService();
