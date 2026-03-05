import pkg from 'pg';
const { Client } = pkg;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('❌ ERROR: No DATABASE_URL provided. Please set it as an environment variable.');
  process.exit(1);
}

console.log(`Testing connection to: ${connectionString.split('@')[1] || 'Unknown Host'}`);

const client = new Client({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

async function testConnection() {
  try {
    await client.connect();
    console.log('✅ Connection to database established successfully!');

    // Check if tables exist
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('submissions', 'files');
    `);

    const tables = result.rows.map(r => r.table_name);
    console.log(`Found tables: ${tables.join(', ') || 'None'}`);

    if (!tables.includes('submissions') || !tables.includes('files')) {
      console.log('❌ ERROR: Missing required tables! You need to run the CREATE TABLE commands.');
    } else {
      console.log('✅ Database schema looks correct.');
    }
  } catch (error) {
    console.error('❌ CONNECTION ERROR:', error.message);
  } finally {
    await client.end();
  }
}

testConnection();
