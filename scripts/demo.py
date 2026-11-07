"""Rehearse the hackathon demo against a running server, using REAL AI.

    python scripts/demo.py                       # http://localhost:8000
    python scripts/demo.py https://your-api.example.com
"""

import json
import sys

import httpx

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000").rstrip("/")
c = httpx.Client(base_url=BASE, timeout=120)


def ok(r: httpx.Response) -> dict:
    if r.status_code >= 400:
        sys.exit(f"{r.request.method} {r.request.url} -> {r.status_code}: {r.text}")
    return r.json()


def show(title: str, data) -> None:
    print(f"\n=== {title} ===")
    print(json.dumps(data, ensure_ascii=False, indent=2))


cls = ok(c.post("/api/classrooms", json={
    "title": "Introduction to Fractions",
    "topic": "Fractions",
    "lesson_notes": (
        "A fraction shows part of a whole.\n"
        "- The denominator (bottom number) tells how many equal parts the whole is split into.\n"
        "- The numerator (top number) tells how many of those parts we have.\n"
        "Example: 3/4 of a pizza means the pizza is cut into 4 equal slices and we have 3."
    ),
}))
T = {"X-Teacher-Token": cls["teacher_token"]}
cid = cls["id"]
print(f"Classroom code: {cls['code']}  (id {cid})")

questions = {
    "en": "Why is 1/8 smaller than 1/4?",
    "hi": "बड़ा हर होने पर भिन्न छोटी क्यों होती है?",
    "fr": "Pourquoi un plus grand dénominateur donne-t-il une plus petite fraction ?",
}
students = {}
for lang, text in questions.items():
    s = ok(c.post(f"/api/join/{cls['code']}", json={"language": lang}))
    students[lang] = {"X-Student-Token": s["student_token"]}
    if lang == "hi":
        show("Lesson notes for the Hindi student", ok(c.get("/api/student/lesson", headers=students[lang])))
    show(f"{lang} student asks", ok(c.post("/api/student/questions", json={"text": text}, headers=students[lang])))

# One off-topic question so the radar has something to leave out
ok(c.post("/api/student/questions", json={"text": "Will this be on the test?"}, headers=students["en"]))

analysis = ok(c.post(f"/api/teacher/classrooms/{cid}/analyze", headers=T))
show("Misconception Radar", analysis)
if not analysis["misconceptions"]:
    sys.exit("No misconceptions detected.")

m = analysis["misconceptions"][0]
act = ok(c.post(f"/api/teacher/classrooms/{cid}/misconceptions/{m['id']}/approve",
                json={"intervention_index": 0}, headers=T))
show("Generated mini-lesson", act)

for lang, h in students.items():
    view = ok(c.get("/api/student/activities", headers=h))[0]
    show(f"Activity as the {lang} student sees it", view)
    correct = act["quiz"]["correct_index"]
    wrong = (correct + 1) % len(act["quiz"]["options"])
    ok(c.post(f"/api/student/activities/{act['id']}/responses", json={"phase": "pre", "answer_index": wrong}, headers=h))
    ok(c.post(f"/api/student/activities/{act['id']}/responses", json={"phase": "post", "answer_index": correct}, headers=h))

show("Teacher results", ok(c.get(f"/api/teacher/classrooms/{cid}/activities/{act['id']}/results", headers=T)))
