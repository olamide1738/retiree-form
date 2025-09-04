import pkg from 'pg'
const { Pool } = pkg

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true)
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  try {
    // Check if DATABASE_URL exists
    if (!process.env.DATABASE_URL) {
      return res.status(500).json({ 
        error: 'DATABASE_URL environment variable not set',
        timestamp: new Date().toISOString()
      })
    }

    // Try to connect to database
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://postgres.kkuwgmttbekyxsvpmrrw:Midebobo123%@aws-1-eu-west-2.pooler.supabase.com:5432/postgres',
      ssl: {
        rejectUnauthorized: false
      },
      // Session pooler optimizations
      max: 1, // Limit connections for serverless
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    })

    // Test connection
    const result = await pool.query('SELECT NOW() as current_time')
    await pool.end()

    res.status(200).json({ 
      status: 'OK',
      database: 'Connected successfully',
      currentTime: result.rows[0].current_time,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    res.status(500).json({ 
      status: 'ERROR',
      error: error.message,
      timestamp: new Date().toISOString()
    })
  }
}
