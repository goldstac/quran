import subprocess
import json
import os
import re


class YTDL:
    SAVE_DIR = os.path.expanduser("~/Music/Nasheeds")
    UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

    @staticmethod
    def search(query, max_results=20):
        cmd = [
            "yt-dlp",
            f"ytsearch{max_results}:{query}",
            "--flat-playlist",
            "--dump-json",
            "--no-warnings",
            "--ignore-errors",
            "--no-playlist",
        ]
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            results = []
            for line in result.stdout.strip().split("\n"):
                if line:
                    try:
                        data = json.loads(line)
                        results.append(
                            {
                                "id": data.get("id", ""),
                                "title": data.get("title", "Unknown"),
                                "channel": data.get("channel", data.get("uploader", "Unknown")),
                                "duration": data.get("duration"),
                                "duration_string": data.get("duration_string", ""),
                                "thumbnail": (
                                    data.get("thumbnails", [{}])[-1].get("url", "")
                                    if data.get("thumbnails") else ""
                                ),
                                "url": f"https://www.youtube.com/watch?v={data.get('id', '')}",
                            }
                        )
                    except json.JSONDecodeError:
                        continue
            return results
        except (subprocess.TimeoutExpired, Exception) as e:
            print(f"Search error: {e}")
            return []

    @staticmethod
    def get_stream_url(video_id):
        cmd = [
            "yt-dlp",
            "-f", "bestaudio[ext=m4a]/bestaudio/best",
            "-g",
            "--no-warnings",
            "--no-playlist",
            "--user-agent", YTDL.UA,
            f"https://www.youtube.com/watch?v={video_id}",
        ]
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
            url = result.stdout.strip().split("\n")[0]
            return url if url.startswith("http") else None
        except Exception:
            return None

    @staticmethod
    def download(video_id, title=None):
        os.makedirs(YTDL.SAVE_DIR, exist_ok=True)
        outtmpl = os.path.join(YTDL.SAVE_DIR, "%(title)s.%(ext)s")
        cmd = [
            "yt-dlp",
            "-f", "bestaudio[ext=m4a]/bestaudio/best",
            "--extract-audio",
            "--audio-format", "mp3",
            "--audio-quality", "192K",
            "-o", outtmpl,
            "--no-playlist",
            "--no-warnings",
            "--user-agent", YTDL.UA,
            f"https://www.youtube.com/watch?v={video_id}",
        ]
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
            match = re.search(r"\[ExtractAudio\] Destination: (.+)", result.stdout)
            if match:
                return match.group(1)
            match = re.search(r"\[download\] (.+\.mp3)", result.stdout)
            if match:
                return match.group(1)
            for f in os.listdir(YTDL.SAVE_DIR):
                if video_id in f or (title and title[:30] in f):
                    return os.path.join(YTDL.SAVE_DIR, f)
            return None
        except Exception as e:
            print(f"Download error: {e}")
            return None
