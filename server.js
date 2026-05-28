const axios = require('axios');
const express = require('express');
const https = require('https');

// ========================================
// CONFIG
// ========================================
const BASE = 'https://aibcr.me';

const LOGIN_URL = `${BASE}/login`;
const LOBBY_URL = `${BASE}/ae/lobby`;
const GETNEWRESULT_URL =
    `${BASE}/baccarat/getnewresult`;

const USERNAME = 'tiendatoce1232';
const PASSWORD = 'tiendatoceee1';

const PORT = process.env.PORT || 5000;

// ========================================
// HTTPS AGENT
// ========================================
const agent = new https.Agent({
    rejectUnauthorized: false,
    keepAlive: true
});

// ========================================
// GLOBAL DATA
// ========================================
let cookieJar = '';
let baccaratData = [];
let lastUpdate = null;

// ========================================
// AXIOS SESSION
// ========================================
const session = axios.create({
    baseURL: BASE,
    timeout: 120000,
    httpsAgent: agent,
    maxRedirects: 5,
    headers: {
        'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept': '*/*',
        'Accept-Language': 'vi-VN,vi;q=0.9'
    }
});

// ========================================
// COOKIE INTERCEPTOR
// ========================================
session.interceptors.request.use(config => {

    if (cookieJar) {
        config.headers.Cookie = cookieJar;
    }

    return config;
});

session.interceptors.response.use(res => {

    const setCookie = res.headers['set-cookie'];

    if (setCookie) {

        for (const cookie of setCookie) {

            const [main] = cookie.split(';');

            const [name, value] = main.split('=');

            const regex =
                new RegExp(`${name}=[^;]+;?`, 'g');

            cookieJar =
                cookieJar.replace(regex, '');

            cookieJar += `${name}=${value}; `;
        }
    }

    return res;
});

// ========================================
// GET CSRF TOKEN
// ========================================
function getCsrfToken(html) {

    const match = html.match(
        /<meta\s+name="csrf-token"\s+content="([^"]+)"/
    );

    return match ? match[1] : null;
}

// ========================================
// LOGIN
// ========================================
async function login() {

    try {

        console.log('[LOGIN] Loading page...');

        const getResp =
            await session.get(LOGIN_URL);

        const token =
            getCsrfToken(getResp.data);

        if (!token) {

            console.log(
                '[ERROR] Không lấy được token'
            );

            return false;
        }

        console.log('[LOGIN] Token OK');

        const formData =
            new URLSearchParams();

        formData.append(
            'username',
            USERNAME
        );

        formData.append(
            'password',
            PASSWORD
        );

        formData.append(
            '_token',
            token
        );

        formData.append(
            'action',
            'Login'
        );

        const headers = {
            Referer: LOGIN_URL,
            Origin: BASE,
            'Content-Type':
                'application/x-www-form-urlencoded'
        };

        console.log(
            '[LOGIN] Sending request...'
        );

        const loginResp =
            await session.post(
                LOGIN_URL,
                formData.toString(),
                { headers }
            );

        console.log(
            '[LOGIN STATUS]',
            loginResp.status
        );

        return loginResp.status === 200;

    } catch (error) {

        console.log(
            '[LOGIN ERROR]',
            error.message
        );

        return false;
    }
}

// ========================================
// GO TO LOBBY
// ========================================
async function goToLobby() {

    try {

        await session.get(LOBBY_URL);

        return true;

    } catch (error) {

        console.log(
            '[LOBBY ERROR]',
            error.message
        );

        return false;
    }
}

// ========================================
// PHÂN TÍCH CẦU
// ========================================
function analyzePattern(result) {

    if (!result || result.length < 5) {

        return {
            prediction: 'Không đủ dữ liệu',
            confidence: 50,
            pattern: 'Unknown'
        };
    }

    const arr = result.split('');

    let player = 0;
    let banker = 0;

    arr.forEach(x => {

        if (x === 'P') player++;

        if (x === 'B') banker++;
    });

    let prediction = 'P';

    // ======================
    // CẦU BỆT
    // ======================
    const last4 =
        arr.slice(-4).join('');

    if (/PPPP/.test(last4)) {

        prediction = 'P';
    }
    else if (/BBBB/.test(last4)) {

        prediction = 'B';
    }

    // ======================
    // CẦU 1-1
    // ======================
    else {

        const last2 =
            arr.slice(-2).join('');

        if (last2 === 'PB') {

            prediction = 'P';
        }
        else if (last2 === 'BP') {

            prediction = 'B';
        }

        // ======================
        // THEO TỔNG
        // ======================
        else {

            prediction =
                player >= banker
                    ? 'P'
                    : 'B';
        }
    }

    // RANDOM ĐỘ TIN CẬY
    const confidence =
        Math.floor(
            Math.random() * 41
        ) + 50;

    return {

        prediction:
            prediction === 'P'
                ? 'Player 🟦'
                : 'Banker 🟥',

        confidence,

        patternCount:
            arr.length,

        nextRound:
            arr.length + 1,

        playerCount:
            player,

        bankerCount:
            banker
    };
}

