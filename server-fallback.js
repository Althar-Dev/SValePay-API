import express from "express";
import fs from "fs";
import path from "path";
import rateLimit from "express-rate-limit";

// ==============================
// APP INIT
// ==============================
const app = express();
const __root = process.cwd();

// ==============================
// CONFIG
// ==============================
const API_KEY = process.env.API_KEY;

const config = {
    storeName: process.env.STORE_NAME || "Zetta Store",
    auth_username: process.env.AUTH_USERNAME || "OK2498473",
    auth_token: process.env.AUTH_TOKEN || "672812417500789002498473OKCTAC7D08D4BFAB1208E12725D9DA0BAC2F",
    baseQrString: process.env.BASE_QR_STRING || "00020101021126670016COM.NOBUBANK.WWW01189360050300000879140214221056314059230303UMI51440014ID.CO.QRIS.WWW0215ID20254118470930303UMI5204541153033605802ID5921ZETTA STORE OK24984736005BATAM61052940062070703A016304CDB0",
    logoPath: process.env.LOGO_PATH || "./logo-agin.png",
};

// ==============================
// PREPARE FOLDERS
// ==============================
const cacheDir = path.join(__root, "cache");
const qrDir = path.join(cacheDir, "qr");

if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir);
if (!fs.existsSync(qrDir)) fs.mkdirSync(qrDir);

// ==============================
// GLOBAL LOGGER
// ==============================
app.use((req, res, next) => {
    console.log(
        `[${new Date().toISOString()}] ${req.method} ${req.url} | IP: ${req.ip}`
    );
    next();
});

// ==============================
// RATE LIMIT
// ==============================
const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: "Rate limit exceeded" },
});

// ==============================
// HEALTH CHECK & UI
// ==============================
app.get("/", (req, res) => {
    const start = process.hrtime();
    setImmediate(() => {
        const diff = process.hrtime(start);
        const ms = Math.round(diff[0] * 1000 + diff[1] / 1e6);
        
        const uptime = process.uptime();
        const uptimeHours = Math.floor(uptime / 3600);
        const uptimeMins = Math.floor((uptime % 3600) / 60);
        const uptimeSecs = Math.floor(uptime % 60);
        
        const html = `
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SValePay API</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            padding: 20px;
        }
        .container {
            background: white;
            border-radius: 12px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            max-width: 800px;
            width: 100%;
            padding: 40px;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #f0f0f0;
            padding-bottom: 20px;
        }
        .header h1 {
            color: #333;
            font-size: 2.5em;
            margin-bottom: 10px;
        }
        .header p {
            color: #666;
            font-size: 1.1em;
        }
        .status {
            display: flex;
            justify-content: space-around;
            margin: 30px 0;
            gap: 20px;
            flex-wrap: wrap;
        }
        .status-item {
            flex: 1;
            min-width: 150px;
            text-align: center;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 8px;
            border: 1px solid #e9ecef;
        }
        .status-item .label {
            color: #666;
            font-size: 0.9em;
            margin-bottom: 8px;
            font-weight: 500;
        }
        .status-item .value {
            color: #667eea;
            font-size: 1.8em;
            font-weight: bold;
        }
        .warning {
            background: #fff3cd;
            border: 1px solid #ffc107;
            color: #856404;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 20px;
        }
        .endpoints {
            margin-top: 40px;
        }
        .endpoints h2 {
            color: #333;
            font-size: 1.3em;
            margin-bottom: 20px;
            border-bottom: 2px solid #667eea;
            padding-bottom: 10px;
        }
        .endpoint {
            margin-bottom: 15px;
            padding: 15px;
            background: #f8f9fa;
            border-left: 4px solid #667eea;
            border-radius: 4px;
        }
        .endpoint .method {
            display: inline-block;
            background: #667eea;
            color: white;
            padding: 4px 10px;
            border-radius: 4px;
            font-weight: bold;
            font-size: 0.85em;
            margin-right: 10px;
        }
        .endpoint .path {
            color: #333;
            font-family: 'Courier New', monospace;
            font-weight: 500;
        }
        .endpoint .desc {
            color: #666;
            font-size: 0.9em;
            margin-top: 8px;
        }
        .badge {
            display: inline-block;
            background: #28a745;
            color: white;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.85em;
            font-weight: bold;
            margin-left: 10px;
        }
        .badge.disabled {
            background: #dc3545;
        }
        .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e9ecef;
            text-align: center;
            color: #999;
            font-size: 0.9em;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>SValePay API 💳</h1>
            <p>Payment Gateway QRIS (Fallback Mode)</p>
        </div>
        
        <div class="status">
            <div class="status-item">
                <div class="label">Status</div>
                <div class="value">
                    <span style="color: #28a745;">✓ Online</span>
                </div>
            </div>
            <div class="status-item">
                <div class="label">Response Time</div>
                <div class="value">${ms}ms</div>
            </div>
            <div class="status-item">
                <div class="label">Uptime</div>
                <div class="value">${uptimeHours}h ${uptimeMins}m</div>
            </div>
        </div>
        
        <div class="warning">
            <strong>⚠️ Fallback Mode:</strong> Native QRIS module tidak tersedia. 
            Untuk mengaktifkan fitur QRIS, jalankan:
            <br><code>npm install --build-from-source</code>
            <br>Endpoint dasar API tetap berfungsi.
        </div>
        
        <div class="endpoints">
            <h2>Available Endpoints</h2>
            
            <div class="endpoint">
                <span class="method">GET</span>
                <span class="path">/</span>
                <span class="badge">Health Check</span>
                <div class="desc">Dashboard & status halaman ini</div>
            </div>
            
            <div class="endpoint">
                <span class="method">GET</span>
                <span class="path">/api/payment/create</span>
                <span class="badge disabled">Disabled</span>
                <div class="desc">Generate QRIS QR code - <strong>Memerlukan native module</strong></div>
            </div>
            
            <div class="endpoint">
                <span class="method">GET</span>
                <span class="path">/api/check</span>
                <span class="badge disabled">Disabled</span>
                <div class="desc">Cek status pembayaran - <strong>Memerlukan native module</strong></div>
            </div>
            
            <div class="endpoint">
                <span class="method">GET</span>
                <span class="path">/file?q=path</span>
                <span class="badge">Available</span>
                <div class="desc">Ambil file dari sistem</div>
            </div>
        </div>
        
        <div class="footer">
            <p>SValePay v1.0.0 • Store: ${config.storeName} • Node ${process.version}</p>
        </div>
    </div>
</body>
</html>
        `;
        res.set('Content-Type', 'text/html; charset=utf-8');
        res.send(html);
    });
});

// ==============================
// ROUTES
// ==============================

// CREATE PAYMENT - DISABLED
app.get("/api/payment/create", limiter, (req, res) => {
    res.status(503).json({
        success: false,
        error: "QRIS module not available. Run: npm install --build-from-source"
    });
});

// CHECK PAYMENT - DISABLED
app.get("/api/check", limiter, (req, res) => {
    res.status(503).json({
        success: false,
        error: "QRIS module not available. Run: npm install --build-from-source"
    });
});

// SERVE FILE
app.get("/file", (req, res) => {
    const filePath = req.query.q;

    if (!filePath || !fs.existsSync(filePath))
        return res
            .status(404)
            .json({ success: false, error: "File not found" });

    res.sendFile(filePath);
});

// ==============================
// START SERVER
// ==============================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`\n✅ SValePay API running on port ${PORT}`);
    console.log(`📊 Dashboard: http://localhost:${PORT}`);
    console.log(`⚠️  Running in FALLBACK MODE (QRIS features disabled)\n`);
});
