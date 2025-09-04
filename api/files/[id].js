import pkg from 'pg'
const { Pool } = pkg

let pool

// Initialize database connection
const initDB = async () => {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      }
    })
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
    
    res.setHeader('Content-Disposition', `attachment; filename="${file.original_name}"`)
    res.setHeader('Content-Type', 'application/octet-stream')
    res.send(buffer)
    
  } catch (error) {
    console.error('Error downloading file:', error)
    res.status(500).json({ error: 'Failed to download file' })
  }
}
