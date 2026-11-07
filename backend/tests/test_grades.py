def _class_with_parent(client, parent_lang="hi"):
    cls = client.post("/api/classrooms", json={"title": "Fractions", "lesson_notes": "A fraction is part of a whole."}).json()
    cid, T = cls["id"], {"X-Teacher-Token": cls["teacher_token"]}
    s = client.post(f"/api/join/{cls['code']}", json={"language": "en", "display_name": "Aarav"}).json()
    S = {"X-Student-Token": s["student_token"]}
    other = client.post(f"/api/join/{cls['code']}", json={"language": "fr", "display_name": "Léa"}).json()
    code = client.get("/api/student/family", headers=S).json()["family_code"]
    link = client.post("/api/parents/link", json={"family_code": code, "name": "Sunita", "relation": "Mother", "language": parent_lang})
    assert link.status_code == 201, link.text
    link = link.json()
    client.post(f"/api/teacher/classrooms/{cid}/parents/{link['parent_id']}/verify", headers=T)
    return cid, T, s["student_id"], other["student_id"], S, {"X-Parent-Token": link["parent_token"]}


def test_gradebook_and_parent_view(client):
    cid, T, aarav, lea, S, P = _class_with_parent(client)
    base = f"/api/teacher/classrooms/{cid}/assignments"

    hw = client.post(base, json={"kind": "homework", "title": "Worksheet 1", "instructions": "Shade 3/4 of each shape.",
                                 "due_date": "2026-11-14", "max_points": 10}, headers=T).json()
    test = client.post(base, json={"kind": "test", "title": "Unit test", "max_points": 20}, headers=T).json()
    client.post(base, json={"kind": "quiz", "title": "Not graded yet"}, headers=T)
    assert client.post(base, json={"kind": "exam", "title": "x"}, headers=T).status_code == 422
    assert client.post(base, json={"title": "x", "due_date": "14/11/2026"}, headers=T).status_code == 422

    # Validation: score above max, student from elsewhere
    r = client.put(f"{base}/{hw['id']}/grades", json=[{"student_id": aarav, "score": 11}], headers=T)
    assert r.status_code == 422
    r = client.put(f"{base}/{hw['id']}/grades", json=[{"student_id": 99999, "score": 1}], headers=T)
    assert r.status_code == 422

    r = client.put(f"{base}/{hw['id']}/grades", headers=T, json=[
        {"student_id": aarav, "score": 6, "feedback": "Mixed up numerator and denominator twice."},
        {"student_id": lea, "score": 9},
    ])
    assert r.status_code == 200
    view = r.json()
    assert view["graded_count"] == 2 and view["average_percent"] == 75.0
    client.put(f"{base}/{test['id']}/grades", headers=T, json=[{"student_id": aarav, "score": 18}])
    # Update in place, not duplicate
    client.put(f"{base}/{hw['id']}/grades", headers=T, json=[{"student_id": aarav, "score": 7, "feedback": "Mixed up numerator and denominator twice."}])
    listed = client.get(base, headers=T).json()
    assert [g["score"] for g in listed[0]["grades"]] == [7, 9]
    assert len(client.get(f"/api/teacher/classrooms/{cid}/dashboard", headers=T).json()["assignments"]) == 3

    # A question that the radar groups into a misconception
    client.post("/api/student/questions", json={"text": "Why is 1/8 smaller than 1/4?"}, headers=S)
    client.post(f"/api/teacher/classrooms/{cid}/analyze", headers=T)

    ov = client.get("/api/parent/overview", headers=P).json()
    hw_view = next(a for a in ov["assignments"] if a["kind"] == "homework")
    assert hw_view["title"] == "[Hindi] Worksheet 1"
    assert hw_view["instructions"] == "[Hindi] Shade 3/4 of each shape."
    assert hw_view["feedback"] == "[Hindi] Mixed up numerator and denominator twice."
    assert hw_view["score"] == 7 and hw_view["percent"] == 70.0 and hw_view["due_date"] == "2026-11-14"
    assert next(a for a in ov["assignments"] if a["title"].endswith("Not graded yet"))["score"] is None
    assert ov["grade_summary"] == {"homework": 70.0, "test": 90.0, "overall": 80.0}
    assert ov["stats"]["assignments"] == 3 and ov["stats"]["graded"] == 2

    m = ov["class_mistakes"][0]
    assert m["child_affected"] is True and m["title"].startswith("[Hindi]")

    tips = client.post("/api/parent/tips", headers=P).json()
    assert tips["weak_areas"][0]["area"] and "2 grades" in tips["weak_areas"][0]["evidence"]

    # Teacher can delete an assignment
    assert client.delete(f"{base}/{test['id']}", headers=T).status_code == 204
    assert len(client.get(base, headers=T).json()) == 2


def test_parent_in_any_language(client):
    cid, T, _a, _l, S, P = _class_with_parent(client, parent_lang="es")
    assert client.get("/api/parent/me", headers=P).json()["language"] == "es"
    ov = client.get("/api/parent/overview", headers=P).json()
    assert ov["lesson_notes"].startswith("[Spanish]")

    # Unsupported languages are rejected
    assert client.patch("/api/parent/me", json={"language": "xx"}, headers=P).status_code == 422
    assert client.patch("/api/parent/me", json={"language": "ar"}, headers=P).json()["language"] == "ar"

    # Portal labels for languages without built-in text
    r = client.post("/api/parent/ui-strings", json={"language": "ta", "texts": ["Grades", "Homework"]})
    assert r.json() == ["[Tamil] Grades", "[Tamil] Homework"]
    assert client.post("/api/parent/ui-strings", json={"language": "zz", "texts": ["x"]}).status_code == 422
    assert client.post("/api/parent/ui-strings", json={"language": "es", "texts": ["x" * 401]}).status_code == 422
    assert "pa" in client.get("/api/meta").json()["parent_languages"]
