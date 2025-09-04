import pkg from 'pg'
const { Pool } = pkg

export default async function handler(req, res) {
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
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      }
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
