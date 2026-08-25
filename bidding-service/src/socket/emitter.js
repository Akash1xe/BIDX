let ioInstance = null;

function setIo(io) {
  ioInstance = io;
}

function getIo() {
  return ioInstance;
}

function bidRoom(auctionId) {
  return `auction:${auctionId}`;
}

function userRoom(userId) {
  return `user:${userId}`;
}

function emitBidNew(payload) {
  if (!ioInstance) return;
  ioInstance.to(bidRoom(payload.auctionId)).emit("bid:new", payload);
}

function emitBidOutbid(payload) {
  if (!ioInstance || !payload.previousHighestBidderId) return;
  ioInstance.to(userRoom(payload.previousHighestBidderId)).emit("bid:outbid", {
    auctionId: payload.auctionId,
    amount: payload.amount,
    bidderId: payload.bidderId
  });
}

module.exports = { setIo, getIo, bidRoom, userRoom, emitBidNew, emitBidOutbid };
