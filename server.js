import express from 'express';
import fs from 'fs';
import rateLimit from 'express-rate-limit';

let QRISGenerator, PaymentChecker, ReceiptGenerator;
try {
    const mod = await import('autoft-qris');
    ({ QRISGenerator, PaymentChecker, ReceiptGenerator } = mod);
} catch (err) {
    console.error('\n[ERROR] Gagal memuat modul `autoft-qris`.');
    console.error('This package may require native system libraries (e.g. Cairo/pixman) to be installed.');
    console.error('On Debian/Ubuntu: run `sudo apt-get update && sudo apt-get install -y build-essential pkg-config libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev libpixman-1-dev python3-dev make g++`');
    console.error('Setelah itu jalankan `npm install` kembali.');
    console.error('\nOriginal error:', err?.message || err, '\n');
    process.exit(1);
}

const app = express();

// ==============================
// CONFIG
// ==============================
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

// ==============================
// EXTRA FEATURES
// ==============================

// create folder /cache/qr if not exists
if (!fs.existsSync('./cache')) fs.mkdirSync('./cache');
if (!fs.existsSync('./cache/qr')) fs.mkdirSync('./cache/qr');

// logging middleware
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// rate-limit: 20 req per minute
const limiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    message: { success: false, error: "Rate limit exceeded" }
});

// ==============================
// ROUTES
// ==============================

// === CREATE PAYMENT (GENERATE QR) ===
app.get('/api/payment/create', limiter, async (req, res) => {
    try {
        const { key, refId, amount } = req.query;

        if (!key || key !== API_KEY) {
            return res.status(403).json({ success: false, error: "Invalid API Key" });
        }
        if (!refId) return res.status(400).json({ success: false, error: "refId required" });
        if (!amount) return res.status(400).json({ success: false, error: "amount required" });

        const amt = parseInt(amount);
        const qrString = qrisGen.generateQrString(amt);
        const qrBuffer = await qrisGen.generateQRWithLogo(qrString);

        const filePath = `./cache/qr/qris-${refId}.png`;
        fs.writeFileSync(filePath, qrBuffer);

        // AUTO DELETE 2 menit
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
            qr_image_url: `${req.protocol}://${req.get('host')}/file?q=${filePath}`
        });

    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// === CHECK PAYMENT ===
app.get('/api/check', limiter, async (req, res) => {
    try {
        const { reference, amount } = req.query;

        if (!reference) return res.status(400).json({ success: false, error: "reference required" });
        if (!amount) return res.status(400).json({ success: false, error: "amount required" });

        const amt = parseInt(amount);
        const result = await paymentChecker.checkPaymentStatus(reference, amt);

        return res.json(result);

    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// === SERVE QR IMAGE ===
app.get('/file', async (req, res) => {
    const path = req.query.q;

    if (!path || !fs.existsSync(path)) {
        return res.status(404).json({ success: false, error: "File not found" });
    }

    res.sendFile(path, { root: process.cwd() });
});

// ==============================
// START SERVER
// ==============================
const PORT = process.env.PORT || 3000; // ← WAJIB UNTUK RAILWAY
app.listen(PORT, () =>
    console.log(`SValePay API running on port ${PORT}`)
);