// Test Supabase connection
import pkg from 'pg'

const { Pool } = pkg

const pool = new Pool({
  connectionString: 'postgresql://postgres:Midebobo123%23@db.kkuwgmttbekyxsvpmrrw.supabase.co:5432/postgres',
  ssl: { rejectUnauthorized: false }
})

async function testConnection() {
  try {
    const client = await pool.connect()
    console.log('✅ Connected to Supabase successfully!')
    
    // Test a simple query
    const result = await client.query('SELECT NOW()')
    console.log('✅ Query successful:', result.rows[0])
    
    client.release()
    await pool.end()
  } catch (error) {
    console.error('❌ Connection failed:', error.message)
  }
}

testConnection()
