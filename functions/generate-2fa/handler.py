import json
import re
import psycopg2
import pyotp
import qrcode
import io
import base64

USERNAME_RE = re.compile(r'^[a-zA-Z0-9_-]{3,32}$')

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}


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
        if not cur.fetchone():
            conn.close()
            return {
                "statusCode": 404,
                "headers": CORS_HEADERS,
                "body": json.dumps({"error": "user not found"})
            }

        totp_secret = pyotp.random_base32()
        cur.execute("UPDATE users SET mfa = %s WHERE username = %s", (totp_secret, username))
        conn.commit()

        totp = pyotp.TOTP(totp_secret)
        uri = totp.provisioning_uri(name=username, issuer_name="MSPR-Cofrap")

        qr = qrcode.make(uri)
        buffered = io.BytesIO()
        qr.save(buffered, format="PNG")
        qr_base64 = base64.b64encode(buffered.getvalue()).decode("utf-8")

        cur.close()
        conn.close()

        return {
            "statusCode": 200,
            "headers": CORS_HEADERS,
            "body": json.dumps({
                "username": username,
                "qr_code_base64": qr_base64
            })
        }

    except Exception as e:
        return {
            "statusCode": 500,
            "headers": CORS_HEADERS,
            "body": json.dumps({"error": str(e)})
        }
