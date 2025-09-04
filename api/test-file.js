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
    await initDB()
    
    // Get all files to see what's in the database
    const result = await pool.query(`
      SELECT f.id, f.field_name, f.original_name, 
             LENGTH(f.stored_path) as data_length,
             LEFT(f.stored_path, 100) as data_preview
      FROM files f 
      ORDER BY f.id DESC 
      LIMIT 10
    `)
    
    res.status(200).json({
      success: true,
      files: result.rows,
      totalFiles: result.rows.length
    })
    
  } catch (error) {
    console.error('Error testing files:', error)
    res.status(500).json({ 
      success: false, 
      error: 'Failed to test files',
      details: error.message 
    })
  }
}
