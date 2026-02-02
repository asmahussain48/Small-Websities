from flask import Flask, render_template, request, jsonify

app = Flask(__name__)


def chatbot_reply(text):

    text = text.lower()

    if "hi" in text or "hello" in text:
        return "Hello 😊 How can I help you?"

    elif "name" in text:
        return "I am your AI Bot 🤖"

    elif "bye" in text:
        return "Goodbye 👋"

    elif "help" in text:
        return "Sure, tell me your problem."

    else:
        return "Sorry, I didn't understand 😅"


@app.route("/")
def home():
    return render_template("index.html")


@app.route("/chat", methods=["POST"])
def chat():

    data = request.get_json()

    user_msg = data.get("message")

    reply = chatbot_reply(user_msg)

    return jsonify({"reply": reply})


if __name__ == "__main__":
    app.run(debug=True)
