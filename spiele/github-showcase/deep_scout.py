import subprocess
import json
import re
import time

queries = [
    # Godot
    'godot "village" 3d stars:1..150',
    'godot "town" 3d stars:1..150',
    'godot "farming" 3d stars:1..150',
    'godot "cozy" 3d stars:1..150',
    'godot "life sim" stars:1..150',
    'godot "settlement" stars:1..150',
    'godot "colony" stars:1..150',
    'godot "island" 3d stars:1..150',
    'godot "animal crossing" stars:1..150',
    'godot "gardening" stars:1..150',
    'godot "delivery" 3d stars:1..150',
    
    # Unity
    'unity "cozy" 3d stars:2..150',
    'unity "village" 3d stars:2..150',
    'unity "town" life stars:2..150',
    'unity "farming sim" 3d stars:2..150',
    'unity "farm sim" 3d stars:2..150',
    'unity "animal crossing" stars:2..150',
    'unity "settlement" 3d stars:2..150',
    'unity "gardening" 3d stars:2..150',
    'unity "neighborhood" 3d stars:1..150',
    'unity "community" 3d stars:2..150',

    # Three.js / WebGL
    'three.js "town" stars:2..150',
    'three.js "village" stars:2..150',
    'three.js "cozy" stars:1..150',
    'three.js "farming" stars:1..150',
    'three.js "island" stars:2..150',
    'threejs "animal crossing" stars:1..150',
    'three.js "life sim" stars:1..150'
]

seen = set()
candidates = []

for q in queries:
    cmd = ["gh", "search", "repos"] + q.split() + ["--limit", "15", "--json", "fullName,description,stargazersCount,url"]
    try:
        res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
        items = json.loads(res.stdout)
        for it in items:
            name = it["fullName"]
            if name not in seen:
                seen.add(name)
                candidates.append(it)
    except Exception as e:
        pass

print(f"Total candidates scraped: {len(candidates)}")

valid = []
for c in candidates:
    name = c["fullName"]
    # Check readme
    r_cmd = ["gh", "repo", "view", name]
    try:
        r_res = subprocess.run(r_cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
        readme = r_res.stdout
        # check if contains images
        has_img = bool(re.search(r'!\[.*?\]\(.*?\)|<img .*?>', readme, re.I))
        # check keywords for mechanics
        # walking / player / avatar / character / npc / dialogue / build / farm / garden / house / decorat / deliver
        score = 0
        mechanics = []
        for kw in ["walk", "movement", "avatar", "character", "third-person", "first-person", "camera"]:
            if kw in readme.lower():
                score += 1
                mechanics.append("avatar/movement")
                break
        for kw in ["npc", "dialogue", "villager", "citizen", "talk", "interaction"]:
            if kw in readme.lower():
                score += 1
                mechanics.append("npc/dialogue")
                break
        for kw in ["farm", "crop", "plant", "garden", "harvest", "grow"]:
            if kw in readme.lower():
                score += 1
                mechanics.append("farming/gardening")
                break
        for kw in ["build", "craft", "decorat", "furniture", "house", "place"]:
            if kw in readme.lower():
                score += 1
                mechanics.append("building/decorating")
                break
        for kw in ["deliver", "quest", "order", "job", "task", "work", "shop", "economy"]:
            if kw in readme.lower():
                score += 1
                mechanics.append("deliveries/jobs/quests")
                break
        
        if has_img and score >= 2:
            valid.append({
                "repo": name,
                "stars": c["stargazersCount"],
                "desc": c.get("description", ""),
                "mechanics": list(set(mechanics)),
                "readme_len": len(readme)
            })
    except Exception:
        pass

print(f"Repositories with images & mechanics: {len(valid)}")
valid.sort(key=lambda x: x["stars"], reverse=True)
for v in valid:
    print(f"{v['stars']:3d}* | {v['repo']} | Mech: {v['mechanics']} | {v['desc'][:60]}")
