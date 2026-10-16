import "dotenv/config";
import { getDb } from "../src/db";
import { seed } from "../src/db/seed";

seed(getDb())
  .then(() => {
    console.log("Seed complete");
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
