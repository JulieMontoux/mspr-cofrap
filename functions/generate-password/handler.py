import string
import secrets
import json
import time
import re
import psycopg2
import bcrypt
import qrcode
import io
import base64

USERNAME_RE = re.compile(r'^[a-zA-Z0-9_-]{3,32}$')

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}


def generate_strong_password(length=24):
    special = "!@#$%^&*()-_=+[]{}|;:,.<>?"
    pool = string.ascii_letters + string.digits + special
    pwd = [
        secrets.choice(string.ascii_uppercase),
        secrets.choice(string.ascii_lowercase),
        secrets.choice(string.digits),
        secrets.choice(special),
        *[secrets.choice(pool) for _ in range(length - 4)]
    ]
    secrets.SystemRandom().shuffle(pwd)
    return ''.join(pwd)


def read_secret(secret_name):
    with open(f'/var/openfaas/secrets/{secret_name}', 'r') as f:
        return f.read().strip()


def handle(event, context):
    if event.method == "OPTIONS":
        return {"statusCode": 200, "headers": CORS_HEADERS, "body": ""}

    try:
        data = json.loads(event.body.decode("utf-8"))
        username = data.get("username")

        if not username:
            return {
                "statusCode": 400,
                "headers": CORS_HEADERS,
                "body": json.dumps({"error": "username is required"})
            }

        if not USERNAME_RE.match(username):
            return {
                "statusCode": 400,
                "headers": CORS_HEADERS,
                "body": json.dumps({
                    "error": "username must be 3-32 characters (letters, digits, _ or -)"
                })
            }

        password_plain = generate_strong_password()

        password_hash = bcrypt.hashpw(
            password_plain.encode("utf-8"),
            bcrypt.gensalt()
        ).decode("utf-8")

        qr = qrcode.make(password_plain)
        buffered = io.BytesIO()
        qr.save(buffered, format="PNG")
        qr_base64 = base64.b64encode(buffered.getvalue()).decode("utf-8")

        db_host = read_secret("db-host")
        db_user = read_secret("db-user")
        db_password = read_secret("db-password")
        db_name = read_secret("db-name")

        conn = psycopg2.connect(
            host=db_host,
            user=db_user,
            password=db_password,
            dbname=db_name
        )
        cur = conn.cursor()

        cur.execute("SELECT id FROM users WHERE username = %s", (username,))
        if cur.fetchone():
            conn.close()
            return {
                "statusCode": 409,
                "headers": CORS_HEADERS,
                "body": json.dumps({"error": "username already exists"})
            }

        cur.execute(
            "INSERT INTO users (username, password, gendate, expired) VALUES (%s, %s, %s, %s)",
            (username, password_hash, int(time.time()), False)
        )
        conn.commit()
        cur.close()
        conn.close()

        return {
            "statusCode": 200,
            "headers": CORS_HEADERS,
            "body": json.dumps({
                "username": username,
                "generated_password": password_plain,
                "qr_code_base64": qr_base64
            })
        }

    except Exception as e:
        return {
            "statusCode": 500,
            "headers": CORS_HEADERS,
            "body": json.dumps({"error": str(e)})
        }
