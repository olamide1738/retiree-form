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
    
    // Debug logging
    console.log('File found:', {
      id: fileId,
      original_name: file.original_name,
      stored_path_length: file.stored_path ? file.stored_path.length : 0,
      stored_path_preview: file.stored_path ? file.stored_path.substring(0, 50) + '...' : 'null'
    })
    
    // For Vercel, files are stored as base64 in the database
    const base64Data = file.stored_path
    
    if (!base64Data) {
      console.error('No base64 data found for file:', fileId)
      return res.status(404).json({ error: 'File data not found' })
    }
    
    try {
      const buffer = Buffer.from(base64Data, 'base64')
      
      // Verify the buffer is valid
      if (buffer.length === 0) {
        console.error('Empty buffer created from base64 data')
        return res.status(500).json({ error: 'Invalid file data' })
      }
      
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
      
      console.log('Sending file:', {
        filename: file.original_name,
        mimeType: mimeType,
        bufferSize: buffer.length
      })
      
      res.setHeader('Content-Disposition', `attachment; filename="${file.original_name}"`)
      res.setHeader('Content-Type', mimeType)
      res.send(buffer)
      
    } catch (bufferError) {
      console.error('Error creating buffer from base64:', bufferError)
      return res.status(500).json({ error: 'Failed to process file data' })
    }
    
  } catch (error) {
    console.error('Error downloading file:', error)
    res.status(500).json({ error: 'Failed to download file' })
  }
}
