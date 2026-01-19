export const runtime = 'nodejs';

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
    // ambil raw body
    const buffers = [];
    for await (const chunk of req) buffers.push(chunk);
    const body = JSON.parse(Buffer.concat(buffers).toString());

    const files = body.files;
    if (!files || !files['index.html']) {
      return res.status(400).json({ error: 'index.html wajib ada' });
    }

    // buat ZIP
    const zip = new JSZip();
    for (const path in files) {
      zip.file(path, files[path]);
    }
    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });

    // buat site
    const siteRes = await fetch('https://api.netlify.com/api/v1/sites', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${NETLIFY_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: '{}'
    });

    const site = await siteRes.json();

    // deploy ZIP
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

    let deploy = await deployRes.json();

    // polling
    while (deploy.state !== 'ready') {
      await new Promise(r => setTimeout(r, 1500));
      const check = await fetch(
        `https://api.netlify.com/api/v1/deploys/${deploy.id}`,
        {
          headers: {
            Authorization: `Bearer ${NETLIFY_TOKEN}`
          }
        }
      );
      deploy = await check.json();
    }

    res.json({
      url: deploy.ssl_url,
      state: deploy.state
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
