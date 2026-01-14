require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { InfluxDB, Point } = require('@influxdata/influxdb-client');
const path = require('path');
const app = express();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { JWT_SECRET, authMiddleware, requirePanchayatAdmin } = require('./auth');



//const PORT = 8181;

// ==================== INFLUXDB CONFIGURATION ====================
const INFLUX_CONFIG = {
  url: process.env.INFLUX_URL || 'https://us-east-1-1.aws.cloud2.influxdata.com',
  token: process.env.INFLUX_TOKEN, // FROM ENVIRONMENT
  org: process.env.INFLUX_ORG || 'NIl',
  bucket: process.env.INFLUX_BUCKET || 'smart_panchayat'
};

const PORT = process.env.PORT || 8181;
// Initialize InfluxDB clients
const influxDB = new InfluxDB({ url: INFLUX_CONFIG.url, token: INFLUX_CONFIG.token });
const writeApi = influxDB.getWriteApi(INFLUX_CONFIG.org, INFLUX_CONFIG.bucket);
const queryApi = influxDB.getQueryApi(INFLUX_CONFIG.org);


// ==================== MYSQL CONFIGURATION ====================
const mysql = require('mysql2/promise');

const db = mysql.createPool({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  port: process.env.MYSQL_PORT,
});


// ==================== MIDDLEWARE ====================

console.log('Influx env check:', {
  url: process.env.INFLUX_URL,
  org: process.env.INFLUX_ORG,
  bucket: process.env.INFLUX_BUCKET,
  tokenLoaded: !!process.env.INFLUX_TOKEN
});



// Update CORS middleware to allow mobile access
app.use(cors({
  origin: '*',  // Allow ALL origins for now (for testing)
  credentials: false,  // Must be false when using '*'
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
  }
  next();
});

app.use(express.json());

// Log all requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// ==================== HELPER FUNCTIONS ====================

// Query InfluxDB helper
async function queryInfluxDB(fluxQuery) {
  try {
    const result = await queryApi.collectRows(fluxQuery);
    return result || [];
  } catch (error) {
    console.error('❌ Query error:', error.message);
    return [];
  }
}

// Write to InfluxDB helper
async function writeToInfluxDB(measurement, tags, fields) {
  try {
    const point = new Point(measurement);

    // Add tags
    Object.entries(tags).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        point.tag(key, value.toString());
      }
    });

    // Add fields
    Object.entries(fields).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        point.stringField(key, value.toString());
      }
    });

    writeApi.writePoint(point);
    await writeApi.flush();
    console.log(`✅ Written to InfluxDB`);
    return true;
  } catch (error) {
    console.error('❌ Write error:', error.message);
    return false;
  }
}

// Get all fields for a specific villager


async function getActiveSensors() {
  const query = `
    from(bucket: "${INFLUX_CONFIG.bucket}")
      |> range(start: -5m)
      |> filter(fn: (r) => r._measurement == "sensor_data")
      |> keep(columns: ["devEUI"])
      |> group(columns: ["devEUI"])
  `;

  const rows = await queryInfluxDB(query);
  const unique = new Set(rows.map(r => r.devEUI));
  return Array.from(unique);
}


const SENSOR_ACTIVE_THRESHOLD = 20; // seconds

async function getActiveSensorCount() {
  const query = `
    from(bucket: "${INFLUX_CONFIG.bucket}")
      |> range(start: -5m)
      |> filter(fn: (r) => r._measurement == "sensor_data")
      |> group(columns: ["devEUI"])
      |> sort(columns: ["_time"], desc: true)
      |> limit(n: 1)
      |> keep(columns: ["devEUI", "_time"])
  `;

  const rows = await queryInfluxDB(query);
  const now = Date.now();

  return rows.filter(r => {
    const diffSeconds =
      (now - new Date(r._time).getTime()) / 1000;
    return diffSeconds <= SENSOR_ACTIVE_THRESHOLD;
  }).length;
}

//panchayath admin
function resolvePanchayatId(req) {
  // Panchayat admin → forced
  if (req.user.role === 'panchayat_admin') {
    return req.user.panchayatId;
  }

  // Higher admins → from query
  return req.query.panchayatId;
}




