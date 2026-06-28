import csv
import os
import re
import time
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup
from playwright.sync_api import sync_playwright
from slugify import slugify


BASE_URL = "https://www.coursealgerie.com"
START_URL = "https://www.coursealgerie.com/?f=N4IgJghgLgpiBcoDOUICcoIHYFcA2eANCDFmNvngL5VA"

OUTPUT_DIR = Path("coursealgerie_export")
IMAGES_DIR = OUTPUT_DIR / "images"
CSV_FILE = OUTPUT_DIR / "races.csv"

HEADERS = {
    "User-Agent": "ZidRun data research crawler - contact: your-email@example.com"
}


def clean_text(value: str) -> str:
    if not value:
        return ""
    return re.sub(r"\s+", " ", value).strip()


def safe_filename(value: str) -> str:
    value = slugify(value or "race")
    return value[:120] or "race"


def discover_course_links() -> list[str]:
    """
    Loads the JavaScript-rendered listing page and extracts all /courses/... URLs.
    """
    links = set()

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(
            viewport={"width": 1440, "height": 1200},
            user_agent=HEADERS["User-Agent"],
        )

        page.goto(START_URL, wait_until="networkidle", timeout=90000)

        # Scroll several times to trigger lazy loading/infinite loading if present.
        previous_count = 0

        for _ in range(30):
            page.mouse.wheel(0, 3000)
            page.wait_for_timeout(1200)

            current_links = page.eval_on_selector_all(
                "a[href]",
                """els => els
                    .map(a => a.href)
                    .filter(href => href.includes('/courses/'))"""
            )

            for link in current_links:
                links.add(link.split("#")[0])

            # Try clicking common "load more" button texts if present.
            for text in ["Voir plus", "Afficher plus", "Plus", "Charger plus"]:
                try:
                    button = page.get_by_text(text, exact=False)
                    if button.count() > 0:
                        button.first.click(timeout=1500)
                        page.wait_for_timeout(1500)
                except Exception:
                    pass

            if len(links) == previous_count:
                # Give it another chance, then stop if still no new links.
                page.wait_for_timeout(1000)
                page.mouse.wheel(0, 3000)

                current_links = page.eval_on_selector_all(
                    "a[href]",
                    """els => els
                        .map(a => a.href)
                        .filter(href => href.includes('/courses/'))"""
                )

                for link in current_links:
                    links.add(link.split("#")[0])

                if len(links) == previous_count:
                    break

            previous_count = len(links)

        browser.close()

    return sorted(links)


def download_image(image_url: str, race_slug: str, index: int) -> str:
    if not image_url:
        return ""

    try:
        parsed = urlparse(image_url)
        ext = os.path.splitext(parsed.path)[1].lower()

        if ext not in [".jpg", ".jpeg", ".png", ".webp", ".gif"]:
            ext = ".jpg"

        filename = f"{race_slug}_{index}{ext}"
        local_path = IMAGES_DIR / filename

        response = requests.get(image_url, headers=HEADERS, timeout=30)
        response.raise_for_status()

        local_path.write_bytes(response.content)

        return str(local_path)
    except Exception as exc:
        print(f"Failed to download image {image_url}: {exc}")
        return ""


def extract_images(soup: BeautifulSoup) -> list[str]:
    image_urls = []

    # Standard img tags
    for img in soup.find_all("img"):
        src = img.get("src") or img.get("data-src") or img.get("data-lazy-src")
        if src:
            image_urls.append(urljoin(BASE_URL, src))

        srcset = img.get("srcset")
        if srcset:
            # Pick the last/largest srcset candidate
            candidates = [x.strip().split(" ")[0] for x in srcset.split(",") if x.strip()]
            if candidates:
                image_urls.append(urljoin(BASE_URL, candidates[-1]))

    # OpenGraph image
    og_image = soup.find("meta", property="og:image")
    if og_image and og_image.get("content"):
        image_urls.append(urljoin(BASE_URL, og_image["content"]))

    # Twitter image
    twitter_image = soup.find("meta", attrs={"name": "twitter:image"})
    if twitter_image and twitter_image.get("content"):
        image_urls.append(urljoin(BASE_URL, twitter_image["content"]))

    # Deduplicate while preserving order
    seen = set()
    unique = []

    for url in image_urls:
        if url not in seen and url.startswith("http"):
            seen.add(url)
            unique.append(url)

    return unique


def find_meta(soup: BeautifulSoup, name: str) -> str:
    tag = soup.find("meta", attrs={"name": name})
    if tag and tag.get("content"):
        return clean_text(tag["content"])

    tag = soup.find("meta", property=name)
    if tag and tag.get("content"):
        return clean_text(tag["content"])

    return ""


def extract_field_by_patterns(text: str, patterns: list[str]) -> str:
    for pattern in patterns:
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if match:
            return clean_text(match.group(1))
    return ""


