// ============================================================
// utils/pdfRender.js — Render HTML → PDF memakai Chrome headless
// ============================================================
// Dipakai fitur "Unduh PDF" (satu file): halaman surat (portrait)
// + halaman lampiran (landscape) dalam SATU PDF.
//
// Kenapa harus di server?
// Dialog print Chrome hanya punya SATU pilihan orientasi untuk
// seluruh dokumen, dan itu menimpa CSS @page per-halaman (bug
// Chromium 40248423). Di Chrome headless (tanpa dialog) CSS
// per-halaman dihormati, sehingga orientasi campuran bisa keluar
// dengan benar.
//
// Memakai "puppeteer-core" yang mengendalikan Chrome/Edge yang
// SUDAH terpasang di mesin (tidak mengunduh browser sendiri).
// Jalur Chrome bisa diatur lewat env CHROME_PATH.
// ============================================================
const fs = require('fs');
const puppeteer = require('puppeteer-core');

const KANDIDAT_CHROME = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA ? `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe` : null,
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
].filter(Boolean);

/** Cari browser pertama yang ada di mesin. */
function cariBrowser() {
    for (const jalur of KANDIDAT_CHROME) {
        try {
            if (fs.existsSync(jalur)) return jalur;
        } catch (e) { /* abaikan */ }
    }
    return null;
}

let browserPromise = null;

/** Satu instance browser dipakai ulang (launch memakan 1-2 detik). */
async function getBrowser() {
    if (browserPromise) {
        try {
            const b = await browserPromise;
            if (b.connected) return b;
        } catch (e) { /* jatuh ke bawah → launch ulang */ }
        browserPromise = null;
    }

    const executablePath = cariBrowser();
    if (!executablePath) {
        throw new Error('Chrome/Edge tidak ditemukan. Set CHROME_PATH di file .env');
    }

    browserPromise = puppeteer.launch({
        executablePath,
        headless: true,
        // --no-sandbox : wajib saat berjalan di dalam container.
        // --disable-gpu : tidak ada GPU di server.
        // --disable-dev-shm-usage : /dev/shm di container biasanya hanya 64MB →
        //   Chrome bisa crash saat mencetak dokumen besar; ini memindahkan
        //   berkas sementaranya ke /tmp.
        args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
    });
    return browserPromise;
}

// ---------- Sanitasi HTML sebelum dicetak ----------
// Endpoint /pdf menerima HTML dari klien. Tanpa penyaringan, HTML itu bisa dipakai
// menyuruh server mengambil alamat internal (SSRF) atau menjalankan skrip.
// Yang dibutuhkan halaman cetak hanya: tag HTML + <style> + <img> (kop/footer).
const HOST_DIIZINKAN = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i;

function hostDari(url) {
    try {
        const u = new URL(url, 'http://localhost/');
        return { host: u.host, lengkap: u.href, protokol: u.protocol };
    } catch (e) {
        return null;
    }
}

function sanitasiHtml(html) {
    let aman = String(html);

    // elemen yang tidak pernah dibutuhkan untuk cetak
    aman = aman
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<next-route-announcer>[\s\S]*?<\/next-route-announcer>/gi, '')
        .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
        .replace(/<iframe[^>]*>/gi, '')
        .replace(/<object[\s\S]*?<\/object>/gi, '')
        .replace(/<embed[^>]*>/gi, '')
        .replace(/<link[^>]*>/gi, '')
        .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*')/gi, '');   // hapus onload=, onerror=, dll.

    // gambar: hanya boleh dari host lokal/privat (kop & footer berasal dari frontend).
    // Gambar dari alamat lain diganti 1x1 transparan supaya tidak ada permintaan keluar.
    const GIF_KOSONG = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    aman = aman.replace(/<img\b[^>]*>/gi, (tag) => {
        const m = /\ssrc\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(tag);
        if (!m) return tag;                                   // tanpa src → biarkan
        const src = (m[2] || m[3] || m[4] || '').trim();
        if (!src || src.startsWith('data:')) return tag;      // data URI → biarkan
        const info = hostDari(src);
        if (info && HOST_DIIZINKAN.test(info.lengkap)) return tag;
        console.warn('⛔ Gambar dari luar dihapus dari PDF:', src.slice(0, 90));
        return tag.replace(m[0], ` src="${GIF_KOSONG}"`);
    });

    return aman;
}

/**
 * Render HTML (string lengkap) menjadi PDF.
 * @param {string} html HTML utuh (sudah termasuk <style> dan gambar absolut)
 * @returns {Promise<Buffer>} isi PDF
 */
async function htmlKePdf(html) {
    // Buang <next-route-announcer> (elemen bawaan Next.js) yang duduk SETELAH lembar
    // terakhir. Karena lembar lampiran memakai konteks halaman landscape, kehadiran
    // elemen ini memaksa Chrome pindah kembali ke halaman portrait → halaman KOSONG.
    // (Frontend juga sudah membuangnya; ini jaring pengaman.)
    const bersih = sanitasiHtml(html);

    const browser = await getBrowser();
    const page = await browser.newPage();
    try {
        await page.setContent(bersih, { waitUntil: 'load', timeout: 30000 });

        // Tunggu gambar (kop/footer) selesai dimuat — kalau tidak, kop bisa hilang.
        await page.evaluate(() => Promise.all(
            Array.from(document.images).map((img) => (
                img.complete
                    ? Promise.resolve()
                    : new Promise((selesai) => { img.onload = selesai; img.onerror = selesai; })
            ))
        ));

        const pdf = await page.pdf({
            preferCSSPageSize: true, // WAJIB: ikuti @page dari CSS (portrait + landscape)
            printBackground: true,
            timeout: 60000,
        });
        return Buffer.from(pdf);
    } finally {
        await page.close().catch(() => {});
    }
}

module.exports = { htmlKePdf, cariBrowser, sanitasiHtml };