// ==================== API ROUTES ====================

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({
    success: true,
    message: 'API is working!',
    timestamp: new Date().toISOString()
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Smart Panchayat Backend is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// ==================== VILLAGER MANAGEMENT ====================

// Get all villagers - WITH PHONE NUMBERS
app.get('/api/villagers', authMiddleware, async (req, res) => {
  try {
    const panchayatId = resolvePanchayatId(req);
    if (!panchayatId) {
      return res.status(400).json({ error: 'panchayatId required' });
    }

    const [rows] = await db.query(
      `SELECT 
         id,
         aadhaar AS aadhaar_number,
         name,
         phone,
         village,
         panchayat
       FROM villagers
       WHERE panchayat_id = ?
       ORDER BY created_at DESC`,
      [panchayatId]
    );

    res.json({ success: true, villagers: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});



// Get a specific villager - WITH ALL FIELDS
app.get('/api/villagers/:aadhaarNumber', authMiddleware, async (req, res) => {
  try {
    const { aadhaarNumber } = req.params;

    const [[villager]] = await db.query(
      `SELECT 
         id,
         aadhaar AS aadhaar_number,
         name,
         phone,
         village,
         panchayat,
         panchayat_id,
         occupation,
         address
       FROM villagers
       WHERE aadhaar = ?`,
      [aadhaarNumber]
    );

    if (!villager) {
      return res.status(404).json({
        success: false,
        error: 'Villager not found'
      });
    }

    // 🔐 Panchayat isolation check
    const allowedPanchayat = resolvePanchayatId(req);
    if (villager.panchayat_id !== allowedPanchayat) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // 🧹 Do not leak panchayat_id to frontend
    delete villager.panchayat_id;

    res.json({
      success: true,
      villager
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});


// Add new villager
app.post(
  '/api/villagers',
  authMiddleware,
  requirePanchayatAdmin,
  async (req, res) => {
    try {
      const { aadhaarNumber, name, phone, village, occupation, address } = req.body;

      // 🔐 Panchayat forced from JWT
      const panchayatId = req.user.panchayatId;

      if (!aadhaarNumber || !name || !phone || !village || !panchayatId) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields'
        });
      }

      await db.query(
        `INSERT INTO villagers
         (aadhaar, name, phone, village, panchayat_id, occupation, address)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [aadhaarNumber, name, phone, village, panchayatId, occupation, address]
      );

      res.json({
        success: true,
        message: 'Villager added successfully'
      });

    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({
          success: false,
          error: 'Aadhaar or phone already exists'
        });
      }
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  }
);


// Delete a villager
app.delete(
  '/api/villagers/:aadhaarNumber',
  authMiddleware,
  requirePanchayatAdmin,
  async (req, res) => {
    try {
      const { aadhaarNumber } = req.params;
      const panchayatId = req.user.panchayatId;

      // 1️⃣ Ensure villager exists AND belongs to this panchayat
      const [[villager]] = await db.query(
        `SELECT id FROM villagers
         WHERE aadhaar = ? AND panchayat_id = ?`,
        [aadhaarNumber, panchayatId]
      );

      if (!villager) {
        return res.status(403).json({
          success: false,
          error: 'Villager not found or access denied'
        });
      }

      // 2️⃣ Delete villager safely
      await db.query(
        `DELETE FROM villagers
         WHERE aadhaar = ? AND panchayat_id = ?`,
        [aadhaarNumber, panchayatId]
      );

      res.json({
        success: true,
        message: 'Villager deleted successfully'
      });

    } catch (err) {
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  }
);




// Update a villager
app.put(
  '/api/villagers/:aadhaarNumber',
  authMiddleware,
  requirePanchayatAdmin,
  async (req, res) => {
    try {
      const { aadhaarNumber } = req.params;
      const { name, phone, village, occupation, address } = req.body;

      // 🔐 Panchayat forced from JWT
      const panchayatId = req.user.panchayatId;

      // 1️⃣ Ensure villager exists AND belongs to this panchayat
      const [[villager]] = await db.query(
        `SELECT id FROM villagers
         WHERE aadhaar = ? AND panchayat_id = ?`,
        [aadhaarNumber, panchayatId]
      );

      if (!villager) {
        return res.status(403).json({
          success: false,
          error: 'Villager not found or access denied'
        });
      }

      // 2️⃣ Update villager (panchayat NEVER updated from body)
      await db.query(
        `UPDATE villagers
         SET name = ?, phone = ?, village = ?, occupation = ?, address = ?
         WHERE aadhaar = ? AND panchayat_id = ?`,
        [name, phone, village, occupation, address, aadhaarNumber, panchayatId]
      );

      res.json({
        success: true,
        message: 'Villager updated successfully'
      });

    } catch (err) {
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  }
);



//to see sensors that belong to particular villager
app.get('/api/villagers/:aadhaar/sensors', authMiddleware, async (req, res) => {
  try {
    const { aadhaar } = req.params;

    // 1️⃣ Get villager (MUST include panchayat_id)
    const [[villager]] = await db.query(
      `SELECT id, name, aadhaar, phone, village, panchayat_id
       FROM villagers
       WHERE aadhaar = ?`,
      [aadhaar]
    );

    if (!villager) {
      return res.status(404).json({
        success: false,
        error: 'Villager not found'
      });
    }

    // 🔐 2️⃣ PANCHAYAT SECURITY CHECK (THIS LINE)
    const allowedPanchayat = resolvePanchayatId(req);
    if (villager.panchayat_id !== allowedPanchayat) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // 3️⃣ Get mapped sensors
    const [sensors] = await db.query(
      `SELECT s.id, s.devEUI, s.name
       FROM sensors s
       JOIN villager_sensors vs ON vs.sensor_id = s.id
       WHERE vs.villager_id = ?`,
      [villager.id]
    );

    // 4️⃣ Fetch latest sensor data
    const result = [];

    for (const sensor of sensors) {
      const flux = `
        from(bucket: "${INFLUX_CONFIG.bucket}")
          |> range(start: -1h)
          |> filter(fn: (r) => r._measurement == "sensor_data")
          |> filter(fn: (r) => r.devEUI == "${sensor.devEUI}")
          |> sort(columns: ["_time"], desc: true)
          |> limit(n: 1)
      `;

      const data = await queryInfluxDB(flux);

      result.push({
        devEUI: sensor.devEUI,
        name: sensor.name,
        status: data.length ? 'Live' : 'Offline'
      });
    }

    res.json({
      success: true,
      villager,
      sensors: result
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});


// ==================== ADMIN DASHBOARD ====================

app.get('/api/admin/dashboard', authMiddleware, async (req, res) => {
  try {
    const panchayatId = resolvePanchayatId(req);
    if (!panchayatId) {
      return res.status(400).json({ error: 'panchayatId required' });
    }

    const [[{ totalVillagers }]] = await db.query(
      `SELECT COUNT(*) AS totalVillagers
       FROM villagers
       WHERE panchayat_id = ?`,
      [panchayatId]
    );

    const totalSensors = await getActiveSensorCount();

    res.json({
      success: true,
      data: {
        statistics: {
          totalVillagers,
          totalSensors,
          totalVillages: 1,
          activeAlerts: 0
        }
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});



// ==================== OTHER ENDPOINTS ====================

app.get('/api/sensors', authMiddleware, async (req, res) => {
  try {
    const panchayatId = resolvePanchayatId(req);
    if (!panchayatId) {
      return res.status(400).json({ error: 'panchayatId required' });
    }

    const [sensorRows] = await db.query(
      `SELECT id, devEUI, name
       FROM sensors
       WHERE panchayat_id = ?
       ORDER BY id DESC`,
      [panchayatId]
    );

    const sensors = [];

    for (const sensor of sensorRows) {
      const flux = `
        from(bucket: "${INFLUX_CONFIG.bucket}")
          |> range(start: -1h)
          |> filter(fn: (r) => r._measurement == "sensor_data")
          |> filter(fn: (r) => r.devEUI == "${sensor.devEUI}")
          |> sort(columns: ["_time"], desc: true)
          |> limit(n: 1)
      `;

      const data = await queryInfluxDB(flux);

      sensors.push({
        ...sensor,
        status: data.length ? 'Live' : 'Offline'
      });
    }

    res.json({ success: true, sensors });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});


// GET single sensor (for edit)
app.get(
  '/api/sensors/:devEUI',
  authMiddleware,
  async (req, res) => {

    const { devEUI } = req.params;
    const panchayatId = resolvePanchayatId(req);

    const [[sensor]] = await db.query(
      `SELECT s.id, s.devEUI, s.name, s.village,
              v.phone, s.panchayat_id
       FROM sensors s
       LEFT JOIN villager_sensors vs ON vs.sensor_id = s.id
       LEFT JOIN villagers v ON v.id = vs.villager_id
       WHERE s.devEUI = ?`,
      [devEUI]
    );

    if (!sensor || sensor.panchayat_id !== panchayatId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    delete sensor.panchayat_id;

    res.json({ success: true, sensor });
  }
);


// UPDATE sensor (edit)
app.put(
  '/api/sensors/:devEUI',
  authMiddleware,
  requirePanchayatAdmin,
  async (req, res) => {

    const { devEUI } = req.params;
    const { deviceName, village, phone } = req.body;

    const panchayatId = req.user.panchayatId;
    const conn = await db.getConnection();

    try {
      await conn.beginTransaction();

      // 1️⃣ Ensure sensor exists AND belongs to this panchayat
      const [[sensor]] = await conn.query(
        `SELECT id FROM sensors
         WHERE devEUI = ? AND panchayat_id = ?`,
        [devEUI, panchayatId]
      );

      if (!sensor) {
        throw new Error('Sensor not found or access denied');
      }

      // 2️⃣ Update sensor metadata (NO panchayat change)
      await conn.query(
        `UPDATE sensors
         SET name = ?, village = ?
         WHERE devEUI = ? AND panchayat_id = ?`,
        [deviceName, village || null, devEUI, panchayatId]
      );

      // 3️⃣ Remove existing mapping
      await conn.query(
        `DELETE FROM villager_sensors WHERE sensor_id = ?`,
        [sensor.id]
      );

      // 4️⃣ OPTIONAL: map to villager (same panchayat only)
      if (phone) {
        const [[villager]] = await conn.query(
          `SELECT id FROM villagers
           WHERE phone = ? AND panchayat_id = ?`,
          [phone, panchayatId]
        );

        if (!villager) {
          throw new Error(
            'Villager not found in this panchayat'
          );
        }

        await conn.query(
          `INSERT INTO villager_sensors (villager_id, sensor_id)
           VALUES (?, ?)`,
          [villager.id, sensor.id]
        );
      }

      await conn.commit();

      res.json({
        success: true,
        message: 'Sensor updated successfully'
      });

    } catch (err) {
      await conn.rollback();
      res.status(400).json({
        success: false,
        error: err.message
      });
    } finally {
      conn.release();
    }
  }
);




app.post(
  '/api/sensors',
  authMiddleware,
  requirePanchayatAdmin,
  async (req, res) => {

    const { devEUI, deviceName, village, phone } = req.body;

    if (!devEUI || !deviceName) {
      return res.status(400).json({
        success: false,
        error: 'devEUI and deviceName are required'
      });
    }

    // 🔐 Panchayat enforced from JWT
    const panchayatId = req.user.panchayatId;

    const conn = await db.getConnection();

    try {
      await conn.beginTransaction();

      // 1️⃣ Insert sensor (panchayat fixed)
      const [sensorResult] = await conn.query(
        `INSERT INTO sensors (devEUI, name, village, panchayat_id)
         VALUES (?, ?, ?, ?)`,
        [devEUI, deviceName, village || null, panchayatId]
      );

      const sensorId = sensorResult.insertId;

      // 2️⃣ OPTIONAL: map sensor → villager (same panchayat only)
      if (phone) {
        const [[villager]] = await conn.query(
          `SELECT id FROM villagers
           WHERE phone = ? AND panchayat_id = ?`,
          [phone, panchayatId]
        );

        if (!villager) {
          throw new Error(
            'Villager not found in this panchayat'
          );
        }

        await conn.query(
          `INSERT INTO villager_sensors (villager_id, sensor_id)
           VALUES (?, ?)`,
          [villager.id, sensorId]
        );
      }

      await conn.commit();

      res.json({
        success: true,
        message: phone
          ? 'Sensor registered and mapped to villager'
          : 'Sensor registered successfully'
      });

    } catch (err) {
      await conn.rollback();

      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({
          success: false,
          error: 'Sensor already exists'
        });
      }

      res.status(400).json({
        success: false,
        error: err.message
      });

    } finally {
      conn.release();
    }
  }
);

app.delete(
  '/api/sensors/:devEUI',
  authMiddleware,
  requirePanchayatAdmin,
  async (req, res) => {

    const { devEUI } = req.params;
    const panchayatId = req.user.panchayatId;

    if (!devEUI) {
      return res.status(400).json({
        success: false,
        error: 'devEUI is required'
      });
    }

    const conn = await db.getConnection();

    try {
      await conn.beginTransaction();

      // 1️⃣ Ensure sensor exists AND belongs to this panchayat
      const [[sensor]] = await conn.query(
        `SELECT id FROM sensors
         WHERE devEUI = ? AND panchayat_id = ?`,
        [devEUI, panchayatId]
      );

      if (!sensor) {
        return res.status(403).json({
          success: false,
          error: 'Sensor not found or access denied'
        });
      }

      // 2️⃣ Remove mappings
      await conn.query(
        `DELETE FROM villager_sensors WHERE sensor_id = ?`,
        [sensor.id]
      );

      // 3️⃣ Delete sensor
      await conn.query(
        `DELETE FROM sensors
         WHERE id = ? AND panchayat_id = ?`,
        [sensor.id, panchayatId]
      );

      await conn.commit();

      res.json({
        success: true,
        message: 'Sensor deleted successfully'
      });

    } catch (err) {
      await conn.rollback();
      res.status(500).json({
        success: false,
        error: err.message
      });
    } finally {
      conn.release();
    }
  }
);



app.post('/api/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Username and password are required'
      });
    }

    // 1️⃣ Find user
    const [[user]] = await db.query(
      'SELECT * FROM users WHERE username = ?',
      [username]
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // 2️⃣ Verify password
    const passwordMatch = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // 3️⃣ Generate JWT
    const token = jwt.sign(
      {
        id: user.id,
        role: user.role,
        districtId: user.district_id,
        blockId: user.block_id,
        panchayatId: user.panchayat_id
      },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      success: true,
      token,
      role: user.role,
      districtId: user.district_id,
      blockId: user.block_id,
      panchayatId: user.panchayat_id
    });
    

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});


app.get('/api/me', authMiddleware, (req, res) => {
  res.json({
    id: req.user.id,
    role: req.user.role,
    districtId: req.user.districtId,
    blockId: req.user.blockId,
    panchayatId: req.user.panchayatId
  });
});



//Location
app.get('/api/districts', authMiddleware, async (_, res) => {
  const [r] = await db.query("SELECT id,name FROM locations WHERE type='DISTRICT'");
  res.json(r);
});

app.get('/api/blocks', authMiddleware, async (req, res) => {
  const districtId =
    req.user.role === 'district_admin'
      ? req.user.districtId
      : req.query.districtId;

  const [r] = await db.query(
    "SELECT id,name FROM locations WHERE type='BLOCK' AND parent_id=?",
    [districtId]
  );

  res.json(r);
});


app.get('/api/panchayats', authMiddleware, async (req, res) => {
  const blockId =
    req.user.role === 'block_admin'
      ? req.user.blockId
      : req.query.blockId;

  const [r] = await db.query(
    "SELECT id,name FROM locations WHERE type='PANCHAYAT' AND parent_id=?",
    [blockId]
  );

  res.json(r);
});



// Debug endpoint
app.get(
  '/api/debug/raw',
  authMiddleware,
  async (req, res) => {
    try {
      // 🔐 Allow ONLY state admin
      if (req.user.role !== 'state_admin') {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }

      const query = `
        from(bucket: "${INFLUX_CONFIG.bucket}")
          |> range(start: -1h)
          |> filter(fn: (r) => true)
          |> limit(n: 50)
      `;

      const result = await queryInfluxDB(query);

      res.json({
        success: true,
        data: result,
        count: result.length,
        message: 'All raw data from InfluxDB'
      });

    } catch (error) {
      console.error('Debug raw error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);




// ==================== SERVING HTML PAGES ====================

// Serve static files from public directory
app.use(express.static('public'));

// Serve admin page
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ==================== API 404 HANDLER ====================

app.use('/api', (req, res) => {
  res.status(404).json({
    success: false,
    error: `API endpoint not found: ${req.method} ${req.originalUrl}`
  });
});

// ==================== ERROR HANDLER ====================

app.use((err, req, res, next) => {
  console.error('❌ Server error:', err.message);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: err.message
  });
});

// ==================== START SERVER ====================

app.listen(PORT, () => {
  console.log('🚀 Smart Panchayat Backend');
  console.log('══════════════════════════════════════════════════════');
  console.log(`📡 Server: http://localhost:${PORT}`);
  console.log(`🔧 API:    http://localhost:${PORT}/api`);
  console.log(`🏠 Admin:  http://localhost:${PORT}/admin`);
  console.log('══════════════════════════════════════════════════════');
  console.log('✅ Available API Endpoints:');
  console.log('   GET  /api/test');
  console.log('   GET  /api/health');
  console.log('   GET  /api/villagers (with phone numbers)');
  console.log('   POST /api/villagers');
  console.log('   GET  /api/villagers/:aadhaarNumber');
  console.log('   PUT  /api/villagers/:aadhaarNumber');
  console.log('   DELETE /api/villagers/:aadhaarNumber');
  console.log('   GET  /api/admin/dashboard (with phone numbers)');
  console.log('   GET  /api/debug/raw');
  console.log('══════════════════════════════════════════════════════');
});