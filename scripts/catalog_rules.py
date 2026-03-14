import re
from typing import Any, Dict

GENERIC_BRANDS = {
    'coleman','oztrail','blackwolf','sea to summit','darche','hilleberg','the north face',
    'big agnes','vango','zempire','helinox','companion','dometic','jetboil','primus',
    'snow peak','nemo','outwell','msr','exped','roman','wanderer','kingcamp','naturehike'
}

COMMON_JUNK_TERMS = {
    'sticker','stickers','decal','decals','logo sticker','logo','emblem','badge','patch','patches',
    'keyring','key ring','mug','cup','poster','manual','brochure','catalogue','catalog','book',
    'shirt','t-shirt','hoodie','cap','hat','toy','figurine','ornament','phone case','mouse pad',
    'vinyl','wrap','banner',
    'replacement','replacment','spare','parts','part','repair','repair kit','zipper','pole','poles',
    'peg','pegs','guy rope','guyline','cord','strap','clip','clips','hook','valve','pump only',
    'bag only','carry bag','storage bag','tent bag','footprint','groundsheet','ground sheet',
    'inner tent','flysheet','rainfly','rain fly','mesh wall','screen room add-on',
    'cars','car sticker','truck','trucks','motorcycle','bike decal','4wd parts','ute',
}

CATEGORY_POSITIVES = {
    'tents': [
        'tent','air tent','swag','shelter','gazebo','canopy','awning','yurt','bivy','bivy','teepee',
        'tipi','dome tent','family tent','touring tent','screenhouse','screen house'
    ],
    'chairs': ['chair','seat','stool','recliner','lounger','loveseat','love seat','director chair','directors chair'],
    'coolers': ['cooler','ice box','icebox','fridge','esky','cool box'],
    'stoves': ['stove','burner','cooker','grill','griddle','jetboil','cookset stove'],
    'lanterns': ['lantern','headlamp','head lamp','torch','flashlight','camp light','work light'],
    'sleep-systems': ['sleeping bag','sleep bag','sleeping mat','sleeping pad','mat','pad','quilt','stretcher','cot','air bed','mattress','pillow'],
}

CATEGORY_NEGATIVES = {
    'tents': ['sticker','decal','logo','patch','pole','peg','repair','mattress','air bed','pillow'],
    'chairs': ['cover only','replacement seat','sticker','decal','patch'],
    'coolers': ['ice brick','ice pack','sticker','decal','patch'],
    'stoves': ['gas canister','fuel only','hose only','adapter','sticker','decal','patch'],
    'lanterns': ['bulb only','mantle','mantles','charger only','sticker','decal','patch'],
    'sleep-systems': ['sticker','decal','patch','repair'],
}


def norm(text: str) -> str:
    return re.sub(r'\s+', ' ', str(text or '').lower()).strip()


def _combined_text(product: Dict[str, Any]) -> str:
    return norm(' '.join([
        str(product.get('name') or product.get('title') or ''),
        str(product.get('summary') or product.get('shortDescription') or ''),
        str(product.get('subtitle') or ''),
        str(product.get('description') or ''),
        str(product.get('brand') or ''),
        str(product.get('categoryName') or product.get('category') or ''),
    ]))


def guess_brand(product: Dict[str, Any], fallback: str = 'Unbranded') -> str:
    title = norm(product.get('name') or product.get('title') or '')
    if product.get('brand') and str(product.get('brand')).strip() and str(product.get('brand')).lower() != 'unbranded':
        return str(product.get('brand')).strip()
    for brand in sorted(GENERIC_BRANDS, key=len, reverse=True):
        if brand in title:
            return ' '.join(part.capitalize() if part.lower() not in {'to','the'} else part.title() for part in brand.split())
    return fallback


def clean_title(name: str, brand: str = '') -> str:
    text = str(name or '').replace('\u2122', '').replace('\u00ae', '')
    text = re.sub(r'<[^>]+>', ' ', text)
    text = re.sub(r'[_]+', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip(' -_|,;/')
    if brand:
        b = re.escape(brand)
        text = re.sub(rf'^(?:{b}\s+)+', f'{brand} ', text, flags=re.I).strip()
    # remove obvious keyword spam after many comma chunks
    parts = [p.strip() for p in re.split(r'\s*[,|/]\s*', text) if p.strip()]
    if len(parts) >= 4:
        text = ', '.join(parts[:2])
    text = re.sub(r'\s+', ' ', text).strip(' -_|,;/')
    if len(text) > 110:
        cut = text[:110]
        text = cut.rsplit(' ', 1)[0] or cut
    return text or (brand or 'Camping product')


def is_relevant_product(product: Dict[str, Any], category: str) -> bool:
    text = _combined_text(product)
    if not text:
        return False

    junk_hits = sum(1 for term in COMMON_JUNK_TERMS if term in text)
    if junk_hits:
        return False

    positives = CATEGORY_POSITIVES.get(category, [])
    if positives and not any(token in text for token in positives):
        return False

    negatives = CATEGORY_NEGATIVES.get(category, [])
    if any(token in text for token in negatives):
        return False

    # Strong anti-spam signal: lots of commas with generic keywords but no clear model name.
    title = norm(product.get('name') or product.get('title') or '')
    if title.count(',') >= 3 and len(title.split()) >= 8:
        return False

    return True


def normalize_product_payload(product: Dict[str, Any], category: str) -> Dict[str, Any]:
    clone = dict(product)
    brand = guess_brand(clone, str(clone.get('brand') or 'Unbranded'))
    clone['brand'] = brand
    clone['name'] = clean_title(clone.get('name') or clone.get('title') or '', brand)
    clone['category'] = category
    return clone
