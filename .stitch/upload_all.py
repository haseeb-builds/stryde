#!/usr/bin/env python3
"""Batch upload script to push all prepared Stryde screens and DESIGN.md to Stitch.

Usage:
    python .stitch/upload_all.py --project-id <PROJECT_ID> --api-key <API_KEY>
"""

import argparse
import json
import os
import pathlib
import subprocess
import sys

def main():
    parser = argparse.ArgumentParser(description="Upload prepared Stryde assets to Google Stitch.")
    parser.add_argument("--project-id", required=True, help="Target Stitch project ID (e.g. projects/...)")
    parser.add_argument("--api-key", required=True, help="Google Stitch API Key")
    parser.add_argument("--api-url", default="https://stitch.googleapis.com", help="Stitch API URL")
    args = parser.parse_args()

    stitch_dir = pathlib.Path(__file__).parent.resolve()
    metadata_path = stitch_dir / "metadata.json"
    
    if not metadata_path.exists():
        print(f"Error: metadata.json not found in {stitch_dir}")
        sys.exit(1)

    with open(metadata_path, "r", encoding="utf-8") as f:
        meta = json.load(f)

    uploader_script = stitch_dir.parent.parent / ".agents" / "skills" / "stitch-upload-to-stitch" / "scripts" / "upload_to_stitch.py"
    if not uploader_script.exists():
        print(f"Error: uploader script not found at {uploader_script}")
        sys.exit(1)

    print(f"================================================================")
    print(f"  Uploading Stryde Workspace to Stitch Project: {args.project_id}")
    print(f"================================================================\n")

    # 1. Upload DESIGN.md
    design_md = stitch_dir / "DESIGN.md"
    if design_md.exists():
        print(f"1. Uploading Baseline Design System ({design_md.name})...")
        cmd = [
            sys.executable,
            str(uploader_script),
            "--project-id", args.project_id,
            "--file-path", str(design_md),
            "--api-key", args.api_key,
            "--api-url", args.api_url,
            "--title", "Stryde Baseline Design System",
            "--generated-by", "stitch::extract-design-md"
        ]
        res = subprocess.run(cmd)
        if res.returncode != 0:
            print(f"Warning: upload of {design_md.name} failed with code {res.returncode}")
    
    # 2. Upload all 8 screens (both HTML and PNG)
    screens = meta.get("screens", [])
    print(f"\n2. Uploading {len(screens)} representative screens...")
    for idx, screen in enumerate(screens, start=1):
        screen_id = screen["id"]
        title = screen["title"]
        route = screen["route"]
        html_file = stitch_dir / screen["files"]["html"]
        png_file = stitch_dir / screen["files"]["png"]

        # Upload HTML version
        if html_file.exists():
            print(f"\n   [{idx}a] Uploading HTML: {screen_id} ({route})")
            cmd = [
                sys.executable,
                str(uploader_script),
                "--project-id", args.project_id,
                "--file-path", str(html_file),
                "--api-key", args.api_key,
                "--api-url", args.api_url,
                "--title", f"{route} — {title}",
                "--generated-by", "stitch::extract-static-html"
            ]
            subprocess.run(cmd)

        # Upload PNG version
        if png_file.exists():
            print(f"   [{idx}b] Uploading Screenshot: {screen_id}")
            cmd = [
                sys.executable,
                str(uploader_script),
                "--project-id", args.project_id,
                "--file-path", str(png_file),
                "--api-key", args.api_key,
                "--api-url", args.api_url,
                "--title", f"{route} — {title} (Screenshot)",
                "--generated-by", "stitch::visual-capture"
            ]
            subprocess.run(cmd)

    print("\n================================================================")
    print("  All uploads completed!")
    print(f"  Open project in Google Stitch: https://stitch.withgoogle.com/projects/{args.project_id}")
    print("================================================================\n")

if __name__ == "__main__":
    main()
