
const express = require('express');
const axios = require('axios');
const app = express();
const port = process.env.PORT || 3000;

// Middleware để parse JSON
app.use(express.json());

// Giả lập dữ liệu và trạng thái
let filteredData = [];
let lastResults = {};

// Hàm dự đoán đơn giản (Ví dụ)
function predictNext(resultString) {
    if (!resultString) return "N/A";
    return resultString.slice(-1) === 'B' ? "P" : "B";
}

// Hàm lấy dữ liệu từ aibcr
async function fetchResults() {
    try {
        // Lưu ý: Render không hỗ trợ giữ Session cookies lâu dài tốt như máy cá nhân, 
        // bạn nên cân nhắc sử dụng API trực tiếp nếu có thể.
        const resp = await axios.post("https://aibcr.me/baccarat/getnewresult", 
            "gameCode=ae",
            { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
        );
        
        const data = resp.data.data || [];
        data.forEach(t => {
            if (t.result && t.result !== lastResults[t.table_name]) {
                lastResults[t.table_name] = t.result;
                filteredData.push({
                    table: t.table_name,
                    result: t.result,
                    prediction: predictNext(t.result),
                    time: new Date().toLocaleTimeString()
                });
            }
        });
        if (filteredData.length > 20) filteredData = filteredData.slice(-20);
    } catch (e) {
        console.error("Lỗi fetch:", e.message);
    }
}

// Chạy vòng lặp mỗi 5 giây
setInterval(fetchResults, 5000);

app.get("/", (req, res) => {
    res.send("Bot đang chạy...");
});

app.get("/data", (req, res) => {
    res.json(filteredData);
});

app.listen(port, () => {
    console.log(`Server đang lắng nghe tại cổng ${port}`);
});

```
    
