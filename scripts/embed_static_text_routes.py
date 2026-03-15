from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
WORKER = ROOT / "worker.js"
START = "/*__STATIC_TEXT_ROUTES_START__*/"
END = "/*__STATIC_TEXT_ROUTES_END__*/"

ROUTES = [
    ("/robots.txt", "text/plain; charset=utf-8", ROOT / "robots.txt"),
    ("/sitemap.xml", "application/xml; charset=utf-8", ROOT / "sitemap.xml"),
    ("/sitemap-main.xml", "application/xml; charset=utf-8", ROOT / "sitemap-main.xml"),
    ("/sitemap-guides.xml", "application/xml; charset=utf-8", ROOT / "sitemap-guides.xml"),
    ("/sitemap-products.xml", "application/xml; charset=utf-8", ROOT / "sitemap-products.xml"),
]


def build_block():
    lines = [START, "const STATIC_TEXT_ROUTES = new Map(["]
    for path, content_type, file_path in ROUTES:
        body = file_path.read_text(encoding="utf-8")
        lines.append(
            f"  [{json.dumps(path)}, {{ contentType: {json.dumps(content_type)}, body: {json.dumps(body)} }}],"
        )
    lines.append("]);")
    lines.append(END)
    return "\n".join(lines)


def main():
    text = WORKER.read_text(encoding="utf-8")
    start = text.index(START)
    end = text.index(END) + len(END)
    updated = text[:start] + build_block() + text[end:]
    WORKER.write_text(updated, encoding="utf-8")
    print("Embedded robots/sitemaps into worker.js")


if __name__ == "__main__":
    main()
