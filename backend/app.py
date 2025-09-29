from flask import Flask, request, jsonify
from flask_cors import CORS
import psycopg2
import os
from dotenv import load_dotenv
import stripe
from twilio.rest import Client

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)

# ----------------------------
# Environment Variables
# ----------------------------
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:midhun@localhost:5432/TravelAssist")
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "sk_test_51RVEET05nKuppbvM3AwDIOdhcH254cXss38EChAcFd7mCPMKYUCMd5FirLUEhzTx4bsMwRgNUB8DjbvQnYKqAcrN00rBWbPhRK")
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID", "AC378a29f2c78f917c66ddc8e8976f7a6c")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "bfda604e94a18070711f1c6544383e20")
TWILIO_MESSAGING_SID = os.getenv("TWILIO_MESSAGING_SID", "MG8f6dd8c0a9eaea8cb5f784a3c28f5205")
PORT = int(os.getenv("PORT", 5000))

# ----------------------------
# Stripe
# ----------------------------
stripe.api_key = STRIPE_SECRET_KEY

# ----------------------------
# Twilio Client
# ----------------------------
twilio_client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)

# ----------------------------
# Database Connection
# ----------------------------
try:
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = True
    cur = conn.cursor()
    print("PostgreSQL connected successfully")
except Exception as e:
    print("Database connection error:", e)

# ----------------------------
# User Signup
# ----------------------------
@app.route('/signup', methods=['POST'])
def signup():
    data = request.json
    name = data.get("name")
    email = data.get("email")
    phone = data.get("phone")
    password = data.get("password")  # Note: Hash in production!

    if not all([name, email, phone, password]):
        return jsonify({"status": "error", "message": "All fields are required"}), 400

    try:
        cur.execute(
            "INSERT INTO users (name,email,phone,password) VALUES (%s,%s,%s,%s) RETURNING id",
            (name, email, phone, password)
        )
        user_id = cur.fetchone()[0]
        return jsonify({"status": "success", "user_id": user_id})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400

# ----------------------------
# User Login
# ----------------------------
@app.route('/login', methods=['POST'])
def login():
    data = request.json
    email = data.get("email")
    password = data.get("password")
    cur.execute(
        "SELECT id,name,email,phone FROM users WHERE email=%s AND password=%s",
        (email, password)
    )
    user = cur.fetchone()
    if user:
        return jsonify({
            "status": "success",
            "user": {"id": user[0], "name": user[1], "email": user[2], "phone": user[3]}
        })
    return jsonify({"status": "error", "message": "Invalid credentials"}), 401

# ----------------------------
# Create Booking
# ----------------------------
@app.route('/bookings', methods=['POST'])
def create_booking():
    data = request.json
    user_id = data.get("user_id")  # Can be None for guest
    btype = data.get("type")
    name = data.get("name")
    phone = data.get("phone")
    email = data.get("email")
    date = data.get("date")
    time = data.get("time")
    flight_train = data.get("flight_train")
    station = data.get("station")
    services = data.get("services")
    total = data.get("total_amount")

    if not all([btype, name, phone, date, time, flight_train, station, services, total]):
        return jsonify({"status": "error", "message": "Missing required booking fields"}), 400

    try:
        cur.execute(
            "INSERT INTO bookings (user_id,type,name,phone,email,date,time,flight_train,station,services,total_amount) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id",
            (user_id, btype, name, phone, email, date, time, flight_train, station, services, total)
        )
        booking_id = cur.fetchone()[0]
        return jsonify({"status": "success", "booking_id": booking_id})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 400

# ----------------------------
# Get All Bookings (Admin)
# ----------------------------
@app.route('/admin/bookings', methods=['GET'])
def get_bookings():
    cur.execute("SELECT * FROM bookings ORDER BY created_at DESC")
    rows = cur.fetchall()
    columns = [desc[0] for desc in cur.description]
    bookings = [dict(zip(columns,row)) for row in rows]
    return jsonify(bookings)

# ----------------------------
# Approve Booking & Send SMS (Admin)
# ----------------------------
@app.route('/admin/bookings/<int:booking_id>/approve', methods=['PATCH'])
def approve_booking(booking_id):
    cur.execute("SELECT phone,name,type FROM bookings WHERE id=%s", (booking_id,))
    booking = cur.fetchone()
    if not booking:
        return jsonify({"status": "error", "message": "Booking not found"}), 404

    phone, name, btype = booking
    # Update status
    cur.execute("UPDATE bookings SET status='Approved' WHERE id=%s", (booking_id,))

    # Send SMS
    try:
        msg = f"Hello {name}, your {btype} booking has been approved! - Travel Assist"
        twilio_client.messages.create(
            body=msg,
            messaging_service_sid=TWILIO_MESSAGING_SID,
            to=phone
        )
    except Exception as e:
        print("Twilio SMS error:", e)

    return jsonify({"status": "success", "message": "Booking approved and SMS sent"})

# ----------------------------
# Stripe Payment Intent
# ----------------------------
@app.route('/create-payment-intent', methods=['POST'])
def create_payment():
    data = request.json
    if not data or "amount" not in data or data["amount"] is None:
        return jsonify({"error": "Amount is missing"}), 400

    try:
        amount = int(float(data["amount"]) * 100)  # INR to paise
        intent = stripe.PaymentIntent.create(
            amount=amount,
            currency='inr',
            payment_method_types=["card"]
        )
        return jsonify({"clientSecret": intent.client_secret})
    except Exception as e:
        return jsonify({"error": str(e)}), 400

# ----------------------------
# Run Server
# ----------------------------
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=PORT, debug=True)
