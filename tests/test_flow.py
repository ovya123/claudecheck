from app.ai.mock import MockProvider
from app.ai.service import AIService
from app.templates import validate_template

QUESTIONS = {
    "en": "Why is 1/8 smaller than 1/4?",
    "hi": "बड़ा हर होने पर भिन्न छोटी क्यों होती है?",
    "fr": "Pourquoi un plus grand dénominateur donne-t-il une plus petite fraction ?",
}


def test_full_classroom_flow(client):
    # 1. Teacher creates class
    r = client.post("/api/classrooms", json={
        "title": "Introduction to Fractions", "topic": "Fractions",
        "lesson_notes": "A fraction a/b means a parts out of b equal parts.",
    })
    assert r.status_code == 201, r.text
    cls = r.json()
    cid, code, T = cls["id"], cls["code"], {"X-Teacher-Token": cls["teacher_token"]}
    assert len(code) == 6

    # wrong token rejected
    assert client.get(f"/api/teacher/classrooms/{cid}", headers={"X-Teacher-Token": "nope"}).status_code == 403

    # 2. Students join in three languages
    assert client.get(f"/api/join/{code.lower()}").json()["title"] == "Introduction to Fractions"
    students = {}
    for lang in ("en", "hi", "fr"):
        r = client.post(f"/api/join/{code}", json={"language": lang})
        assert r.status_code == 201
        students[lang] = {"X-Student-Token": r.json()["student_token"]}

    # 3. Lesson in student language (translated + cached), simplified on request
    assert client.get("/api/student/lesson", headers=students["en"]).json()["notes"].startswith("A fraction")
    hi_notes = client.get("/api/student/lesson", headers=students["hi"]).json()["notes"]
    assert "[Hindi]" in hi_notes
    assert "[simplified]" in client.get("/api/student/lesson?simplified=true", headers=students["en"]).json()["notes"]

    # 4. Private multilingual questions
    for lang, text in QUESTIONS.items():
        r = client.post("/api/student/questions", json={"text": text}, headers=students[lang])
        assert r.status_code == 201, r.text
        assert r.json()["language"] == lang
        assert r.json()["answer"]
    assert len(client.get("/api/student/questions", headers=students["hi"]).json()) == 1

    # Teacher sees anonymous questions
    qs = client.get(f"/api/teacher/classrooms/{cid}/questions", headers=T).json()
    assert len(qs) == 3 and "student_id" not in qs[0]

    # 5-6. Misconception radar
    r = client.post(f"/api/teacher/classrooms/{cid}/analyze", headers=T)
    assert r.status_code == 200, r.text
    m = r.json()["misconceptions"][0]
    assert m["languages"] == ["en", "fr", "hi"]
    assert len(m["supporting_questions"]) == 3
    assert m["interventions"][0]["template"] == "fraction_pizza"

    # 7. Approve intervention -> multilingual mini-lesson
    r = client.post(f"/api/teacher/classrooms/{cid}/misconceptions/{m['id']}/approve",
                    json={"intervention_index": 0}, headers=T)
    assert r.status_code == 201, r.text
    act = r.json()
    assert set(act["content"]) == {"en", "hi", "fr"}

    # Re-analysis with no new questions -> 409
    assert client.post(f"/api/teacher/classrooms/{cid}/analyze", headers=T).status_code == 409

    # 8. Students see it localized, without the answer key; answer pre + post
    hi_act = client.get("/api/student/activities", headers=students["hi"]).json()[0]
    assert hi_act["quiz_question"] == "कौन-सी भिन्न बड़ी है?"
    assert "correct_index" not in hi_act

    aid = act["id"]
    for lang in students:  # pre-check: everyone wrong
        assert client.post(f"/api/student/activities/{aid}/responses",
                           json={"phase": "pre", "answer_index": 0}, headers=students[lang]).json()["correct"] is False
    for lang, ans in (("en", 1), ("hi", 1), ("fr", 0)):
        client.post(f"/api/student/activities/{aid}/responses",
                    json={"phase": "post", "answer_index": ans}, headers=students[lang])
    # duplicate answer rejected
    assert client.post(f"/api/student/activities/{aid}/responses",
                       json={"phase": "post", "answer_index": 1}, headers=students["en"]).status_code == 409

    # 9. Teacher results: before vs after
    res = client.get(f"/api/teacher/classrooms/{cid}/activities/{aid}/results", headers=T).json()
    assert res["pre"]["percent_correct"] == 0.0
    assert res["post"]["percent_correct"] == 66.7
    assert res["improvement_points"] == 66.7
    assert res["needs_more_support"] is True
    assert res["post"]["option_counts"] == [1, 2]

    dash = client.get(f"/api/teacher/classrooms/{cid}/dashboard", headers=T).json()
    assert dash["student_count"] == 3 and dash["questions_by_language"] == {"en": 1, "hi": 1, "fr": 1}


def test_cluster_drops_hallucinated_ids():
    class Bad(MockProvider):
        def _cluster(self, p):
            out = super()._cluster(p)
            out["misconceptions"][0]["supporting_question_ids"] += [999, 1]
            out["misconceptions"][0]["interventions"][0]["template"] = "made_up_template"
            return out

    out = AIService(Bad()).cluster_questions(lesson={}, questions=[{"id": 1, "text": "a"}, {"id": 2, "text": "b"}])
    assert out.misconceptions[0].supporting_question_ids == [1, 2]
    assert out.misconceptions[0].interventions[0].template == "fraction_pizza"


def test_template_validation_falls_back():
    assert validate_template("fraction_pizza", {"denominators": [4, 99]})[1]["denominators"] == [4, 8]
    assert validate_template("number_line", {"fractions": ["3/ 4", "5/2"], "max_value": 3})[1]["fractions"] == ["3/4", "5/2"]
