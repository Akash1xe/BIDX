const mongoose = require("mongoose");

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error("usage: node scripts/promote-admin.js <email>");
    process.exit(1);
  }
  await mongoose.connect("mongodb://localhost:27017/bidx_users");
  const result = await mongoose.connection
    .collection("users")
    .updateOne({ email }, { $set: { role: "ADMIN" } });
  console.log(`promote matched=${result.matchedCount} modified=${result.modifiedCount}`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
