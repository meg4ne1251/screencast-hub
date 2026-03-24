const express = require('express');
const { exec } = require('child_process');
const cors = require('cors');

const app = express();
const PORT = 3001;

app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173'],
}));
app.use(express.json());

// Allowed apps whitelist - only these can be launched
const APPS = {
  netflix: 'start netflix:',
};

// Launch a native app
app.post('/launch', (req, res) => {
  const { appId } = req.body;

  if (!appId || typeof appId !== 'string') {
    return res.status(400).json({ error: 'appId is required' });
  }

  const command = APPS[appId];
  if (!command) {
    return res.status(404).json({ error: `App '${appId}' not found` });
  }

  exec(command, (error) => {
    if (error) {
      console.error(`Failed to launch ${appId}:`, error.message);
      return res.status(500).json({ error: error.message });
    }
    console.log(`Launched: ${appId}`);
    res.json({ status: 'launched', appId });
  });
});

// Bring the portal browser back to foreground
app.post('/focus-portal', (req, res) => {
  const ps = `
    Add-Type -AssemblyName Microsoft.VisualBasic;
    $process = Get-Process -Name msedge -ErrorAction SilentlyContinue |
      Where-Object { $_.MainWindowTitle -ne '' } | Select-Object -First 1;
    if ($process) {
      [Microsoft.VisualBasic.Interaction]::AppActivate($process.Id)
    }
  `;

  exec(`powershell -Command "${ps.replace(/\n/g, ' ')}"`, (error) => {
    if (error) {
      console.error('Failed to focus portal:', error.message);
      return res.status(500).json({ error: error.message });
    }
    res.json({ status: 'focused' });
  });
});

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`App Launcher running on http://localhost:${PORT}`);
});
