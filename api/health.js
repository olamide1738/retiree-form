export default function handler(req, res) {
  res.status(200).json({ 
    status: 'OK',
    timestamp: new Date().toISOString(),
    message: 'Health check successful',
    environment: {
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      nodeEnv: process.env.NODE_ENV
    }
  })
}
