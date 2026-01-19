export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const NETLIFY_TOKEN = process.env.NETLIFY_TOKEN;
  if (!NETLIFY_TOKEN) {
    return res.status(500).json({ error: 'NETLIFY_TOKEN belum diset' });
  }

  const { files } = req.body;
  if (!files || !files['index.html']) {
    return res.status(400).json({ error: 'index.html wajib ada' });
  }

  try {
    // 1️⃣ Buat site baru
    const siteRes = await fetch('https://api.netlify.com/api/v1/sites', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${NETLIFY_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({})
    });

    const site = await siteRes.json();
    const site_id = site.id;

    // 2️⃣ Deploy file
    const deployRes = await fetch(
      `https://api.netlify.com/api/v1/sites/${site_id}/deploys`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${NETLIFY_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ files })
      }
    );

    const deploy = await deployRes.json();

    // 3️⃣ Tunggu deploy READY
    let finalDeploy = deploy;
    while (finalDeploy.state !== 'ready') {
      await new Promise(r => setTimeout(r, 1500));

      const check = await fetch(
        `https://api.netlify.com/api/v1/deploys/${deploy.id}`,
        {
          headers: { Authorization: `Bearer ${NETLIFY_TOKEN}` }
        }
      );

      finalDeploy = await check.json();
    }

    // 4️⃣ Kirim URL deploy
    res.json({
      url: finalDeploy.ssl_url,
      state: finalDeploy.state
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
