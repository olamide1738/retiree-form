import pkg from 'pg'
const { Client } = pkg

const createClient = () => {
    return new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    })
}

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '50mb', // Accommodate large JSON payloads containing base64 files
        },
    },
}

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', true)
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

    if (req.method === 'OPTIONS') {
        return res.status(200).end()
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    const client = createClient()
    try {
        await client.connect()

        const { submissions, files } = req.body
        if (!Array.isArray(submissions) || !Array.isArray(files)) {
            return res.status(400).json({ error: 'Invalid backup format: Arrays missing' })
        }

        // Begin single database transaction for safety
        await client.query('BEGIN')

        // Clear out existing data
        await client.query('DELETE FROM files')
        await client.query('DELETE FROM submissions')

        // Restore Submissions identically
        for (const sub of submissions) {
            const formattedData = typeof sub.data_json === 'string' ? sub.data_json : JSON.stringify(sub.data_json);
            await client.query(
                'INSERT INTO submissions (id, created_at, data_json) VALUES ($1, $2, $3)',
                [sub.id, sub.created_at, formattedData]
            )
        }

        // Restore Files identically
        for (const file of files) {
            await client.query(
                'INSERT INTO files (id, submission_id, field_name, original_name, stored_path) VALUES ($1, $2, $3, $4, $5)',
                [file.id, file.submission_id, file.field_name, file.original_name, file.stored_path]
            )
        }

        // Safely shift the database ID counters so future submissions won't duplicate IDs
        await client.query("SELECT setval('submissions_id_seq', COALESCE((SELECT MAX(id)+1 FROM submissions), 1), false)")
        await client.query("SELECT setval('files_id_seq', COALESCE((SELECT MAX(id)+1 FROM files), 1), false)")

        await client.query('COMMIT')
        res.status(200).json({ success: true, message: 'Database restored successfully' })
    } catch (error) {
        await client.query('ROLLBACK')
        console.error('Restore error:', error)
        res.status(500).json({ error: 'Failed to restore database', details: error.message })
    } finally {
        try {
            await client.end()
        } catch (e) { }
    }
}
