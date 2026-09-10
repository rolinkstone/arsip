const bcrypt = require("bcrypt");

(async () => {
  const hash = await bcrypt.hash("passwordbaru123", 10); // ganti password
  console.log(hash);
})();
