import express from 'express';
import fs from 'fs';
import rateLimit from 'express-rate-limit';

// ==============================
// SAFE DYNAMIC IMPORT (Tanpa Top-Level Await)
// ==============================
let QRISGenerator, PaymentChecker, ReceiptGenerator;

async function loadModules() {
    try {
        const mod = await import('autoft-qris');
        QRISGenerator = mod.QRISGenerator;
        PaymentChecker = mod.PaymentChecker;
        ReceiptGenerator = mod.ReceiptGenerator;
    } catch (err) {
        console.error('\n[ERROR] Gagal memuat modul `autoft-qris`.');
        console.error('This package may require native system libraries (Cairo, pixman, dll).');
        console.error('Install dengan:');
        console.error('sudo apt-get update && sudo apt-get install -y build-essential pkg-config libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev libpixman-1-dev python3-dev make g++');
        console.error('\nOriginal error:', err?.message || err, '\n');
        process.exit(1);
    }
}

// load module dulu
await loadModules();

// ==============================
// APP
// ==============================
const app = express();

// CONFIG
const API_KEY = "svale-api";

const config = {
    storeName: 'Zetta Store',
    auth_username: 'OK2498473',
    auth_token: '672812417500789002498473OKCTAC7D08D4BFAB1208E12725D9DA0BAC2F',
    baseQrString: '00020101021126670016COM.NOBUBANK.WWW01189360050300000879140214221056314059230303UMI51440014ID.CO.QRIS.WWW0215ID20254118470930303UMI5204541153033605802ID5921ZETTA STORE OK24984736005BATAM61052940062070703A016304CDB0',
    logoPath: './logo-agin.png'
};

const qrisGen = new QRISGenerator(config, 'theme1');
const paymentChecker = new PaymentChecker({
    auth_token: config.auth_token,
    auth_username: config.auth_username
});
const receiptGen = new ReceiptGenerator(config);

// CACHE FOLDER
if (!fs.existsSync('./cache')) fs.mkdirSync('./cache');
if (!fs.existsSync('./cache/qr')) fs.mkdirSync('./cache/qr');

// logging
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// rate limit
const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    message: { success: false, error: "Rate limit exceeded" }
});

// health check
app.get('/', (req, res) => {
    const start = process.hrtime();
    setImmediate(() => {
        const diff = process.hrtime(start);
        const ms = Math.round(diff[0] * 1000 + diff[1] / 1e6);
        res.send(`Online ${ms}ms`);
    });
});

// ==============================
// ROUTES
// ==============================

// CREATE PAYMENT
app.get('/api/payment/create', limiter, async (req, res) => {
    try {
        const { key, refId, amount } = req.query;

        if (key !== API_KEY)
            return res.status(403).json({ success: false, error: "Invalid API Key" });

        if (!refId)
            return res.status(400).json({ success: false, error: "refId required" });

        if (!amount)
            return res.status(400).json({ success: false, error: "amount required" });

        const amt = parseInt(amount);

        const qrString = qrisGen.generateQrString(amt);
        const qrBuffer = await qrisGen.generateQRWithLogo(qrString);

        const filePath = `./cache/qr/qris-${refId}.png`;
        fs.writeFileSync(filePath, qrBuffer);

        // auto delete 2 menit
        setTimeout(() => {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log(`[AUTO DELETE] Removed -> ${filePath}`);
            }
        }, 120000);

        return res.json({
            success: true,
            reference: refId,
            amount: amt,
            qr_image_url: `/file?q=${filePath}`
        });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

// CHECK PAYMENT
app.get('/api/check', limiter, async (req, res) => {
    try {
        const { reference, amount } = req.query;

        if (!reference)
            return res.status(400).json({ success: false, error: "reference required" });

        if (!amount)
            return res.status(400).json({ success: false, error: "amount required" });

        const amt = parseInt(amount);
        const result = await paymentChecker.checkPaymentStatus(reference, amt);

        return res.json(result);
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
});

// SERVE FILES
app.get('/file', (req, res) => {
    const path = req.query.q;

    if (!path || !fs.existsSync(path)) {
        return res.status(404).json({ success: false, error: "File not found" });
    }

    res.sendFile(path, { root: process.cwd() });
});

// ==============================
// START SERVER
// ==============================
const PORT = 3000;
app.listen(PORT, () =>
    console.log(`SValePay API running on port ${PORT}`)
);
