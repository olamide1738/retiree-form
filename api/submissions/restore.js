import pkg from 'pg'
const { Client } = pkg

const createClient = () => {
    return new Client({
        connectionString: process.env.DATABASE_URL || 'postgresql://postgres.kkuwgmttbekyxsvpmrrw:Midebobo123%@aws-1-eu-west-2.pooler.supabase.com:5432/postgres',
        ssl: { rejectUnauthorized: false }
    })
}

export const config = {
    api: {
        bodyParser: {
            sizeLimit: '10mb',
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

    let body = req.body
    if (typeof body === 'string') {
        try { body = JSON.parse(body) } catch (e) { }
    }

    const action = req.query?.action || (body && body.action) || 'full'
    const client = createClient()

    try {
        await client.connect()

        // Ensure tables exist before modifying
        await client.query(`
            CREATE TABLE IF NOT EXISTS submissions (
                id SERIAL PRIMARY KEY,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                data_json TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS files (
                id SERIAL PRIMARY KEY,
                submission_id INTEGER NOT NULL,
                field_name VARCHAR(255) NOT NULL,
                original_name VARCHAR(255) NOT NULL,
                stored_path TEXT NOT NULL,
                FOREIGN KEY(submission_id) REFERENCES submissions(id) ON DELETE CASCADE
            );
        `)

        if (action === 'init') {
            // Wipe database for incoming chunked restore
            await client.query('DELETE FROM files')
            await client.query('DELETE FROM submissions')
            return res.status(200).json({ success: true, message: 'Database initialized for restore' })
        }

        if (action === 'submissions') {
            const submissions = Array.isArray(body?.submissions) ? body.submissions : (Array.isArray(body) ? body : [])
            if (submissions.length > 0) {
                await client.query('BEGIN')
                for (let i = 0; i < submissions.length; i++) {
                    const sub = submissions[i]
                    const subId = sub.id !== undefined ? sub.id : i + 1
                    const createdAt = sub.created_at || sub.createdAt || new Date().toISOString()
                    let formattedData = ''
                    if (sub.data_json !== undefined && sub.data_json !== null) {
                        formattedData = typeof sub.data_json === 'string' ? sub.data_json : JSON.stringify(sub.data_json)
                    } else if (sub.data !== undefined && sub.data !== null) {
                        formattedData = typeof sub.data === 'string' ? sub.data : JSON.stringify(sub.data)
                    } else {
                        formattedData = JSON.stringify(sub)
                    }

                    await client.query(
                        'INSERT INTO submissions (id, created_at, data_json) VALUES ($1, $2, $3)',
                        [subId, createdAt, formattedData]
                    )
                }
                await client.query('COMMIT')
            }
            return res.status(200).json({ success: true, insertedSubmissions: submissions.length })
        }

        if (action === 'files') {
            const files = Array.isArray(body?.files) ? body.files : (Array.isArray(body) ? body : [])
            if (files.length > 0) {
                await client.query('BEGIN')
                for (let i = 0; i < files.length; i++) {
                    const file = files[i]
                    const fileId = file.id !== undefined ? file.id : i + 1
                    await client.query(
                        'INSERT INTO files (id, submission_id, field_name, original_name, stored_path) VALUES ($1, $2, $3, $4, $5)',
                        [fileId, file.submission_id, file.field_name || 'document', file.original_name || 'file', file.stored_path || '']
                    )
                }
                await client.query('COMMIT')
            }
            return res.status(200).json({ success: true, insertedFiles: files.length })
        }

        if (action === 'finalize') {
            // Reset sequence counters
            try {
                await client.query(`
                    SELECT setval(pg_get_serial_sequence('submissions', 'id'), COALESCE((SELECT MAX(id) FROM submissions), 0) + 1, false);
                `)
            } catch (seqErr) {
                try {
                    await client.query(`SELECT setval('submissions_id_seq', COALESCE((SELECT MAX(id) FROM submissions), 0) + 1, false)`)
                } catch (e) { }
            }

            try {
                await client.query(`
                    SELECT setval(pg_get_serial_sequence('files', 'id'), COALESCE((SELECT MAX(id) FROM files), 0) + 1, false);
                `)
            } catch (seqErr) {
                try {
                    await client.query(`SELECT setval('files_id_seq', COALESCE((SELECT MAX(id) FROM files), 0) + 1, false)`)
                } catch (e) { }
            }

            return res.status(200).json({ success: true, message: 'Restore finalized successfully' })
        }

        // Full single-shot fallback
        let submissions = []
        let files = []

        if (Array.isArray(body)) {
            submissions = body
        } else if (body && typeof body === 'object') {
            submissions = Array.isArray(body.submissions) ? body.submissions : []
            files = Array.isArray(body.files) ? body.files : []
        } else {
            return res.status(400).json({ error: 'Invalid backup format: Expected JSON object or array' })
        }

        await client.query('BEGIN')
        await client.query('DELETE FROM files')
        await client.query('DELETE FROM submissions')

        for (let i = 0; i < submissions.length; i++) {
            const sub = submissions[i]
            const subId = sub.id !== undefined ? sub.id : i + 1
            const createdAt = sub.created_at || sub.createdAt || new Date().toISOString()
            let formattedData = ''
            if (sub.data_json !== undefined && sub.data_json !== null) {
                formattedData = typeof sub.data_json === 'string' ? sub.data_json : JSON.stringify(sub.data_json)
            } else if (sub.data !== undefined && sub.data !== null) {
                formattedData = typeof sub.data === 'string' ? sub.data : JSON.stringify(sub.data)
            } else {
                formattedData = JSON.stringify(sub)
            }

            await client.query(
                'INSERT INTO submissions (id, created_at, data_json) VALUES ($1, $2, $3)',
                [subId, createdAt, formattedData]
            )
        }

        for (let i = 0; i < files.length; i++) {
            const file = files[i]
            const fileId = file.id !== undefined ? file.id : i + 1
            await client.query(
                'INSERT INTO files (id, submission_id, field_name, original_name, stored_path) VALUES ($1, $2, $3, $4, $5)',
                [fileId, file.submission_id, file.field_name || 'document', file.original_name || 'file', file.stored_path || '']
            )
        }

        try {
            await client.query(`
                SELECT setval(pg_get_serial_sequence('submissions', 'id'), COALESCE((SELECT MAX(id) FROM submissions), 0) + 1, false);
            `)
        } catch (e) {
            try {
                await client.query(`SELECT setval('submissions_id_seq', COALESCE((SELECT MAX(id) FROM submissions), 0) + 1, false)`)
            } catch (err) { }
        }

        try {
            await client.query(`
                SELECT setval(pg_get_serial_sequence('files', 'id'), COALESCE((SELECT MAX(id) FROM files), 0) + 1, false);
            `)
        } catch (e) {
            try {
                await client.query(`SELECT setval('files_id_seq', COALESCE((SELECT MAX(id) FROM files), 0) + 1, false)`)
            } catch (err) { }
        }

        await client.query('COMMIT')
        res.status(200).json({
            success: true,
            message: `Database restored successfully (${submissions.length} submissions, ${files.length} files)`
        })
    } catch (error) {
        await client.query('ROLLBACK').catch(() => { })
        console.error('Restore error:', error)
        res.status(500).json({ error: 'Failed to restore database', details: error.message })
    } finally {
        try {
            await client.end()
        } catch (e) { }
    }
}
