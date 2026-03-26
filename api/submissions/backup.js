import pkg from 'pg'
const { Client } = pkg

const createClient = () => {
    return new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    })
}

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', true)
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

    if (req.method === 'OPTIONS') {
        return res.status(200).end()
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    const client = createClient()
    try {
        await client.connect()

        // Get all submissions and files directly
        const subResult = await client.query('SELECT * FROM submissions ORDER BY id ASC')
        const fileResult = await client.query('SELECT * FROM files ORDER BY id ASC')

        const backupData = {
            version: '1.0',
            timestamp: new Date().toISOString(),
            submissions: subResult.rows,
            files: fileResult.rows
        }

        res.setHeader('Content-Type', 'application/json')
        res.setHeader('Content-Disposition', 'attachment; filename="retiree-db-backup.json"')
        res.status(200).send(JSON.stringify(backupData, null, 2))
    } catch (error) {
        console.error('Backup error:', error)
        res.status(500).json({ error: 'Failed to generate backup' })
    } finally {
        try {
            await client.end()
        } catch (e) { }
    }
}
