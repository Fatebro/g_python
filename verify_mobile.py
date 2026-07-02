from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)

    # 测试竖屏（模拟手机）
    page = browser.new_page(viewport={"width": 390, "height": 844}, is_mobile=True)
    errors = []
    page.on("console", lambda m: errors.append(f"[{m.type}] {m.text}") if m.type in ("error", "warning") else None)
    page.on("pageerror", lambda e: errors.append(f"[pageerror] {e}"))

    page.goto('http://localhost:8000/', wait_until='networkidle', timeout=30000)
    page.wait_for_timeout(2500)

    # 点击大资金流向
    page.locator('.tab-btn[data-tab="fund"]').click()
    page.wait_for_timeout(800)

    # 截图验证
    page.screenshot(path='/workspace/mobile_fund.png', full_page=True)

    # 检查龙虎榜行数
    rows = page.locator('.sf-item').count()
    headers = page.locator('.stock-fund-header').count()

    # 检查顶部栏布局
    header_height = page.locator('.header').bounding_box()['height']

    # 检查每行的金额是否溢出
    first_row_height = page.locator('.sf-item').nth(0).bounding_box()['height'] if rows > 0 else 0

    print("=== 竖屏(390x844)验证 ===")
    print(f"头部高度: {header_height:.0f}px")
    print(f"龙虎榜行数: {rows}")
    print(f"表头存在: {headers > 0}")
    print(f"首行高度: {first_row_height:.0f}px (正常应<40px)")
    print(f"大资金Tab可见: {page.locator('.tab-btn[data-tab=\"fund\"]').is_visible()}")
    print(f"北向资金Tab可见: {page.locator('.tab-btn[data-tab=\"inst\"]').is_visible()}")

    # 打印所有控制台错误
    if errors:
        print("\n控制台错误:")
        for e in errors[:5]:
            print(" ", e[:120])
    else:
        print("\n无控制台错误")

    browser.close()
