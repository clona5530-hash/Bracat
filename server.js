const express = require("express");
const { chromium } = require("playwright");

const app = express();

let cache = [];

async function fetchData() {

    const browser =
    await chromium.launch({
        headless: true
    });

    const page =
    await browser.newPage();

    try {

        // LOGIN
        await page.goto(
            "https://aibcr.me/login",
            {
                waitUntil:
                "networkidle"
            }
        );

        await page.fill(
            'input[name="username"]',
            'bucumh'
        );

        await page.fill(
            'input[name="password"]',
            '123456'
        );

        await page.click(
            'button[type="submit"]'
        );

        await page.waitForTimeout(3000);

        // LOBBY
        await page.goto(
            "https://aibcr.me/ae/lobby",
            {
                waitUntil:
                "networkidle"
            }
        );

        // API
        const result =
        await page.evaluate(async () => {

            const res =
            await fetch(
                "/baccarat/getnewresult",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                        "application/x-www-form-urlencoded",

                        "X-Requested-With":
                        "XMLHttpRequest"
                    },

                    body:
                    "gameCode=ae"
                }
            );

            return await res.json();
        });

        cache =
        result.data || [];

        console.log(
            "✅ UPDATE:",
            cache.length
        );

    } catch (e) {

        console.log(
            "❌ ERROR:",
            e.message
        );
    }

    await browser.close();
}

setInterval(fetchData, 5000);

app.get("/", (req, res) => {
    res.send("RUNNING");
});

app.get("/data", (req, res) => {
    res.json(cache);
});

const PORT =
process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {

    console.log(
        "🚀 RUNNING PORT",
        PORT
    );

    fetchData();
});
