import json
import unittest
from unittest.mock import patch, MagicMock
import handler


class FakeEvent:
    def __init__(self, data):
        self.body = json.dumps(data).encode("utf-8")


class TestHandle(unittest.TestCase):

    def _event(self, data):
        return FakeEvent(data)

    def test_missing_username_returns_400(self):
        res = handler.handle(self._event({}), None)
        self.assertEqual(res["statusCode"], 400)
        self.assertIn("error", json.loads(res["body"]))

    @patch.object(handler, "read_secret", return_value="fake")
    @patch.object(handler, "psycopg2")
    def test_unknown_user_returns_404(self, mock_pg, _):
        mock_cur = MagicMock()
        mock_cur.fetchone.return_value = None
        mock_pg.connect.return_value.cursor.return_value = mock_cur
        res = handler.handle(self._event({"username": "ghost"}), None)
        self.assertEqual(res["statusCode"], 404)
        self.assertIn("user not found", json.loads(res["body"])["error"])

    @patch.object(handler, "read_secret", return_value="fake")
    @patch.object(handler, "psycopg2")
    def test_success_returns_200_with_username_and_qr(self, mock_pg, _):
        mock_cur = MagicMock()
        mock_cur.fetchone.return_value = (1,)
        mock_pg.connect.return_value.cursor.return_value = mock_cur
        res = handler.handle(self._event({"username": "alice"}), None)
        self.assertEqual(res["statusCode"], 200)
        body = json.loads(res["body"])
        self.assertEqual(body["username"], "alice")
        self.assertIn("qr_code_base64", body)

    @patch.object(handler, "read_secret", return_value="fake")
    @patch.object(handler, "psycopg2")
    def test_qr_code_is_non_empty_base64(self, mock_pg, _):
        mock_cur = MagicMock()
        mock_cur.fetchone.return_value = (1,)
        mock_pg.connect.return_value.cursor.return_value = mock_cur
        res = handler.handle(self._event({"username": "alice"}), None)
        body = json.loads(res["body"])
        self.assertGreater(len(body["qr_code_base64"]), 0)

    @patch.object(handler, "read_secret", return_value="fake")
    @patch.object(handler, "psycopg2")
    def test_totp_secret_saved_to_db(self, mock_pg, _):
        mock_cur = MagicMock()
        mock_cur.fetchone.return_value = (1,)
        mock_pg.connect.return_value.cursor.return_value = mock_cur
        handler.handle(self._event({"username": "alice"}), None)
        update_calls = [
            c for c in mock_cur.execute.call_args_list
            if "UPDATE" in c[0][0]
        ]
        self.assertEqual(len(update_calls), 1)
        self.assertIn("mfa", update_calls[0][0][0])
