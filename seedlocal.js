const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

(async () => {
  const db = await mysql.createPool({
    host: 'localhost',          // 🔁 changed
    user: 'root',               // 🔁 changed
    password: '@Robin03',  // 🔁 changed
    database: 'smart_panchayat',// 🔁 changed
    port: 3306,                 // 🔁 changed
    ssl: false                  // 🔁 changed (local MySQL)
  });

  console.log('✅ Connected to local MySQL');

  // ⚠️ Clear existing users
  await db.query('DELETE FROM users');

  // 1️⃣ Insert STATE ADMIN
  const stateHash = await bcrypt.hash('state_admin', 10);
  await db.query(
    `INSERT INTO users (username, password_hash, role)
     VALUES (?, ?, ?)`,
    ['state_admin', stateHash, 'state_admin']
  );

  console.log('✅ State admin created');

  // 2️⃣ Fetch all locations
  const [locations] = await db.query(
    `SELECT id, name, type, parent_id FROM locations`
  );

  for (const loc of locations) {
    let role = null;
    let districtId = null;
    let blockId = null;
    let panchayatId = null;

    if (loc.type === 'DISTRICT') {
      role = 'district_admin';
      districtId = loc.id;
    }

    if (loc.type === 'BLOCK') {
      role = 'block_admin';
      blockId = loc.id;
      districtId = loc.parent_id;
    }

    if (loc.type === 'PANCHAYAT') {
      role = 'panchayat_admin';
      panchayatId = loc.id;

      const [[block]] = await db.query(
        `SELECT parent_id FROM locations WHERE id = ?`,
        [loc.parent_id]
      );

      blockId = loc.parent_id;
      districtId = block.parent_id;
    }

    if (!role) continue;

    const passwordHash = await bcrypt.hash(loc.name, 10);

    await db.query(
      `INSERT INTO users
       (username, password_hash, role, district_id, block_id, panchayat_id)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        loc.name,
        passwordHash,
        role,
        districtId,
        blockId,
        panchayatId
      ]
    );
  }

  console.log('✅ All users seeded successfully');
  process.exit(0);
})();

