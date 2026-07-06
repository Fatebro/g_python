"""验证竖屏横向滚动优化效果"""
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    # 模拟手机竖屏 (390x844 类似 iPhone 14)
    page = browser.new_page(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)

    errors = []
    page.on("pageerror", lambda err: errors.append(str(err)))

    page.goto("http://localhost:8000/", timeout=30000)
    page.wait_for_load_state("networkidle", timeout=15000)
    page.wait_for_timeout(3000)

    # 截图
    page.screenshot(path="/workspace/portrait_test.png", full_page=True)

    # 检查横向溢出
    overflow_check = page.evaluate("""() => {
        const docWidth = document.documentElement.offsetWidth;
        const scrollWidth = document.documentElement.scrollWidth;
        const bodyScroll = document.body.scrollWidth;
        const overflows = [];
        // 检查全球市场区域
        const globalWrap = document.querySelector('.global-scroll-wrap');
        if (globalWrap) {
            overflows.push({
                name: 'global-scroll-wrap',
                scrollWidth: globalWrap.scrollWidth,
                clientWidth: globalWrap.clientWidth,
                overflowing: globalWrap.scrollWidth > globalWrap.clientWidth
            });
        }
        // 检查板块评分表格
        const tableWrap = document.querySelector('.table-scroll-wrap');
        if (tableWrap) {
            overflows.push({
                name: 'table-scroll-wrap',
                scrollWidth: tableWrap.scrollWidth,
                clientWidth: tableWrap.clientWidth,
                overflowing: tableWrap.scrollWidth > tableWrap.clientWidth
            });
        }
        // 检查tab栏
        const tabs = document.querySelector('.tabs');
        if (tabs) {
            overflows.push({
                name: 'tabs',
                scrollWidth: tabs.scrollWidth,
                clientWidth: tabs.clientWidth,
                overflowing: tabs.scrollWidth > tabs.clientWidth
            });
        }
        // 检查决策面板4格
        const decisionGrid = document.querySelector('#decision-core-panel .grid-4');
        if (decisionGrid) {
            overflows.push({
                name: 'decision-grid-4',
                scrollWidth: decisionGrid.scrollWidth,
                clientWidth: decisionGrid.clientWidth,
                overflowing: decisionGrid.scrollWidth > decisionGrid.clientWidth
            });
        }
        return {
            viewportWidth: docWidth,
            htmlScrollWidth: scrollWidth,
            bodyScrollWidth: bodyScroll,
            bodyOverflows: bodyScroll > docWidth,
            elementChecks: overflows
        };
    }""")
    print(f"视口宽度: {overflow_check['viewportWidth']}px")
    print(f"HTML滚动宽度: {overflow_check['htmlScrollWidth']}px")
    print(f"Body滚动宽度: {overflow_check['bodyScrollWidth']}px")
    print(f"Body横向溢出: {overflow_check['bodyOverflows']}")
    print()
    print("各元素横向溢出检查:")
    for item in overflow_check['elementChecks']:
        print(f"  {item['name']}: {item['clientWidth']}px / {item['scrollWidth']}px {'溢出→横向滚动' if item['overflowing'] else '未溢出'}")

    print(f"\n页面错误数: {len(errors)}")
    for e in errors:
        print(f"  ERROR: {e}")

    browser.close()
    print("\n截图已保存: /workspace/portrait_test.png")
