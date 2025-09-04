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
    
    try {
      // Create tables if they don't exist
      await pool.query(`
        CREATE TABLE IF NOT EXISTS submissions (
          id SERIAL PRIMARY KEY,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          data_json TEXT NOT NULL
        )
      `)
      
      await pool.query(`
        CREATE TABLE IF NOT EXISTS files (
          id SERIAL PRIMARY KEY,
          submission_id INTEGER NOT NULL,
          field_name VARCHAR(255) NOT NULL,
          original_name VARCHAR(255) NOT NULL,
          stored_path TEXT NOT NULL,
          FOREIGN KEY(submission_id) REFERENCES submissions(id) ON DELETE CASCADE
        )
      `)
      
      console.log('Database tables created successfully')
    } catch (error) {
      console.error('Error creating tables:', error)
      // Don't throw error, just log it and continue
    }
  }
  return pool
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' })
    }
    
    await initDB()
    
    const fileId = req.query.id
    if (!fileId) {
      return res.status(400).json({ error: 'File ID required' })
    }
    
    const result = await pool.query(
      'SELECT original_name, stored_path FROM files WHERE id = $1',
      [fileId]
    )
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'File not found' })
    }
    
    const file = result.rows[0]
    
    // For Vercel, files are stored as base64 in the database
    const base64Data = file.stored_path
    const buffer = Buffer.from(base64Data, 'base64')
    
    // Determine MIME type based on file extension
    const getMimeType = (filename) => {
      const ext = filename.toLowerCase().split('.').pop()
      const mimeTypes = {
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'gif': 'image/gif',
        'webp': 'image/webp',
        'pdf': 'application/pdf',
        'doc': 'application/msword',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      }
      return mimeTypes[ext] || 'application/octet-stream'
    }
    
    const mimeType = getMimeType(file.original_name)
    
    res.setHeader('Content-Disposition', `attachment; filename="${file.original_name}"`)
    res.setHeader('Content-Type', mimeType)
    res.send(buffer)
    
  } catch (error) {
    console.error('Error downloading file:', error)
    res.status(500).json({ error: 'Failed to download file' })
  }
}
