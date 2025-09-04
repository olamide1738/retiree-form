import pkg from 'pg'
const { Pool } = pkg

export default async function handler(req, res) {
  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://postgres.kkuwgmttbekyxsvpmrrw:Midebobo123%@aws-1-eu-west-2.pooler.supabase.com:5432/postgres',
      ssl: {
        rejectUnauthorized: false
      },
      max: 1,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    })
    
    // Test basic connection
    const result = await pool.query('SELECT NOW() as current_time')
    
    // Test if tables exist
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('submissions', 'files')
    `)
    
    await pool.end()
    
    res.status(200).json({
      success: true,
      message: 'Database connection successful',
      currentTime: result.rows[0].current_time,
      tables: tablesResult.rows.map(r => r.table_name)
    })
    
  } catch (error) {
    console.error('Database test failed:', error)
    res.status(500).json({
      success: false,
      error: 'Database connection failed',
      details: error.message
    })
  }
}