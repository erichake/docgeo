"""Mirror tests/ on the FTP server set up in tests/.vscode/sftp.json.

Only the files whose size or modification time differ are uploaded; remote
files missing locally are deleted. Times are read with MLSD, exact to the
second and in UTC, unlike the LIST times the VS Code SFTP extension compares,
rounded to the minute and given in the server's time zone.

    python3 tools/upload_tests.py [--dry-run]
"""

import ftplib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

TESTS = Path(__file__).resolve().parent.parent / "tests"
config = json.loads((TESTS / ".vscode/sftp.json").read_text())
ignored = set(config["ignore"])
dry_run = "--dry-run" in sys.argv


def local_files() -> dict[str, tuple[int, int]]:
    files = {}
    for path in TESTS.rglob("*"):
        relative = path.relative_to(TESTS)
        if path.is_file() and not ignored & set(relative.parts):
            stat = path.stat()
            files[relative.as_posix()] = (stat.st_size, int(stat.st_mtime))
    return files


def remote_entries(ftp: ftplib.FTP, folder: str = "") -> tuple[dict, list]:
    files, folders = {}, []
    for name, facts in ftp.mlsd(f"{root}/{folder}", ["type", "size", "modify"]):
        relative = f"{folder}{name}"
        if name in ignored or facts["type"] in ("cdir", "pdir"):
            continue
        if facts["type"] == "dir":
            folders.append(relative)
            sub_files, sub_folders = remote_entries(ftp, f"{relative}/")
            files.update(sub_files)
            folders += sub_folders
        else:
            modified = datetime.strptime(facts["modify"][:14], "%Y%m%d%H%M%S")
            time = int(modified.replace(tzinfo=timezone.utc).timestamp())
            files[relative] = (int(facts["size"]), time)
    return files, folders


def run(action: str, path: str, command=None) -> None:
    print(f"{action} {path}")
    if not dry_run and command:
        command()


root = config["remotePath"].rstrip("/")
ftp = ftplib.FTP()
ftp.connect(config["host"], config.get("port", 21))
ftp.login(config["username"], config["password"])
local = local_files()
remote, remote_folders = remote_entries(ftp)
local_folders = {str(parent) for path in local for parent in Path(path).parents} - {"."}

for folder in sorted(local_folders):
    if folder not in remote_folders:
        run("mkdir", folder, lambda: ftp.mkd(f"{root}/{folder}"))

for path, (size, time) in sorted(local.items()):
    if path in remote and remote[path][0] == size and remote[path][1] >= time:
        continue

    def upload() -> None:
        with open(TESTS / path, "rb") as file:
            ftp.storbinary(f"STOR {root}/{path}", file)
        stamp = datetime.fromtimestamp(time, timezone.utc).strftime("%Y%m%d%H%M%S")
        ftp.sendcmd(f"MFMT {stamp} {root}/{path}")

    run("upload", path, upload)

if config.get("syncOption", {}).get("delete"):
    for path in sorted(set(remote) - set(local)):
        run("delete", path, lambda: ftp.delete(f"{root}/{path}"))
    for folder in sorted(set(remote_folders) - local_folders, reverse=True):
        run("rmdir", folder, lambda: ftp.rmd(f"{root}/{folder}"))

ftp.quit()
