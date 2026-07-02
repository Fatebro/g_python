from playwright.sync_api import sync_playwright
import json

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1400, "height": 900})

    console_msgs = []
    page.on("console", lambda msg: console_msgs.append(f"[{msg.type}] {msg.text}"))

    page.goto("http://localhost:8080")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(10000)

    # 检查页面状态
    status_text = page.evaluate("""() => {
        var el = document.getElementById('status-text');
        return el ? el.textContent : 'no status element';
    }""")
    print("页面状态:", status_text)

    # 检查数据
    data_status = page.evaluate("""() => {
        try {
            if (typeof currentData === 'undefined' || !currentData) return 'currentData为空或未定义';
            var a = currentData.analysis;
            return JSON.stringify({
                status: currentData.status,
                sectorRank: (currentData.sectorRank || []).length,
                sectorFundFlow: (currentData.sectorFundFlow || []).length,
                marketIndex: (currentData.marketIndex || []).length,
                limitUp: currentData.limitUp ? currentData.limitUp.total : 0,
                brokenLimit: currentData.brokenLimit ? currentData.brokenLimit.total : 0,
                northbound: currentData.northbound && currentData.northbound.latest ? '有' : '无',
                analysis: a ? '有' : '无',
                sentiment: a && a.sentimentScore ? a.sentimentScore : '无',
                action: a && a.tradingAdvice ? a.tradingAdvice.action : '无',
                shortTerm: a && a.shortTermSentiment ? a.shortTermSentiment.score : '无',
                longTerm: a && a.longTermValue ? a.longTermValue.score : '无'
            });
        } catch(e) { return 'Error: ' + e.message; }
    }""")
    print("数据状态:", data_status)

    print("\n控制台消息:")
    for m in console_msgs:
        print(" ", m)

    # 截图
    page.screenshot(path="/tmp/debug_strategy.png", full_page=False)
    print("\n截图已保存: /tmp/debug_strategy.png")

    browser.close()
