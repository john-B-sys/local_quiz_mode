LOCAL QUIZ WEBSITE

Files:
- index.html: webpage structure
- style.css: design
- script.js: loads questions and handles question navigation/selection
- questions.json: sample questions; replace these with your dataset

IMPORTANT:
The sample questions.json is only an example. Keep the same field structure:
[
  {
    "id": 1,
    "question": "Question text",
    "options": { "a": "Option A", "b": "Option B", "c": "Option C", "d": "Option D" },
    "answer": "a",
    "explanation": "Explanation text"
  }
]

Options may also be an array, e.g. ["Option A", "Option B", "Option C", "Option D"].
For an options array, the choices are labeled A, B, C, D in order.

RUN LOCALLY ON WINDOWS:
1. Extract this ZIP.
2. Open the extracted local_quiz_website folder in VS Code.
3. Open Terminal > New Terminal.
4. Run: py -m http.server 8000
5. Open http://localhost:8000 in your browser.
6. Keep the terminal running while you use the website. Press Ctrl+C to stop it.

This version includes question display, answer selection, and Previous/Next navigation.
It does not yet calculate scores, reveal correct answers, show explanations, or reset the quiz.
Because questions.json contains answer keys, do not use this version for secure exams.
