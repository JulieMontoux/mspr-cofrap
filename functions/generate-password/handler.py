import string
import secrets
import json
import time
import psycopg2
import bcrypt


def generate_strong_password(length=24):
    uppercase = string.ascii_uppercase
    lowercase = string.ascii_lowercase
    digits = string.digits
    special = "!@#$%^&*()-_=+[]{}|;:,.<>?"

    all_chars = uppercase + lowercase + digits + special

    # Garantit au moins 1 de chaque type
    password = [
        secrets.choice(uppercase),
        secrets.choice(lowercase),
        secrets.choice(digits),
        secrets.choice(special)
    ]

    # Complète le reste
    password += [secrets.choice(all_chars) for _ in range(length - 4)]

    # Mélange
    secrets.SystemRandom().shuffle(password)

    return ''.join(password)


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

        password_plain = generate_strong_password()

        # Hash password
        password_hash = bcrypt.hashpw(
            password_plain.encode("utf-8"),
            bcrypt.gensalt()
        ).decode("utf-8")

        # Read DB secrets
        db_host = read_secret("db-host")
        db_user = read_secret("db-user")
        db_password = read_secret("db-password")
        db_name = read_secret("db-name")

        # Connect to PostgreSQL
        conn = psycopg2.connect(
            host=db_host,
            user=db_user,
            password=db_password,
            dbname=db_name
        )

        cur = conn.cursor()

        # Vérifier si user existe
        cur.execute("SELECT id FROM users WHERE username = %s", (username,))
        existing_user = cur.fetchone()

        if existing_user:
            conn.close()
            return {
                "statusCode": 409,
                "body": json.dumps({"error": "username already exists"})
            }

        # Insert new user
        cur.execute("""
            INSERT INTO users (username, password, gendate, expired)
            VALUES (%s, %s, %s, %s)
        """, (username, password_hash, int(time.time()), False))

        conn.commit()
        cur.close()
        conn.close()

        return {
            "statusCode": 200,
            "body": json.dumps({
                "username": username,
                "generated_password": password_plain
            })
        }

    except Exception as e:
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e)})
        }
