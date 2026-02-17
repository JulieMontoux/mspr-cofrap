import json
import os
import psycopg2
import pyotp
import qrcode
import io
import base64

def read_secret(secret_name):
    with open(f'/var/openfaas/secrets/{secret_name}', 'r') as f:
        return f.read().strip()

def handle(event, context):
    try:
        data = json.loads(event.body.decode("utf-8"))
        username = data.get("username")

        if not username:
            return {
                "statusCode": 400,
                "body": json.dumps({"error": "username is required"})
            }

        # Read DB secrets
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

        # Check if user exists
        cur.execute("SELECT id FROM users WHERE username = %s", (username,))
        user = cur.fetchone()

        if not user:
            conn.close()
            return {
                "statusCode": 404,
                "body": json.dumps({"error": "user not found"})
            }

        # Generate TOTP secret
        totp_secret = pyotp.random_base32()

        # Save secret in DB
        cur.execute("""
            UPDATE users
            SET mfa = %s
            WHERE username = %s
        """, (totp_secret, username))

        conn.commit()

        # Generate provisioning URI
        totp = pyotp.TOTP(totp_secret)
        uri = totp.provisioning_uri(name=username, issuer_name="MSPR-Cofrap")

        # Generate QR Code
        qr = qrcode.make(uri)
        buffered = io.BytesIO()
        qr.save(buffered, format="PNG")
        qr_base64 = base64.b64encode(buffered.getvalue()).decode("utf-8")

        cur.close()
        conn.close()

        return {
            "statusCode": 200,
            "body": json.dumps({
                "username": username,
                "qr_code_base64": qr_base64
            })
        }

    except Exception as e:
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e)})
        }
