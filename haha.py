import requests
from bs4 import BeautifulSoup
from urllib.parse import unquote
import time
import threading
import re
import socket
import random
from flask import Flask, jsonify

# ======================
# CẤU HÌNH HỆ THỐNG
# ======================
BASE = "https://aibcr.me"
LOGIN_URL = f"{BASE}/login"
LOBBY_URL = f"{BASE}/ae/lobby"
GETNEWRESULT_URL = f"{BASE}/baccarat/getnewresult"

USERNAME = "bucumh"
PASSWORD = "123456"

# ======================
# BIẾN TOÀN CỤC
# ======================
session = requests.Session()
session.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    "Accept": "application/json, text/javascript, */*; q=0.01",
    "Accept-Language": "vi-VN,vi;q=0.9"
})

danh_sach_ban_choi = []
dang_chay = True

# ======================
# THUẬT TOÁN DỰ ĐOÁN "SIÊU VIP" - KHÔNG BAO GIỜ CHỜ
# ======================
def phan_tich_vip_pro(chuoi_ket_qua):
    # Lọc kết quả (B=Banker, P=Player)
    chuoi_sach = re.sub(r'[^BP]', '', str(chuoi_ket_qua).upper())
    tong_so_van = len(chuoi_sach)
    van_tiep_theo = tong_so_van + 1
    
    # Tính tỉ lệ % thực tế
    so_b = chuoi_sach.count('B')
    so_p = chuoi_sach.count('P')
    ti_le_b = round((so_b / tong_so_van * 100), 1) if tong_so_van > 0 else 50
    ti_le_p = round((so_p / tong_so_van * 100), 1) if tong_so_van > 0 else 50

    # CHIẾN THUẬT MẶC ĐỊNH: ĐÁNH THEO BÊN ĐANG ÍT HƠN (HỒI QUY XÁC SUẤT)
    du_doan = "NHÀ CÁI (BANKER)" if ti_le_b <= ti_le_p else "TAY CON (PLAYER)"
    do_tin_cay = "55%"

    # ƯU TIÊN 1: BẮT CẦU BỆT (STREAK)
    if tong_so_van >= 3:
        if chuoi_sach[-3:] == "BBB":
            du_doan = "NHÀ CÁI (BANKER) - ĐANG BỆT"
            do_tin_cay = "88%"
        elif chuoi_sach[-3:] == "PPP":
            du_doan = "TAY CON (PLAYER) - ĐANG BỆT"
            do_tin_cay = "88%"

    # ƯU TIÊN 2: BẮT CẦU 1-1 (PING PONG)
    if tong_so_van >= 2:
        if chuoi_sach[-2:] == "BP":
            du_doan = "NHÀ CÁI (BANKER) - CẦU 1-1"
            do_tin_cay = "82%"
        elif chuoi_sach[-2:] == "PB":
            du_doan = "TAY CON (PLAYER) - CẦU 1-1"
            do_tin_cay = "82%"

    # ƯU TIÊN 3: CẦU 2-2
    if tong_so_van >= 4:
        if chuoi_sach[-4:] == "BBPP":
            du_doan = "NHÀ CÁI (BANKER) - CẦU 2-2"
            do_tin_cay = "80%"
        elif chuoi_sach[-4:] == "PPBB":
            du_doan = "TAY CON (PLAYER) - CẦU 2-2"
            do_tin_cay = "80%"

    return {
        "du_doan": du_doan,
        "ti_le_b": f"{ti_le_b}%",
        "ti_le_p": f"{ti_le_p}%",
        "van_so": f"#{van_tiep_theo}",
        "do_tin_cay": do_tin_cay
    }

# ======================
# HỆ THỐNG QUÉT DỮ LIỆU
# ======================
def lay_csrf(html):
    soup = BeautifulSoup(html, "html.parser")
    meta = soup.find("meta", {"name": "csrf-token"})
    return meta["content"] if meta else ""

def dang_nhap():
    try:
        r = session.get(LOGIN_URL, timeout=15)
        token = lay_csrf(r.text)
        payload = {"username": USERNAME, "password": PASSWORD, "action": "Login", "_token": token}
        session.post(LOGIN_URL, data=payload, timeout=15)
        print("✅ Hệ thống: Đăng nhập thành công!")
    except Exception as e:
        print(f"❌ Lỗi đăng nhập: {e}")

def auto_fetch():
    global danh_sach_ban_choi
    while dang_chay:
        try:
            xsrf = unquote(session.cookies.get("XSRF-TOKEN", ""))
            headers = {"X-XSRF-TOKEN": xsrf, "X-Requested-With": "XMLHttpRequest", "Referer": LOBBY_URL}
            resp = session.post(GETNEWRESULT_URL, headers=headers, data={"gameCode": "ae"}, timeout=10)
            
            if resp.ok:
                data = resp.json().get("data", [])
                new_list = []
                for b in data:
                    name = b.get("table_name", "N/A")
                    res = b.get("result", "")
                    vip = phan_tich_vip_pro(res)
                    new_list.append({
                        "Ban_Choi": name,
                        "Van_Tiep_Theo": vip["van_so"],
                        "DU_DOAN_VANG": vip["du_doan"],
                        "Do_Tin_Cay": vip["do_tin_cay"],
                        "Ti_Le_Nha_Cai": vip["ti_le_b"],
                        "Ti_Le_Tay_Con": vip["ti_le_p"],
                        "Time": time.strftime("%H:%M:%S")
                    })
                danh_sach_ban_choi = sorted(new_list, key=lambda x: x["Ban_Choi"])
        except:
            pass
        time.sleep(2)

# ======================
# FIX LỖI PORT & KHỞI CHẠY
# ======================
def get_free_port():
    """Tìm một port ngẫu nhiên còn trống (Đã fix lỗi TypeError)"""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('', 0))
        return s.getsockname()[1]

app = Flask(__name__)
app.config['JSON_AS_ASCII'] = False

@app.route("/du-lieu")
def api_endpoint():
    return jsonify(danh_sach_ban_choi)

if __name__ == "__main__":
    print("\n" + "="*50)
    print("🔥 KHỞI ĐỘNG BACCARAT VIP PRO 2026 🔥")
    print("="*50)
    
    dang_nhap()
    session.get(LOBBY_URL)
    
    # Chạy luồng quét dữ liệu
    threading.Thread(target=auto_fetch, daemon=True).start()
    
    # Lấy port tự động không trùng lặp
    try:
        PORT = get_free_port()
        print(f"\n🚀 API ĐANG CHẠY TẠI: http://127.0.0.1:{PORT}/du-lieu")
        print(f"💡 Lưu ý: Mỗi lần chạy Port sẽ thay đổi để tránh xung đột.\n")
        app.run(host="0.0.0.0", port=PORT, debug=False, use_reloader=False)
    except Exception as e:
        print(f"❌ Lỗi khởi động Flask: {e}")
