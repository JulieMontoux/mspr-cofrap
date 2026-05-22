import json
import unittest
from unittest.mock import patch, MagicMock
import handler


class FakeEvent:
    def __init__(self, data, method="POST"):
        self.body = json.dumps(data).encode("utf-8")
        self.method = method


class TestGenerateStrongPassword(unittest.TestCase):

    def test_length_is_24(self):
        pwd = handler.generate_strong_password()
        self.assertEqual(len(pwd), 24)

    def test_has_uppercase(self):
        pwd = handler.generate_strong_password()
        self.assertTrue(any(c.isupper() for c in pwd))

    def test_has_lowercase(self):
        pwd = handler.generate_strong_password()
        self.assertTrue(any(c.islower() for c in pwd))

    def test_has_digit(self):
        pwd = handler.generate_strong_password()
        self.assertTrue(any(c.isdigit() for c in pwd))

    def test_has_special_char(self):
        special = "!@#$%^&*()-_=+[]{}|;:,.<>?"
        pwd = handler.generate_strong_password()
        self.assertTrue(any(c in special for c in pwd))

    def test_passwords_are_unique(self):
        passwords = {handler.generate_strong_password() for _ in range(10)}
        self.assertGreater(len(passwords), 1)


class TestHandle(unittest.TestCase):

    def _event(self, data, method="POST"):
        return FakeEvent(data, method)

    # ── CORS ─────────────────────────────────────────────────────

    def test_options_returns_200(self):
        res = handler.handle(self._event({}, method="OPTIONS"), None)
        self.assertEqual(res["statusCode"], 200)
        self.assertIn("Access-Control-Allow-Origin", res["headers"])

    @patch.object(handler, "read_secret", return_value="fake")
    @patch.object(handler, "psycopg2")
    def test_success_response_includes_cors_header(self, mock_pg, _):
        mock_cur = MagicMock()
        mock_cur.fetchone.return_value = None
        mock_pg.connect.return_value.cursor.return_value = mock_cur
        res = handler.handle(self._event({"username": "alice"}), None)
        self.assertIn("Access-Control-Allow-Origin", res["headers"])

    # ── Input validation ─────────────────────────────────────────

    def test_missing_username_returns_400(self):
        res = handler.handle(self._event({}), None)
        self.assertEqual(res["statusCode"], 400)

    def test_username_too_short_returns_400(self):
        res = handler.handle(self._event({"username": "ab"}), None)
        self.assertEqual(res["statusCode"], 400)

    def test_username_too_long_returns_400(self):
        res = handler.handle(self._event({"username": "a" * 33}), None)
        self.assertEqual(res["statusCode"], 400)

    def test_username_with_spaces_returns_400(self):
        res = handler.handle(self._event({"username": "alice bob"}), None)
        self.assertEqual(res["statusCode"], 400)

    def test_username_with_special_chars_returns_400(self):
        res = handler.handle(self._event({"username": "alice@bob"}), None)
        self.assertEqual(res["statusCode"], 400)

    # ── DB logic ─────────────────────────────────────────────────

    @patch.object(handler, "read_secret", return_value="fake")
    @patch.object(handler, "psycopg2")
    def test_existing_username_returns_409(self, mock_pg, _):
        mock_cur = MagicMock()
        mock_cur.fetchone.return_value = (1,)
        mock_pg.connect.return_value.cursor.return_value = mock_cur
        res = handler.handle(self._event({"username": "alice"}), None)
        self.assertEqual(res["statusCode"], 409)
        self.assertIn("already exists", json.loads(res["body"])["error"])

    @patch.object(handler, "read_secret", return_value="fake")
    @patch.object(handler, "psycopg2")
    def test_success_returns_200_with_expected_keys(self, mock_pg, _):
        mock_cur = MagicMock()
        mock_cur.fetchone.return_value = None
        mock_pg.connect.return_value.cursor.return_value = mock_cur
        res = handler.handle(self._event({"username": "alice"}), None)
        self.assertEqual(res["statusCode"], 200)
        body = json.loads(res["body"])
        self.assertEqual(body["username"], "alice")
        self.assertIn("generated_password", body)
        self.assertIn("qr_code_base64", body)

    @patch.object(handler, "read_secret", return_value="fake")
    @patch.object(handler, "psycopg2")
    def test_generated_password_is_24_chars(self, mock_pg, _):
        mock_cur = MagicMock()
        mock_cur.fetchone.return_value = None
        mock_pg.connect.return_value.cursor.return_value = mock_cur
        res = handler.handle(self._event({"username": "alice"}), None)
        body = json.loads(res["body"])
        self.assertEqual(len(body["generated_password"]), 24)

    @patch.object(handler, "read_secret", return_value="fake")
    @patch.object(handler, "psycopg2")
    def test_qr_code_is_non_empty_base64(self, mock_pg, _):
        mock_cur = MagicMock()
        mock_cur.fetchone.return_value = None
        mock_pg.connect.return_value.cursor.return_value = mock_cur
        res = handler.handle(self._event({"username": "alice"}), None)
        body = json.loads(res["body"])
        self.assertGreater(len(body["qr_code_base64"]), 0)
