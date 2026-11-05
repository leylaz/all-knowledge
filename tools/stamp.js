#!/usr/bin/env node
/* Cache busting: run `node tools/stamp.js` before committing a change to
   any script. It sets each local script's src in index.html to
   `<file>?v=<hash of its contents>`, so browsers fetch a script again
   whenever it changes instead of using a stale cached copy. check.js
   fails while any stamp is out of date. */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = path.join(__dirname, "..");
/* Line endings don't count, so a CRLF checkout gives the same stamps. */
const stamp = file => crypto.createHash("sha1")
  .update(fs.readFileSync(path.join(ROOT, file), "utf8").replace(/\r\n/g, "\n")).digest("hex").slice(0, 8);
module.exports = { stamp };

if (require.main === module) {
  const p = path.join(ROOT, "index.html");
  const html = fs.readFileSync(p, "utf8");
  const out = html.replace(/<script src="(?!https?:)([^"?]+)(?:\?v=[^"]*)?"><\/script>/g,
    (_, file) => `<script src="${file}?v=${stamp(file)}"></script>`);
  if (out !== html) fs.writeFileSync(p, out);
  console.log(out !== html ? "Updated script stamps in index.html." : "Script stamps already up to date.");
}
