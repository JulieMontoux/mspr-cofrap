import json
import unittest
from unittest.mock import patch, MagicMock
import handler

VALID = {"username": "alice", "password": "pwd", "otp": "123456"}


class FakeEvent:
    def __init__(self, data, method="POST"):
        self.body = json.dumps(data).encode("utf-8")
        self.method = method


def _mock_db(row):
    mock_cur = MagicMock()
    mock_cur.fetchone.return_value = row
    mock_conn = MagicMock()
    mock_conn.cursor.return_value = mock_cur
    return mock_conn, mock_cur


class TestAuthenticate(unittest.TestCase):

    def _event(self, data=None, method="POST"):
        return FakeEvent(data if data is not None else VALID, method)

    # ── CORS ─────────────────────────────────────────────────────

    def test_options_returns_200(self):
        res = handler.handle(self._event({}, method="OPTIONS"), None)
        self.assertEqual(res["statusCode"], 200)
        self.assertIn("Access-Control-Allow-Origin", res["headers"])

    @patch.object(handler, "read_secret", return_value="x")
    @patch.object(handler, "psycopg2")
    @patch.object(handler, "bcrypt")
    @patch.object(handler, "pyotp")
    @patch.object(handler, "time")
    def test_success_response_includes_cors_header(self, mock_time, mock_pyotp, mock_bcrypt, mock_pg, _):
        mock_time.time.return_value = 1000
        conn, cur = _mock_db(("hash", "secret", 500, False, 0, None))
        mock_pg.connect.return_value = conn
        mock_bcrypt.checkpw.return_value = True
        mock_pyotp.TOTP.return_value.verify.return_value = True
        res = handler.handle(self._event(), None)
        self.assertIn("Access-Control-Allow-Origin", res["headers"])

    # ── Input validation ─────────────────────────────────────────

    def test_missing_fields_returns_400(self):
        res = handler.handle(FakeEvent({"username": "alice"}), None)
        self.assertEqual(res["statusCode"], 400)

    def test_empty_body_returns_400(self):
        res = handler.handle(FakeEvent({}), None)
        self.assertEqual(res["statusCode"], 400)

    # ── DB lookup ────────────────────────────────────────────────

    @patch.object(handler, "read_secret", return_value="x")
    @patch.object(handler, "psycopg2")
    def test_unknown_user_returns_404(self, mock_pg, _):
        conn, cur = _mock_db(None)
        mock_pg.connect.return_value = conn
        res = handler.handle(self._event(), None)
        self.assertEqual(res["statusCode"], 404)

    # ── Lock / expiration checks ─────────────────────────────────

    @patch.object(handler, "read_secret", return_value="x")
    @patch.object(handler, "psycopg2")
    @patch.object(handler, "time")
    def test_locked_account_returns_403(self, mock_time, mock_pg, _):
        mock_time.time.return_value = 1000
        conn, cur = _mock_db(("hash", "secret", 0, False, 0, 2000))
        mock_pg.connect.return_value = conn
        res = handler.handle(self._event(), None)
        self.assertEqual(res["statusCode"], 403)
        self.assertIn("locked", json.loads(res["body"])["error"])

    @patch.object(handler, "read_secret", return_value="x")
    @patch.object(handler, "psycopg2")
    @patch.object(handler, "time")
    def test_expired_flag_returns_403_with_renew_action(self, mock_time, mock_pg, _):
        mock_time.time.return_value = 1000
        conn, cur = _mock_db(("hash", "secret", 0, True, 0, None))
        mock_pg.connect.return_value = conn
        res = handler.handle(self._event(), None)
        self.assertEqual(res["statusCode"], 403)
        self.assertEqual(json.loads(res["body"])["action"], "renew")

    @patch.object(handler, "read_secret", return_value="x")
    @patch.object(handler, "psycopg2")
    @patch.object(handler, "time")
    def test_credentials_older_than_6_months_return_403_with_renew(self, mock_time, mock_pg, _):
        now = 10_000_000
        gendate_181_days_ago = now - (60 * 60 * 24 * 181)
        mock_time.time.return_value = now
        conn, cur = _mock_db(("hash", "secret", gendate_181_days_ago, False, 0, None))
        mock_pg.connect.return_value = conn
        res = handler.handle(self._event(), None)
        self.assertEqual(res["statusCode"], 403)
        self.assertEqual(json.loads(res["body"])["action"], "renew")

    @patch.object(handler, "read_secret", return_value="x")
    @patch.object(handler, "psycopg2")
    @patch.object(handler, "bcrypt")
    @patch.object(handler, "pyotp")
    @patch.object(handler, "time")
    def test_credentials_at_179_days_are_not_expired(self, mock_time, mock_pyotp, mock_bcrypt, mock_pg, _):
        now = 10_000_000
        gendate_179_days_ago = now - (60 * 60 * 24 * 179)
        mock_time.time.return_value = now
        conn, cur = _mock_db(("hash", "secret", gendate_179_days_ago, False, 0, None))
        mock_pg.connect.return_value = conn
        mock_bcrypt.checkpw.return_value = True
        mock_pyotp.TOTP.return_value.verify.return_value = True
        res = handler.handle(self._event(), None)
        self.assertEqual(res["statusCode"], 200)

    # ── Incomplete registration ───────────────────────────────────

    @patch.object(handler, "read_secret", return_value="x")
    @patch.object(handler, "psycopg2")
    @patch.object(handler, "time")
    def test_missing_mfa_secret_returns_403_with_renew(self, mock_time, mock_pg, _):
        mock_time.time.return_value = 1000
        # mfa=None: password generated but 2FA setup not completed
        conn, cur = _mock_db(("hash", None, 500, False, 0, None))
        mock_pg.connect.return_value = conn
        res = handler.handle(self._event(), None)
        self.assertEqual(res["statusCode"], 403)
        body = json.loads(res["body"])
        self.assertEqual(body["error"], "account_setup_incomplete")
        self.assertEqual(body["action"], "renew")

    # ── Authentication failures ──────────────────────────────────

    @patch.object(handler, "read_secret", return_value="x")
    @patch.object(handler, "psycopg2")
    @patch.object(handler, "bcrypt")
    @patch.object(handler, "time")
    def test_wrong_password_returns_401(self, mock_time, mock_bcrypt, mock_pg, _):
        mock_time.time.return_value = 1000
        conn, cur = _mock_db(("hash", "secret", 500, False, 0, None))
        mock_pg.connect.return_value = conn
        mock_bcrypt.checkpw.return_value = False
        res = handler.handle(self._event(), None)
        self.assertEqual(res["statusCode"], 401)
        self.assertIn("invalid credentials", json.loads(res["body"])["error"])

    @patch.object(handler, "read_secret", return_value="x")
    @patch.object(handler, "psycopg2")
    @patch.object(handler, "bcrypt")
    @patch.object(handler, "pyotp")
    @patch.object(handler, "time")
    def test_wrong_otp_returns_401(self, mock_time, mock_pyotp, mock_bcrypt, mock_pg, _):
        mock_time.time.return_value = 1000
        conn, cur = _mock_db(("hash", "secret", 500, False, 0, None))
        mock_pg.connect.return_value = conn
        mock_bcrypt.checkpw.return_value = True
        mock_pyotp.TOTP.return_value.verify.return_value = False
        res = handler.handle(self._event(), None)
        self.assertEqual(res["statusCode"], 401)

    # ── Lockout after 5 failures ─────────────────────────────────

    @patch.object(handler, "read_secret", return_value="x")
    @patch.object(handler, "psycopg2")
    @patch.object(handler, "bcrypt")
    @patch.object(handler, "time")
    def test_5th_failure_sets_locked_until(self, mock_time, mock_bcrypt, mock_pg, _):
        mock_time.time.return_value = 1000
        conn, cur = _mock_db(("hash", "secret", 500, False, 4, None))
        mock_pg.connect.return_value = conn
        mock_bcrypt.checkpw.return_value = False
        handler.handle(self._event(), None)
        last_sql = cur.execute.call_args_list[-1][0][0]
        self.assertIn("locked_until", last_sql)

    @patch.object(handler, "read_secret", return_value="x")
    @patch.object(handler, "psycopg2")
    @patch.object(handler, "bcrypt")
    @patch.object(handler, "time")
    def test_4th_failure_does_not_set_locked_until(self, mock_time, mock_bcrypt, mock_pg, _):
        mock_time.time.return_value = 1000
        conn, cur = _mock_db(("hash", "secret", 500, False, 3, None))
        mock_pg.connect.return_value = conn
        mock_bcrypt.checkpw.return_value = False
        handler.handle(self._event(), None)
        last_sql = cur.execute.call_args_list[-1][0][0]
        self.assertNotIn("locked_until", last_sql)

    # ── Successful authentication ────────────────────────────────

    @patch.object(handler, "read_secret", return_value="x")
    @patch.object(handler, "psycopg2")
    @patch.object(handler, "bcrypt")
    @patch.object(handler, "pyotp")
    @patch.object(handler, "time")
    def test_success_returns_200(self, mock_time, mock_pyotp, mock_bcrypt, mock_pg, _):
        mock_time.time.return_value = 1000
        conn, cur = _mock_db(("hash", "secret", 500, False, 0, None))
        mock_pg.connect.return_value = conn
        mock_bcrypt.checkpw.return_value = True
        mock_pyotp.TOTP.return_value.verify.return_value = True
        res = handler.handle(self._event(), None)
        self.assertEqual(res["statusCode"], 200)
        self.assertIn("successful", json.loads(res["body"])["message"])

    @patch.object(handler, "read_secret", return_value="x")
    @patch.object(handler, "psycopg2")
    @patch.object(handler, "bcrypt")
    @patch.object(handler, "pyotp")
    @patch.object(handler, "time")
    def test_success_resets_failed_attempts_to_zero(self, mock_time, mock_pyotp, mock_bcrypt, mock_pg, _):
        mock_time.time.return_value = 1000
        conn, cur = _mock_db(("hash", "secret", 500, False, 3, None))
        mock_pg.connect.return_value = conn
        mock_bcrypt.checkpw.return_value = True
        mock_pyotp.TOTP.return_value.verify.return_value = True
        handler.handle(self._event(), None)
        last_sql = cur.execute.call_args_list[-1][0][0]
        self.assertIn("failed_attempts = 0", last_sql)
