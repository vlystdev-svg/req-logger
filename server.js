const http = require('http');
const fs = require('fs');
const WebSocket = require('ws');

const PORT = process.env.PORT || 3000;

// Create HTTP server
const server = http.createServer((req, res) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const logData = {
        timestamp,
        ip,
        method: req.method,
        path: req.url
    };

    // Log to console
    console.log(`[${timestamp}] ${ip} ${req.method} ${req.url}`);

    // Broadcast to all WebSocket clients
    broadcastLog(logData);

    // Serve the HTML file
    if (req.url === '/' || req.url === '/index.html') {
        fs.readFile('request-logger.html', (err, data) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'text/plain' });
                res.end('Error loading page');
                return;
            }
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data);
        });
    } else if (req.url === '/ws') {
        // WebSocket upgrade is handled by the ws library
        res.writeHead(426, { 'Content-Type': 'text/plain' });
        res.end('Upgrade Required');
    } else {
        // Log other requests but return 404
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
    }
});

// Create WebSocket server
const wss = new WebSocket.Server({ server, path: '/ws' });

const clients = new Set();

wss.on('connection', (ws, req) => {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
    console.log(`WebSocket client connected from ${ip}`);
    
    clients.add(ws);

    ws.on('close', () => {
        console.log(`WebSocket client disconnected from ${ip}`);
        clients.delete(ws);
    });

    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        clients.delete(ws);
    });
});

// Broadcast log to all connected clients
function broadcastLog(logData) {
    const message = JSON.stringify(logData);
    clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            try {
                client.send(message);
            } catch (error) {
                console.error('Error sending to client:', error);
            }
        }
    });
}

server.listen(PORT, () => {
    console.log(`\n=================================`);
    console.log(`Request Logger Server Running`);
    console.log(`=================================`);
    console.log(`Port: ${PORT}`);
    console.log(`URL: http://localhost:${PORT}`);
    console.log(`=================================\n`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, closing server...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});
