def _setup(client):
    cls = client.post("/api/classrooms", json={"title": "Fractions", "lesson_notes": "A fraction is part of a whole."}).json()
    T = {"X-Teacher-Token": cls["teacher_token"]}
    s = client.post(f"/api/join/{cls['code']}", json={"language": "en", "display_name": "Aarav"}).json()
    S = {"X-Student-Token": s["student_token"]}
    client.post("/api/student/questions", json={"text": "Why is 1/8 smaller than 1/4?"}, headers=S)
    return cls, T, S


def test_parent_must_be_verified_by_teacher(client):
    cls, T, S = _setup(client)
    cid = cls["id"]

    family = client.get("/api/student/family", headers=S).json()
    code = family["family_code"]
    assert len(code) == 8 and family["parents"] == []

    # Wrong code
    assert client.post("/api/parents/link", json={"family_code": "NOPE1234", "name": "X"}).status_code == 404

    # Link -> pending, no access yet
    r = client.post("/api/parents/link", json={"family_code": code.lower(), "name": "Sunita", "relation": "Mother", "language": "hi"})
    assert r.status_code == 201
    link = r.json()
    P = {"X-Parent-Token": link["parent_token"]}
    assert link["status"] == "pending" and link["child_name"] == "Aarav"
    assert client.get("/api/parent/overview", headers=P).status_code == 403
    assert client.post("/api/parent/tips", headers=P).status_code == 403
    assert client.get("/api/parent/me", headers=P).json()["parent_token"] is None  # token only returned once

    # Student sees the request; teacher sees it too
    assert client.get("/api/student/family", headers=S).json()["parents"][0]["status"] == "pending"
    pending = client.get(f"/api/teacher/classrooms/{cid}/parents", headers=T).json()
    assert pending[0]["name"] == "Sunita" and pending[0]["student_name"] == "Aarav"
    assert client.get(f"/api/teacher/classrooms/{cid}/dashboard", headers=T).json()["parents"][0]["status"] == "pending"

    # Another classroom's teacher cannot verify this parent
    other = client.post("/api/classrooms", json={"title": "Other"}).json()
    r = client.post(f"/api/teacher/classrooms/{other['id']}/parents/{link['parent_id']}/verify",
                    headers={"X-Teacher-Token": other["teacher_token"]})
    assert r.status_code == 404

    # Teacher verifies
    r = client.post(f"/api/teacher/classrooms/{cid}/parents/{link['parent_id']}/verify", headers=T)
    assert r.json()["status"] == "verified"

    # Now the parent sees the child's work, translated into Hindi
    ov = client.get("/api/parent/overview", headers=P).json()
    assert ov["language"] == "hi" and ov["child_name"] == "Aarav"
    assert ov["lesson_notes"].startswith("[Hindi]")
    q = ov["questions"][0]
    assert q["original"] == "Why is 1/8 smaller than 1/4?"
    assert q["translated"] == "[Hindi] Why is 1/8 smaller than 1/4?"
    assert q["answer"].startswith("[Hindi]")
    assert ov["stats"]["questions"] == 1

    tips = client.post("/api/parent/tips", headers=P).json()
    assert tips["tips"] and tips["conversation_starters"] and "Hindi" in tips["summary"]

    # Switch to French
    client.patch("/api/parent/me", json={"language": "fr"}, headers=P)
    assert client.get("/api/parent/overview", headers=P).json()["questions"][0]["translated"].startswith("[French]")


def test_rejected_parent_has_no_access(client):
    cls, T, S = _setup(client)
    code = client.get("/api/student/family", headers=S).json()["family_code"]
    link = client.post("/api/parents/link", json={"family_code": code, "name": "Stranger"}).json()
    client.post(f"/api/teacher/classrooms/{cls['id']}/parents/{link['parent_id']}/reject", headers=T)
    r = client.get("/api/parent/overview", headers={"X-Parent-Token": link["parent_token"]})
    assert r.status_code == 403 and "rejected" in r.json()["detail"]


def test_translations_are_cached(client):
    from app.ai.service import AIService
    from app.ai.mock import MockProvider
    from app.db import SessionLocal
    from app.translation import translate_cached

    calls = []

    class Counting(MockProvider):
        def _translate_batch(self, p):
            calls.append(len(p["texts"]))
            return super()._translate_batch(p)

    ai = AIService(Counting())
    with SessionLocal() as db:
        assert translate_cached(db, ai, ["hello cache", "hello cache", "two"], "fr") == ["[French] hello cache"] * 2 + ["[French] two"]
        assert translate_cached(db, ai, ["two", "hello cache"], "fr") == ["[French] two", "[French] hello cache"]
    assert calls == [2]  # duplicates collapsed, second call fully served from cache
