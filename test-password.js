const bcrypt = require("bcryptjs");

const password = "admin123";

const hash = "$2b$12$BbNNJjhMlTNiGkKeuNRRi.R/Hj98YAIHo4btY9xuq3QRr6p/Vgu2O";

const hasil = bcrypt.compareSync(password, hash);

console.log("Password cocok:", hasil);