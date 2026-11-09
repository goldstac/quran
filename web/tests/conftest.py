import os
import pathlib
import shutil
import sys
import tempfile

import pytest

_web_dir = pathlib.Path(__file__).resolve().parents[1]
if str(_web_dir) not in sys.path:
    sys.path.insert(0, str(_web_dir))

_fake_home = tempfile.mkdtemp(prefix="quran-pytest-home-")
os.environ["HOME"] = _fake_home

import app as backend


@pytest.fixture(autouse=True)
def clean_state():
    backend.save_lib({"songs": [], "playlists": []})
    backend._stream_cache.clear()
    backend._quran_cache.clear()
    backend._provided_cache = {"expires": 0, "items": []}
    backend._update_cache = {"at": 0, "releases": None}
    yield


@pytest.fixture(scope="session", autouse=True)
def remove_fake_home():
    yield
    shutil.rmtree(_fake_home, ignore_errors=True)


@pytest.fixture()
def client():
    backend.app.config["TESTING"] = True
    return backend.app.test_client()
