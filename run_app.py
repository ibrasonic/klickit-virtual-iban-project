from __future__ import annotations

import os
from pathlib import Path
import signal
import subprocess
import sys
import time
from urllib.error import URLError
from urllib.request import urlopen
import webbrowser


PROJECT_DIR = Path(__file__).resolve().parent
APP_URL = "http://localhost:5173"


def wait_for_app(timeout_seconds: int = 60) -> bool:
    deadline = time.monotonic() + timeout_seconds
    while time.monotonic() < deadline:
        try:
            with urlopen(APP_URL, timeout=2) as response:
                if response.status < 500:
                    return True
        except (URLError, TimeoutError):
            time.sleep(1)
    return False


def stop_process(process: subprocess.Popen[bytes]) -> None:
    if process.poll() is not None:
        return
    if os.name == "nt":
        process.send_signal(signal.CTRL_BREAK_EVENT)
    else:
        os.killpg(process.pid, signal.SIGTERM)
    try:
        process.wait(timeout=5)
    except subprocess.TimeoutExpired:
        process.kill()


def main() -> int:
    npm = "npm.cmd" if os.name == "nt" else "npm"
    if not (PROJECT_DIR / "node_modules").exists():
        print("Installing application dependencies. Please wait...")
        subprocess.run([npm, "install"], cwd=PROJECT_DIR, check=True)

    print("Starting the Klickit finance application...")
    print("Press Ctrl+C in this window to stop the application.")
    process = subprocess.Popen(
        [npm, "run", "dev"],
        cwd=PROJECT_DIR,
        creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == "nt" else 0,
        start_new_session=os.name != "nt",
    )

    try:
        if not wait_for_app():
            print("The application did not become ready within 60 seconds.", file=sys.stderr)
            return 1
        print(f"Opening {APP_URL}")
        webbrowser.open(APP_URL)
        return process.wait()
    except KeyboardInterrupt:
        print("\nStopping the application...")
        return 0
    finally:
        stop_process(process)


if __name__ == "__main__":
    raise SystemExit(main())