def parse_course_page(url: str) -> dict:
    response = requests.get(url, headers=HEADERS, timeout=30)
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "html.parser")
    text = clean_text(soup.get_text(" "))

    h1 = soup.find("h1")
    title = clean_text(h1.get_text(" ")) if h1 else find_meta(soup, "og:title")

    description = find_meta(soup, "description") or find_meta(soup, "og:description")

    slug = safe_filename(urlparse(url).path.rstrip("/").split("/")[-1] or title)

    image_urls = extract_images(soup)
    local_image_paths = []

    for index, image_url in enumerate(image_urls, start=1):
        local_path = download_image(image_url, slug, index)
        if local_path:
            local_image_paths.append(local_path)

    date_text = extract_field_by_patterns(text, [
        r"Le\s+(.+?)(?:\s+à\s+|\s+Alger|\s+Oran|\s+Blida|\s+Bouira|\s+Tizi|\s+Béjaïa|\s+Bejaia|\s+Constantine|\s+Sétif|\s+Setif|\s+Annaba|\s+Tlemcen|\s+Tipaza|\s+Médéa|\s+Medea|\s+Algérie)",
        r"Date\s+(.+?)(?:\s+Lieu|\s+Ville|\s+Distance|\s+Type|$)",
    ])

    time_text = extract_field_by_patterns(text, [
        r"à\s+([0-9]{1,2}h[0-9]{0,2})",
        r"Heure\s+([0-9]{1,2}[:h][0-9]{0,2})",
    ])

    city = extract_field_by_patterns(text, [
        r"(Alger|Oran|Blida|Bouira|Tizi Ouzou|Béjaïa|Bejaia|Constantine|Sétif|Setif|Annaba|Tlemcen|Tipaza|Médéa|Medea|Skikda|Jijel|Batna|Ghardaïa|Ghardaia|Mostaganem|Chlef|Ouargla|Biskra|Djelfa)",
    ])

    distance = extract_field_by_patterns(text, [
        r"Distance\s+([0-9]+(?:[.,][0-9]+)?\s*km)",
        r"([0-9]+(?:[.,][0-9]+)?\s*km)",
    ])

    duration = extract_field_by_patterns(text, [
        r"Durée\s+([0-9]+h(?:[0-9]+)?)",
    ])

    elevation = extract_field_by_patterns(text, [
        r"Dénivelé\s+([0-9\s]+\s*m\s*D\+)",
        r"([0-9\s]+\s*m\s*D\+)",
    ])

    price = extract_field_by_patterns(text, [
        r"Prix\s+([0-9\s]+DA|Gratuit)",
        r"([0-9\s]+DA)",
    ])

    organizer_name = extract_field_by_patterns(text, [
        r"Organisateur\s+(.+?)(?:\s+Condition|\s+S’inscrire|\s+S'inscrire|\s+Récompense|\s+Contact|\s+Email|$)",
    ])

    emails = re.findall(r"[\w\.-]+@[\w\.-]+\.\w+", text)
    phones = re.findall(r"(?:\+213|0)(?:[\s.-]?\d){8,9}", text)

    # Try to detect race types
    detected_types = []
    type_keywords = [
        "Trail",
        "Ultra-trail",
        "Ultra trail",
        "Course sur route",
        "Course d'endurance",
        "Course chronométrée",
        "Marathon",
        "Semi-marathon",
        "5 km",
        "10 km",
        "21 km",
    ]

    for keyword in type_keywords:
        if keyword.lower() in text.lower():
            detected_types.append(keyword)

    registration_url = ""

    for a in soup.find_all("a", href=True):
        label = clean_text(a.get_text(" "))
        href = urljoin(BASE_URL, a["href"])

        if any(word in label.lower() for word in ["inscrire", "inscription", "register", "participer"]):
            registration_url = href
            break

    return {
        "source_url": url,
        "title": title,
        "description": description,
        "date_text": date_text,
        "time_text": time_text,
        "city": city,
        "wilaya": city,
        "country": "Algérie",
        "race_type": ", ".join(sorted(set(detected_types))),
        "distance": distance,
        "duration": duration,
        "elevation": elevation,
        "price": price,
        "organizer_name": organizer_name[:300],
        "organizer_email": emails[0] if emails else "",
        "organizer_phone": phones[0] if phones else "",
        "registration_url": registration_url,
        "image_urls": " | ".join(image_urls),
        "local_image_paths": " | ".join(local_image_paths),
        "source_name": "coursealgerie.com",
        "import_status": "pending_review",
    }


def main():
    OUTPUT_DIR.mkdir(exist_ok=True)
    IMAGES_DIR.mkdir(exist_ok=True)

    print("Discovering race links from START_URL...")
    links = discover_course_links()

    print(f"Found {len(links)} race links")

    rows = []

    for index, link in enumerate(links, start=1):
        print(f"[{index}/{len(links)}] {link}")

        try:
            row = parse_course_page(link)
            rows.append(row)
        except Exception as exc:
            print(f"Failed to parse {link}: {exc}")

        # Be polite to the website
        time.sleep(1)

    fieldnames = [
        "source_url",
        "title",
        "description",
        "date_text",
        "time_text",
        "city",
        "wilaya",
        "country",
        "race_type",
        "distance",
        "duration",
        "elevation",
        "price",
        "organizer_name",
        "organizer_email",
        "organizer_phone",
        "registration_url",
        "image_urls",
        "local_image_paths",
        "source_name",
        "import_status",
    ]

    with CSV_FILE.open("w", newline="", encoding="utf-8-sig") as file:
        writer = csv.DictWriter(file, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print("")
    print(f"Done.")
    print(f"CSV: {CSV_FILE}")
    print(f"Images folder: {IMAGES_DIR}")
    print(f"Exported races: {len(rows)}")


if __name__ == "__main__":
    main()