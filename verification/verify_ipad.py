
from playwright.sync_api import sync_playwright

def verify_app():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Create a context with iPad dimensions
        context = browser.new_context(
            viewport={'width': 834, 'height': 1194},
            user_agent='Mozilla/5.0 (iPad; CPU OS 11_0 like Mac OS X) AppleWebKit/604.1.34 (KHTML, like Gecko) Version/11.0 Mobile/15A5341f Safari/604.1'
        )
        page = context.new_page()

        try:
            # Navigate to the app
            page.goto("http://localhost:3000")

            # Wait for content to load
            page.wait_for_selector("text=Recent Heat", timeout=10000)

            # Take screenshot of Home
            page.screenshot(path="verification/home_ipad.png")
            print("Home screenshot taken")

            # Click Library tab
            page.click("text=Library")
            page.wait_for_timeout(500) # Wait for animation
            page.screenshot(path="verification/library_ipad.png")
            print("Library screenshot taken")

            # Click Search tab
            page.click("text=Search")
            page.wait_for_timeout(500)
            page.screenshot(path="verification/search_ipad.png")
            print("Search screenshot taken")

        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()

if __name__ == "__main__":
    verify_app()
