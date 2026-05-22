const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const { wrapper } =
require("axios-cookiejar-support");

const tough = require("tough-cookie");

const app = express();

const BASE = "https://aibcr.me";

const LOGIN_URL = `${BASE}/login`;
const LOBBY_URL = `${BASE}/ae/lobby`;
const API_URL =
`${BASE}/baccarat/getnewresult`;

const USERNAME = "bucumh";
const PASSWORD = "123456";

const jar = new tough.CookieJar();

const client = wrapper(
    axios.create({
        jar,
        withCredentials: true,
        headers: {
            "User-Agent":
            "Mozilla/5.0"
        },
        timeout: 15000
    })
);

let cache = [];
let loggedIn = false;

// ======================
// GET TOKEN
// ======================

function getToken(html) {

    const $ = cheerio.load(html);

    return (
        $('input[name="_token"]').val()
        ||
        $('meta[name="csrf-token"]')
        .attr("content")
        ||
        ""
    );
}

// ======================
// LOGIN
// ======================

async function login() {

    try {

        console.log("🔄 Đang login...");

        const page =
        await client.get(LOGIN_URL);

        const token =
        getToken(page.data);

        const form =
        new URLSearchParams({
            username: USERNAME,
            password: PASSWORD,
            action: "Login",
            _token: token
        });

        await client.post(
            LOGIN_URL,
            form,
            {
                headers: {
                    "Content-Type":
                    "application/x-www-form-urlencoded"
                }
            }
        );

        await client.get(LOBBY_URL);

        loggedIn = true;

        console.log("✅ Login OK");

    } catch (e) {

        loggedIn = false;

        console.log(
            "❌ Login lỗi:",
            e.message
        );
    }
}

// ======================
// PHÂN TÍCH CẦU
// ======================

function analyzePattern(result) {

    if (!result)
        return {
            prediction: "?",
            pattern: "Unknown"
        };

    // BỆT PLAYER
    if (/P{4,}$/.test(result)) {

        return {
            prediction: "P",
            pattern: "Bệt Player"
        };
    }

    // BỆT BANKER
    if (/B{4,}$/.test(result)) {

        return {
            prediction: "B",
            pattern: "Bệt Banker"
        };
    }

    // CẦU 1-1
    if (
        /(PBPB|BPBP)$/
        .test(result.slice(-4))
    ) {

        return {

            prediction:
            result.at(-1) === "P"
            ? "B"
            : "P",

            pattern: "Cầu 1-1"
        };
    }

    // THỐNG KÊ
    const p =
    [...result]
    .filter(x => x === "P").length;

    const b =
    [...result]
    .filter(x => x === "B").length;

    return {

        prediction:
        p > b ? "P" : "B",

        pattern: "Theo thống kê"
    };
}

// ======================
// FETCH DATA
// ======================

async function fetchData() {

    try {

        if (!loggedIn) {

            await login();
        }

        const res =
        await client.post(
            API_URL,
            new URLSearchParams({
                gameCode: "ae"
            }),
            {
                headers: {
                    "X-Requested-With":
                    "XMLHttpRequest",

                    "Content-Type":
                    "application/x-www-form-urlencoded"
                }
            }
        );

        const data =
        res.data?.data || [];

        cache = data.map(t => {

            const ai =
            analyzePattern(
                t.result || ""
            );

            return {

                table:
                t.table_name,

                result:
                t.result,

                prediction:
                ai.prediction,

                pattern:
                ai.pattern,

                goodRoad:
                t.goodRoad,

                round:
                t.round,

                shoeId:
                t.shoeId,

                time:
                new Date()
                .toLocaleTimeString()
            };
        });

        console.log(
            `✅ UPDATE ${cache.length} bàn`
        );

    } catch (e) {

        console.log(
            "❌ Fetch lỗi:",
            e.message
        );

        loggedIn = false;
    }
}

// ======================
// AUTO LOOP
// ======================

async function start() {

    await login();

    setInterval(async () => {

        await fetchData();

    }, 1000);
}

// ======================
// ROUTES
// ======================

app.get("/", (req, res) => {

    res.send("🚀 Baccarat API Running");
});

app.get("/data", (req, res) => {

    res.json(cache);
});

// ======================
// START SERVER
// ======================

const PORT =
process.env.PORT || 3000;

app.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log(
            `🚀 SERVER RUNNING PORT ${PORT}`
        );

        start();
    }
);
