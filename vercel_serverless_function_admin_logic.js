const { Client } = require('pg');

module.exports = async (req, res) => {
  const { action } = req.query;

  // Cek ketersediaan Environment Variable DATABASE_URL
  if (!process.env.DATABASE_URL) {
    return res.status(503).json({
      success: false,
      message: 'Sistem database belum terhubung di Environment Variables Vercel.'
    });
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();

    // Pastikan tabel siap
    await client.query(`
      CREATE TABLE IF NOT EXISTS ppdb_santri (
        id SERIAL PRIMARY KEY,
        reg_no VARCHAR(50) UNIQUE NOT NULL,
        nama VARCHAR(255) NOT NULL,
        nik VARCHAR(20) NOT NULL,
        jk VARCHAR(20),
        tempat_lahir VARCHAR(100),
        tgl_lahir DATE,
        wali VARCHAR(255) NOT NULL,
        hp VARCHAR(30) NOT NULL,
        kelas VARCHAR(50),
        asal_sekolah VARCHAR(255),
        alamat TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    if (req.method === 'POST' && action === 'login') {
      const { username, password } = req.body;
      const adminUser = process.env.ADMIN_USER || 'admin';
      const adminPass = process.env.ADMIN_PASS || 'admin123';

      if (username === adminUser && password === adminPass) {
        await client.end();
        return res.status(200).json({ success: true, message: 'Login Berhasil' });
      } else {
        await client.end();
        return res.status(401).json({ success: false, message: 'Username atau Password salah!' });
      }
    }

    if (req.method === 'GET' && action === 'list') {
      const result = await client.query('SELECT * FROM ppdb_santri ORDER BY id DESC');
      await client.end();
      return res.status(200).json({ success: true, data: result.rows });
    }

    if (req.method === 'POST') {
      const { nama, nik, jk, tempatLahir, tglLahir, wali, hp, kelas, asalSekolah, alamat } = req.body;

      if (!nama || !nik || !wali || !hp) {
        await client.end();
        return res.status(400).json({ success: false, message: 'Lengkapi data wajib.' });
      }

      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const randomNum = Math.floor(1000 + Math.random() * 9000);
      const regNo = `PPDB-${dateStr}-${randomNum}`;

      const insertQuery = `
        INSERT INTO ppdb_santri (reg_no, nama, nik, jk, tempat_lahir, tgl_lahir, wali, hp, kelas, asal_sekolah, alamat)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING reg_no;
      `;

      const values = [regNo, nama, nik, jk, tempatLahir, tglLahir || null, wali, hp, kelas, asalSekolah, alamat];
      const result = await client.query(insertQuery, values);
      await client.end();

      return res.status(200).json({
        success: true,
        message: 'Pendaftaran berhasil',
        regNo: result.rows[0].reg_no
      });
    }

    await client.end();
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });

  } catch (error) {
    if (client) await client.end();
    return res.status(500).json({ success: false, message: error.message });
  }
};