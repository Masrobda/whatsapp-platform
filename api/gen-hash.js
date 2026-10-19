const bcrypt = require('bcrypt');

async function generateHash() {
    const password = 'R123456789';
    const saltRounds = 12;
    const hash = await bcrypt.hash(password, saltRounds);
    console.log("Nouveau Hash :", hash);
}

generateHash();
