
const axios = require('axios');
const express = require('express');
const { CookieJar } = require('tough-cookie');
const { wrapper } = require('axios-cookiejar-support');

const app = express();
const jar = new CookieJar();
const client = wrapper(axios.create({ jar }));

// Cấu hình
const BASE = "https://aibcr.me";
const USERNAME = "bucumh";
const PASSWORD = "123456";
let filteredData = [];
let lastResults = {};

// Thuật toán dự đoán mẫu (Pattern Recognition)
// Bạn có thể thêm logic phân tích "cầu" vào đây
function predictNext(resultString) {
    if (!resultString) return "Chưa có dữ liệu";
    const lastChar = resultString.slice(-1);
    // Ví dụ đơn giản: dự đoán ngược lại hoặc theo xu hướng
    return lastChar === 'B' ? "Dự đoán: P" : "Dự đoán: B";
}

async function login() {
    try {
        const r = await client.get(`${BASE}/login`);
        // Logic lấy CSRF (đơn giản hóa)
        const token = r.data.match(/name="_token" value="([^"]+)"/)?.[1];
        
        await client.post(`${BASE}/login`, new URLSearchParams({
            username: USERNAME,
            password: PASSWORD,
            _token: token,
            action: "Login"
        }).toString());
        console.log("✅ Đăng nhập thành công");
    } catch (e) {
        console.error("❌ Lỗi đăng nhập:", e.message);
    }
}

async function fetchResults() {
    try {
        const resp = await client.post(`${BASE}/baccarat/getnewresult`, 
            new URLSearchParams({ gameCode: "ae" }).toString(),
            { headers: { 'X-Requested-With': 'XMLHttpRequest' } }
        );

        const data = resp.data.data || [];
        data.forEach(t => {
            if (t.result && t.result !== lastResults[t.table_name]) {
                lastResults[t.table_name] = t.result;
                const prediction = predictNext(t.result);
                
                filteredData.push({
                    table: t.table_name,
                    result: t.result,
                    prediction: prediction,
                    time: new Date().toLocaleTimeString()
                });
            }
        });
        // Giới hạn lịch sử để tránh tràn RAM
        if (filteredData.length > 50) filteredData = filteredData.slice(-50);
    } catch (e) {
        console.error("❌ Lỗi lấy dữ liệu:", e.message);
    }
}

// Loop chạy treo
setInterval(fetchResults, 2000);

app.get("/data", (req, res) => {
    res.json(filteredData);
});

app.listen(5000, () => {
    console.log("🚀 Server API đang chạy tại http://localhost:5000/data");
    login();
});

```
                    
