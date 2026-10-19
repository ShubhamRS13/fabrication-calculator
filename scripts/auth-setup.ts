import { hashPassword, newSecret } from "../src/lib/auth-core";

// Prints the .env lines for the login (step 0.3). Only the hash is stored, never the password.
//   npm run auth:setup -- <username> <password>
const [username, password] = process.argv.slice(2);
if (!username || !password) {
  console.error("Usage: npm run auth:setup -- <username> <password>");
  process.exit(1);
}
console.log(`AUTH_USERNAME="${username}"`);
console.log(`AUTH_PASSWORD_HASH="${hashPassword(password)}"`);
console.log(`AUTH_SECRET="${newSecret()}"`);
