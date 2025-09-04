import pkg from 'pg'
const { Pool } = pkg

let pool

// Initialize database connection
const initDB = async () => {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://postgres.kkuwgmttbekyxsvpmrrw:Midebobo123%@aws-1-eu-west-2.pooler.supabase.com:5432/postgres',
      ssl: {
        rejectUnauthorized: false
      },
      // Session pooler optimizations
      max: 1, // Limit connections for serverless
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    })
  }
  return pool
}

export default async function handler(req, res) {
  try {
    console.log('Health check started...')
    
    // Test database connection
    await initDB()
    console.log('Database connection established')
    
    // Test a simple query
    const result = await pool.query('SELECT NOW() as current_time')
    console.log('Database query successful:', result.rows[0])
    
    // Test submissions table
    const submissionsCount = await pool.query('SELECT COUNT(*) as count FROM submissions')
    console.log('Submissions count:', submissionsCount.rows[0].count)
    
    // Test files table
    const filesCount = await pool.query('SELECT COUNT(*) as count FROM files')
    console.log('Files count:', filesCount.rows[0].count)
    
    res.status(200).json({
      success: true,
      message: 'Database connection successful',
      timestamp: result.rows[0].current_time,
      submissions: parseInt(submissionsCount.rows[0].count),
      files: parseInt(filesCount.rows[0].count)
    })
    
  } catch (error) {
    console.error('Health check failed:', error)
    res.status(500).json({
      success: false,
      error: 'Database connection failed',
      details: error.message
    })
  }
}
