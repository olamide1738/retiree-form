export default function handler(req, res) {
  try {
    // Check if we can access environment variables
    const hasDbUrl = !!process.env.DATABASE_URL
    const nodeEnv = process.env.NODE_ENV
    
    res.status(200).json({ 
      status: 'OK',
      timestamp: new Date().toISOString(),
      environment: {
        hasDatabaseUrl: hasDbUrl,
        nodeEnv: nodeEnv,
        allEnvVars: Object.keys(process.env).length
      },
      message: 'Health check successful'
    })
  } catch (error) {
    res.status(500).json({ 
      status: 'ERROR',
      error: error.message,
      timestamp: new Date().toISOString()
    })
  }
}
