import JSZip from 'jszip';

export const config = {
  api: { bodyParser: false }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  const NETLIFY_TOKEN = process.env.NETLIFY_TOKEN;
  if (!NETLIFY_TOKEN) {
    return res.status(500).json({ error: 'NETLIFY_TOKEN belum diset' });
  }

  try {
    // 🔹 Ambil raw body
    const buffers = [];
    for await (const chunk of req) buffers.push(chunk);
    const body = JSON.parse(Buffer.concat(buffers).toString());

    const files = body.files;
    if (!files || !files['index.html']) {
      return res.status(400).json({ error: 'index.html wajib ada' });
    }

    // 🔹 Buat ZIP
    const zip = new JSZip();
    for (const path in files) {
      zip.file(path, files[path]);
    }

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

    // 🔹 Buat site baru
    const siteRes = await fetch('https://api.netlify.com/api/v1/sites', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${NETLIFY_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: '{}'
    });

    const site = await siteRes.json();

    // 🔹 Deploy ZIP (INI KUNCI UTAMA)
    const deployRes = await fetch(
      `https://api.netlify.com/api/v1/sites/${site.id}/deploys`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${NETLIFY_TOKEN}`,
          'Content-Type': 'application/zip'
        },
        body: zipBuffer
      }
    );

    const deploy = await deployRes.json();

    res.json({
      url: deploy.ssl_url,
      state: deploy.state
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
