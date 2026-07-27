const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files (like images)
app.use('/images', express.static(path.join(__dirname, 'public', 'images')));

// API endpoint to get agents
app.get('/api/agents', (req, res) => {
    const agentsPath = path.join(__dirname, 'data', 'agents.json');
    fs.readFile(agentsPath, 'utf8', (err, data) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Failed to read agents data' });
        }
        res.json(JSON.parse(data));
    });
});

// API endpoint to get maps
app.get('/api/maps', (req, res) => {
    const mapsPath = path.join(__dirname, 'data', 'maps.json');
    fs.readFile(mapsPath, 'utf8', (err, data) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: 'Failed to read maps data' });
        }
        res.json(JSON.parse(data));
    });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
