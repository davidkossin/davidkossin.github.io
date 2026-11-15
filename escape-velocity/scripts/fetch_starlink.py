#!/usr/bin/env python3
"""Backward-compatible entry point; prefer fetch_constellations.py."""
from fetch_constellations import main

if __name__ == "__main__":
    main(only=["starlink"])
