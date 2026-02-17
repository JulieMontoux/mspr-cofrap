import json
import psycopg2
import bcrypt
import pyotp
import time

def read_secret(secret_name):
    with open(f'/var/openfaas/secrets/{secret_name}', 'r') as f:
        return f.read().strip()

def handle(event, context):
    try:
        data = json.loads(event.body.decode("utf-8"))
        username = data.get("username")
        password = data.get("password")
        otp = data.get("otp")

        if not username or not password or not otp:
            return {
                "statusCode": 400,
                "body": json.dumps({"error": "username, password and otp are required"})
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

        cur.execute("""
            SELECT password, mfa, gendate, expired
            FROM users
            WHERE username = %s
        """, (username,))
        user = cur.fetchone()

        if not user:
            conn.close()
            return {
                "statusCode": 404,
                "body": json.dumps({"error": "user not found"})
            }

        stored_hash, mfa_secret, gendate, expired = user

        if expired:
            conn.close()
            return {
                "statusCode": 403,
                "body": json.dumps({"error": "password expired"})
            }

        # Check 6 months expiration (approx 180 days)
        if int(time.time()) - gendate > 60 * 60 * 24 * 180:
            conn.close()
            return {
                "statusCode": 403,
                "body": json.dumps({"error": "password expired (6 months)"})
            }

        # Verify password
        if not bcrypt.checkpw(password.encode(), stored_hash.encode()):
            conn.close()
            return {
                "statusCode": 401,
                "body": json.dumps({"error": "invalid password"})
            }

        # Verify OTP
        totp = pyotp.TOTP(mfa_secret)
        if not totp.verify(otp):
            conn.close()
            return {
                "statusCode": 401,
                "body": json.dumps({"error": "invalid otp"})
            }

        conn.close()

        return {
            "statusCode": 200,
            "body": json.dumps({"message": "authentication successful"})
        }

    except Exception as e:
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e)})
        }

