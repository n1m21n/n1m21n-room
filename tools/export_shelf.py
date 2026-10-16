# Books, films and the Infinite site still -> site/public/media/{books,films,infinite} + data/{books,films}.json
# Sources: ../covers/books/"Title - Author.jpg", ../covers/movies_and_shows/"Title (Year).jpg", ~/Infinite/repo/website/full_page_capture.png
import json, re
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT.parent / 'covers'
PUB = ROOT / 'site' / 'public'
slug = lambda s: re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')

def save(src, dst, w):
    im = Image.open(src).convert('RGB')
    im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
    dst.parent.mkdir(parents=True, exist_ok=True)
    im.save(dst, 'WEBP', quality=82)

books = []
for f in sorted((SRC / 'books').glob('*.jpg')):
    title, author = f.stem.rsplit(' - ', 1)
    out = PUB / 'media' / 'books' / f'{slug(title)}.webp'
    save(f, out, 320)
    books.append({'id': slug(title), 'title': title, 'author': author, 'cover': str(out.relative_to(PUB))})
books.append({'id': 'unreleased', 'title': 'untitled', 'author': 'Naman', 'cover': None, 'unreleased': True})

films = []
for f in sorted((SRC / 'movies_and_shows').glob('*.jpg')):
    m = re.match(r'(.+) \((\d{4})\)$', f.stem)
    title, year = m.group(1), int(m.group(2))
    out = PUB / 'media' / 'films' / f'{slug(title)}-{year}.webp'
    save(f, out, 360)
    films.append({'id': f'{slug(title)}-{year}', 'title': title, 'year': year, 'poster': str(out.relative_to(PUB))})

(PUB / 'data' / 'books.json').write_text(json.dumps({'books': books}, indent=1, ensure_ascii=False))
(PUB / 'data' / 'films.json').write_text(json.dumps({'films': films}, indent=1, ensure_ascii=False))

cap = Image.open(Path.home() / 'Infinite/repo/website/full_page_capture.png').convert('RGB')
cap = cap.crop((0, 0, 1280, 800)).resize((1024, 640), Image.LANCZOS)
(PUB / 'media' / 'infinite').mkdir(parents=True, exist_ok=True)
cap.save(PUB / 'media' / 'infinite' / 'site.webp', 'WEBP', quality=85)
print(len(books), 'books', len(films), 'films')
