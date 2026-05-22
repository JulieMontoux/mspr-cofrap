import json
import psycopg2
import bcrypt
import pyotp
import time

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
}


def read_secret(secret_name):
    with open(f"/var/openfaas/secrets/{secret_name}", "r") as f:
        return f.read().strip()


def handle(event, context):
    if event.method == "OPTIONS":
        return {"statusCode": 200, "headers": CORS_HEADERS, "body": ""}

    try:
        data = json.loads(event.body.decode("utf-8"))

        username = data.get("username")
        password = data.get("password")
        otp = data.get("otp")

        if not username or not password or not otp:
            return {
                "statusCode": 400,
                "headers": CORS_HEADERS,
                "body": json.dumps({"error": "username, password and otp are required"})
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

        cur.execute("""
            SELECT password,
                   mfa,
                   gendate,
                   expired,
                   COALESCE(failed_attempts, 0),
                   locked_until
            FROM users
            WHERE username = %s
        """, (username,))

        user = cur.fetchone()

        if not user:
            conn.close()
            return {
                "statusCode": 404,
                "headers": CORS_HEADERS,
                "body": json.dumps({"error": "user not found"})
            }

        stored_hash, mfa_secret, gendate, expired, failed_attempts, locked_until = user
        failed_attempts = failed_attempts or 0
        now = int(time.time())

        # Account lock
        if locked_until and now < locked_until:
            conn.close()
            return {
                "statusCode": 403,
                "headers": CORS_HEADERS,
                "body": json.dumps({"error": "account temporarily locked"})
            }

        # Expired flag
        if expired:
            conn.close()
            return {
                "statusCode": 403,
                "headers": CORS_HEADERS,
                "body": json.dumps({
                    "error": "credentials_expired",
                    "message": "Your credentials have expired. Please renew your password and 2FA.",
                    "action": "renew"
                })
            }

        # 6-month expiration
        if gendate and now - gendate > 60 * 60 * 24 * 180:
            cur.execute("UPDATE users SET expired = true WHERE username = %s", (username,))
            conn.commit()
            conn.close()
            return {
                "statusCode": 403,
                "headers": CORS_HEADERS,
                "body": json.dumps({
                    "error": "credentials_expired",
                    "message": "Your credentials have expired. Please renew your password and 2FA.",
                    "action": "renew"
                })
            }

        # Incomplete registration: 2FA not set up yet
        if not mfa_secret:
            conn.close()
            return {
                "statusCode": 403,
                "headers": CORS_HEADERS,
                "body": json.dumps({
                    "error": "account_setup_incomplete",
                    "message": "2FA setup not completed. Please register again.",
                    "action": "renew"
                })
            }

        # Authentication checks
        auth_failed = False

        if not bcrypt.checkpw(password.encode(), stored_hash.encode()):
            auth_failed = True
        else:
            if not pyotp.TOTP(mfa_secret).verify(otp):
                auth_failed = True

        if auth_failed:
            new_attempts = failed_attempts + 1

            if new_attempts >= 5:
                cur.execute(
                    "UPDATE users SET failed_attempts = %s, locked_until = %s WHERE username = %s",
                    (new_attempts, now + 300, username)
                )
            else:
                cur.execute(
                    "UPDATE users SET failed_attempts = %s WHERE username = %s",
                    (new_attempts, username)
                )

            conn.commit()
            conn.close()

            return {
                "statusCode": 401,
                "headers": CORS_HEADERS,
                "body": json.dumps({"error": "invalid credentials"})
            }

        # Success — reset attempts
        cur.execute(
            "UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE username = %s",
            (username,)
        )
        conn.commit()
        conn.close()

        return {
            "statusCode": 200,
            "headers": CORS_HEADERS,
            "body": json.dumps({"message": "authentication successful"})
        }

    except Exception as e:
        return {
            "statusCode": 500,
            "headers": CORS_HEADERS,
            "body": json.dumps({"error": str(e)})
        }
