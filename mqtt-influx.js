require('dotenv').config();
const mqtt = require('mqtt');
const { InfluxDB, Point } = require('@influxdata/influxdb-client');

const MQTT_URL = 'mqtt://localhost:1883';
const MQTT_TOPIC = 'application/+/device/+/event/up';

// InfluxDB
const influx = new InfluxDB({
  url: process.env.INFLUX_URL,
  token: process.env.INFLUX_TOKEN
});

const queryApi = influx.getQueryApi(process.env.INFLUX_ORG);
const writeApi = influx.getWriteApi(
  process.env.INFLUX_ORG,
  process.env.INFLUX_BUCKET
);

//MySql
const mysql = require('mysql2/promise');

const db = mysql.createPool({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  port: process.env.MYSQL_PORT
});


// MQTT
const client = mqtt.connect(MQTT_URL);

client.on('connect', () => {
  console.log('✅ MQTT connected');
  client.subscribe(MQTT_TOPIC);
});

/**
 * Check if sensor exists
 */
async function sensorExists(devEUI) {
  const [rows] = await db.query(
    `SELECT id FROM sensors WHERE devEUI = ? LIMIT 1`,
    [devEUI]
  );
  return rows.length > 0;
}


client.on('message', async (topic, message) => {
  try {
    const payload = JSON.parse(message.toString());

    const devEUI = payload.deviceInfo?.devEui;
    const deviceName = payload.deviceInfo?.deviceName;
    const data = payload.object;

    if (!devEUI || !data || Object.keys(data).length === 0) {
      console.log('⚠️ Empty payload, skipping');
      return;
    }

    const exists = await sensorExists(devEUI);
    if (!exists) {
      console.log(`⛔ Ignored unregistered device: ${devEUI}`);
      return;
    }

    // ONE point per uplink
    const point = new Point('sensor_data')
      .tag('devEUI', devEUI)
      .tag('deviceName', deviceName);

    let hasValidField = false;

    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'number' && !Number.isNaN(value)) {
        point.floatField(key, value);
        hasValidField = true;
      } else if (typeof value === 'boolean') {
        point.booleanField(key, value);
        hasValidField = true;
      } else if (value !== null && value !== undefined) {
        point.stringField(key, String(value));
        hasValidField = true;
      }
    }

    if (!hasValidField) {
      console.log(`⚠️ No valid fields for ${devEUI}, skipped`);
      return;
    }

    writeApi.writePoint(point);
    await writeApi.flush();

    console.log(`✅ Data written for ${devEUI}`);

  } catch (err) {
    console.error('❌ MQTT processing error:', err.message);
  }
});