// ========================================
// FETCH BACCARAT DATA
// ========================================
async function fetchBaccaratData() {

    try {

        let xsrfToken = '';

        const xsrfMatch =
            cookieJar.match(
                /XSRF-TOKEN=([^;]+)/
            );

        if (xsrfMatch) {

            xsrfToken =
                decodeURIComponent(
                    xsrfMatch[1]
                );
        }

        const headers = {

            Referer: LOBBY_URL,

            Origin: BASE,

            'X-Requested-With':
                'XMLHttpRequest',

            'X-XSRF-TOKEN':
                xsrfToken,

            'Content-Type':
                'application/x-www-form-urlencoded; charset=UTF-8'
        };

        const formData =
            new URLSearchParams();

        formData.append(
            'gameCode',
            'ae'
        );

        const resp =
            await session.post(
                GETNEWRESULT_URL,
                formData.toString(),
                { headers }
            );

        if (
            resp.data &&
            resp.data.data
        ) {

            baccaratData =
                resp.data.data.map(
                    item => {

                        const analysis =
                            analyzePattern(
                                item.result
                            );

                        return {

                            table:
                                item.table_name,

                            result:
                                item.result,

                            shoeId:
                                item.shoeId || '',

                            round:
                                item.round || '',

                            prediction:
                                analysis.prediction,

                            confidence:
                                `${analysis.confidence}%`,

                            patternCount:
                                analysis.patternCount,

                            nextRound:
                                analysis.nextRound,

                            playerCount:
                                analysis.playerCount,

                            bankerCount:
                                analysis.bankerCount
                        };
                    }
                );

            lastUpdate =
                new Date()
                    .toISOString();

            console.log(
                `[UPDATE] ${baccaratData.length} bàn`
            );
        }

        return baccaratData;

    } catch (error) {

        console.log(
            '[FETCH ERROR]',
            error.message
        );

        return [];
    }
}

// ========================================
// AUTO UPDATE
// ========================================
async function autoUpdate() {

    while (true) {

        await fetchBaccaratData();

        await new Promise(resolve =>
            setTimeout(resolve, 2000)
        );
    }
}

// ========================================
// EXPRESS APP
// ========================================
const app = express();

// ========================================
// CORS
// ========================================
app.use((req, res, next) => {

    res.header(
        'Access-Control-Allow-Origin',
        '*'
    );

    res.header(
        'Access-Control-Allow-Headers',
        '*'
    );

    next();
});

// ========================================
// HOME PAGE
// ========================================
app.get('/', (req, res) => {

    res.send(`
        <html>

        <head>
            <title>Baccarat API</title>
        </head>

        <body style="
            background:#111;
            color:#0f0;
            font-family:Arial;
            padding:20px;
        ">

            <h1>
                🟢 Baccarat API Running
            </h1>

            <p>
                Total Tables:
                ${baccaratData.length}
            </p>

            <p>
                Last Update:
                ${lastUpdate}
            </p>

            <h3>API:</h3>

            <ul>
                <li>/all</li>
                <li>/api/baccarat</li>
                <li>/api/latest</li>
            </ul>

        </body>

        </html>
    `);
});

// ========================================
// ALL TABLES
// ========================================
app.get('/all', (req, res) => {

    res.json({

        success: true,

        total:
            baccaratData.length,

        data:
            baccaratData
    });
});

// ========================================
// API BACCARAT
// ========================================
app.get('/api/baccarat',
(req, res) => {

    res.json({

        success: true,

        total:
            baccaratData.length,

        lastUpdate,

        data:
            baccaratData
    });
});

// ========================================
// API SINGLE TABLE
// ========================================
app.get(
'/api/baccarat/:table',
(req, res) => {

    const table =
        req.params.table;

    const found =
        baccaratData.find(
            x => x.table == table
        );

    if (!found) {

        return res.json({

            success: false,

            message:
                'Không tìm thấy bàn'
        });
    }

    res.json({

        success: true,

        data: found
    });
});

// ========================================
// API LATEST
// ========================================
app.get('/api/latest',
(req, res) => {

    const latest =
        baccaratData.slice(0, 10);

    res.json({

        success: true,

        total:
            latest.length,

        data:
            latest
    });
});

// ========================================
// KEEP ALIVE
// ========================================
setInterval(async () => {

    try {

        await fetchBaccaratData();

        console.log(
            '[KEEP ALIVE]'
        );

    } catch {}
}, 15000);

// ========================================
// START SERVER
// ========================================
async function start() {

    console.log('');
    console.log(
        '================================'
    );

    console.log(
        'BACCARAT API SERVER'
    );

    console.log(
        '================================'
    );

    console.log(
        '[1] Đăng nhập...'
    );

    const loginOk =
        await login();

    if (!loginOk) {

        console.log(
            '[ERROR] Login thất bại'
        );

        process.exit(1);
    }

    console.log(
        '[OK] Login success'
    );

    console.log(
        '[2] Vào lobby...'
    );

    await goToLobby();

    console.log(
        '[OK] Lobby success'
    );

    console.log(
        '[3] Fetch data...'
    );

    await fetchBaccaratData();

    console.log(
        '[OK] Loaded data'
    );

    // AUTO UPDATE
    autoUpdate();

    // SERVER
    app.listen(
        PORT,
        '0.0.0.0',
        () => {

            console.log('');

            console.log(
                '================================'
            );

            console.log(
                `SERVER RUNNING PORT ${PORT}`
            );

            console.log(
                '================================'
            );

            console.log(
                `${BASE}`
            );

            console.log('/all');

            console.log(
                '/a hú/baccarat'
            );

            console.log(
                '/api/latest'
            );
        }
    );
}

start();
