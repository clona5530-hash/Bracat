const axios = require('axios');
const express = require('express');
const https = require('https');

// ======================
// CONFIG
// ======================
const BASE = 'https://aibcr.me';
const LOGIN_URL = `${BASE}/login`;
const LOBBY_URL = `${BASE}/ae/lobby`;
const GETNEWRESULT_URL = `${BASE}/baccarat/getnewresult`;

const USERNAME = 'tiendatoce1232';
const PASSWORD = 'tiendatoceee1';

const PORT = process.env.PORT || 5000;

// ======================
// HTTPS AGENT
// ======================
const agent = new https.Agent({
    rejectUnauthorized: false,
    keepAlive: true
});

let cookieJar = '';
let baccaratData = [];
let lastUpdate = null;

// ======================
// AXIOS SESSION
// ======================
const session = axios.create({
    baseURL: BASE,
    timeout: 120000,
    httpsAgent: agent,
    maxRedirects: 5,
    headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': '*/*',
        'Accept-Language': 'vi-VN,vi;q=0.9'
    }
});

// ======================
// COOKIE HANDLER
// ======================
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

            const regex = new RegExp(`${name}=[^;]+;?`, 'g');
            cookieJar = cookieJar.replace(regex, '');

            cookieJar += `${name}=${value}; `;
        }
    }

    return res;
});

// ======================
// CSRF TOKEN
// ======================
function getCsrfToken(html) {
    const match = html.match(
        /<meta\s+name="csrf-token"\s+content="([^"]+)"/
    );

    return match ? match[1] : null;
}

// ======================
// LOGIN
// ======================
async function login() {
    try {
        console.log('[LOGIN] Getting login page...');

        const getResp = await session.get(LOGIN_URL);

        const token = getCsrfToken(getResp.data);

        if (!token) {
            console.log('[ERROR] Không lấy được CSRF token');
            return false;
        }

        console.log('[LOGIN] Got CSRF token');

        const formData = new URLSearchParams();

        formData.append('username', USERNAME);
        formData.append('password', PASSWORD);
        formData.append('_token', token);
        formData.append('action', 'Login');

        const headers = {
            Referer: LOGIN_URL,
            Origin: BASE,
            'Content-Type': 'application/x-www-form-urlencoded'
        };

        console.log('[LOGIN] Sending login request...');

        const loginResp = await session.post(
            LOGIN_URL,
            formData.toString(),
            { headers }
        );

        console.log('[LOGIN] Status:', loginResp.status);

        return loginResp.status === 200;

    } catch (error) {
        console.log('[LOGIN ERROR]');
        console.log(error.message);

        if (error.response) {
            console.log('STATUS:', error.response.status);
        }

        return false;
    }
}

// ======================
// GO TO LOBBY
// ======================
async function goToLobby() {
    try {
        await session.get(LOBBY_URL);
        return true;
    } catch (error) {
        console.log('[LOBBY ERROR]', error.message);
        return false;
    }
}

// ======================
// FETCH DATA
// ======================
async function fetchBaccaratData() {
    try {

        let xsrfToken = '';

        const xsrfMatch = cookieJar.match(/XSRF-TOKEN=([^;]+)/);

        if (xsrfMatch) {
            xsrfToken = decodeURIComponent(xsrfMatch[1]);
        }

        const headers = {
            Referer: LOBBY_URL,
            Origin: BASE,
            'X-Requested-With': 'XMLHttpRequest',
            'X-XSRF-TOKEN': xsrfToken,
            'Content-Type':
                'application/x-www-form-urlencoded; charset=UTF-8'
        };

        const formData = new URLSearchParams();

        formData.append('gameCode', 'ae');

        const resp = await session.post(
            GETNEWRESULT_URL,
            formData.toString(),
            { headers }
        );

        if (resp.data && resp.data.data) {

            baccaratData = resp.data.data.map(item => ({
                table: item.table_name,
                result: item.result,
                shoeId: item.shoeId || '',
                round: item.round || ''
            }));

            lastUpdate = new Date().toISOString();

            console.log(
                `[UPDATE] ${baccaratData.length} bàn`
            );
        }

        return baccaratData;

    } catch (error) {

        console.log('[FETCH ERROR]', error.message);

        return [];
    }
}

// ======================
// AUTO UPDATE
// ======================
async function autoUpdate() {

    while (true) {

        await fetchBaccaratData();

        await new Promise(resolve =>
            setTimeout(resolve, 2000)
        );
    }
}

// ======================
// EXPRESS APP
// ======================
const app = express();

// ======================
// CORS
// ======================
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

// ======================
// HOME
// ======================
app.get('/', (req, res) => {

    res.json({
        success: true,
        message: 'BACCARAT API RUNNING',
        totalTables: baccaratData.length,
        lastUpdate
    });
});

// ======================
// ALL TABLES
// ======================
app.get('/all', (req, res) => {

    const all = baccaratData.map(item => ({
        table: item.table,
        result: item.result
    }));

    res.json({
        success: true,
        total: all.length,
        data: all
    });
});

// ======================
// GET ALL
// ======================
app.get('/api/baccarat', (req, res) => {

    res.json({
        success: true,
        total: baccaratData.length,
        lastUpdate,
        data: baccaratData
    });
});

// ======================
// GET SINGLE TABLE
// ======================
app.get('/api/baccarat/:table', (req, res) => {

    const tableName = req.params.table;

    const found = baccaratData.find(
        x => x.table == tableName
    );

    if (!found) {

        return res.json({
            success: false,
            message: 'Không tìm thấy bàn'
        });
    }

    res.json({
        success: true,
        data: found
    });
});

// ======================
// START
// ======================
async function start() {

    console.log('================================');
    console.log('BACCARAT API SERVER');
    console.log('================================');

    console.log('[1] Đăng nhập...');

    const loginOk = await login();

    if (!loginOk) {

        console.log('[ERROR] Login thất bại');

        process.exit(1);
    }

    console.log('[OK] Login success');

    console.log('[2] Vào lobby...');

    await goToLobby();

    console.log('[OK] Lobby success');

    console.log('[3] Fetch data...');

    await fetchBaccaratData();

    console.log('[OK] Loaded data');

    autoUpdate();

    app.listen(PORT, '0.0.0.0', () => {

        console.log('');
        console.log('================================');
        console.log(`SERVER RUNNING PORT ${PORT}`);
        console.log('================================');

        console.log(`/all`);
        console.log(`/api/baccarat`);
        console.log(`/api/baccarat/1`);
    });
}

start();
