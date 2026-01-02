from playwright.sync_api import sync_playwright
import os

def verify_audio_player(page):
    page.goto("http://localhost:3000")

    # Wait for the app to load
    page.wait_for_selector('h1', state='visible')

    # Take a screenshot of the home page
    cwd = os.getcwd()
    path = os.path.join(cwd, "verification/home.png")
    page.screenshot(path=path)
    print(f"Home screenshot taken at {path}")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_audio_player(page)
        finally:
            browser.close()
