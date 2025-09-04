import pkg from 'pg'
const { Pool } = pkg

let pool

// Initialize database connection - simplified for Vercel
const initDB = async () => {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL || 'postgresql://postgres.kkuwgmttbekyxsvpmrrw:Midebobo123%@aws-1-eu-west-2.pooler.supabase.com:5432/postgres',
      ssl: {
        rejectUnauthorized: false
      },
      // Minimal settings for Vercel
      max: 1,
      min: 0,
      idleTimeoutMillis: 0,
      connectionTimeoutMillis: 0, // No timeout
      acquireTimeoutMillis: 0, // No timeout
      allowExitOnIdle: true,
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
