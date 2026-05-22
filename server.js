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

async function login() {

    try {

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

        console.log("✅ Login OK");

    } catch (e) {

        console.log(
            "❌ Login lỗi:",
            e.message
        );
    }
}

function analyzePattern(result) {

    if (!result)
        return {
            prediction: "?",
            pattern: "Unknown"
        };

    // bệt
    if (/P{4,}$/.test(result)) {

        return {
            prediction: "P",
            pattern: "Bệt Player"
        };
    }

    if (/B{4,}$/.test(result)) {

        return {
            prediction: "B",
            pattern: "Bệt Banker"
        };
    }

    // 1-1
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

    // default
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

async function fetchData() {

    try {

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
                table: t.table_name,
                result: t.result,
                prediction:
                ai.prediction,
                pattern:
                ai.pattern,
                goodRoad:
                t.goodRoad,
                round:
                t.round,
                shoeId:
                t.shoeId
            };
        });

        console.log(
            "✅ UPDATE:",
            cache.length
        );

    } catch (e) {

        console.log(
            "❌ Fetch lỗi:",
            e.message
        );
    }
}

async function start() {

    await login();

    setInterval(async () => {

        await fetchData();

    }, 1000);
}

app.get("/data", (req, res) => {

    res.json(cache);
});

app.listen(3000, () => {

    console.log(
        "🚀 http://localhost:3000/data"
    );

    start();
});
