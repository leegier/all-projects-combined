#!/usr/bin/env python3
"""
OZARK-01 GPU Pool Server
FastAPI HTTP server — exposes the VRAM pool status and launch command generation.
The pool_monitor.html dashboard polls this on port 7860.
OpenClaw / BuddySystem / any model loader can hit this API.

Endpoints:
  GET  /pool/status          — full pool status + split ratios
  GET  /pool/devices         — device list only
  POST /pool/allocate        — request N GB, get back GPU assignment
  GET  /pool/launch-cmd      — get copy-ready launch command
  GET  /health               — simple liveness check

Run: python gpu_pool_server.py
"""

import sys
import time
from dataclasses import asdict
from typing import Optional

try:
    from fastapi import FastAPI, Query
    from fastapi.middleware.cors import CORSMiddleware
    import uvicorn
except ImportError:
    print("Missing dependencies. Run: pip install fastapi uvicorn")
    sys.exit(1)

from vram_pool_manager import VRAMPoolManager, PoolStatus

app = FastAPI(title="OZARK-01 GPU Pool Server", version="1.0.0")
pool = VRAMPoolManager(poll_interval_sec=15)

# Allow browser dashboard to call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup():
    pool.detect_all()
    pool.start_monitor()
    print("[OZARK-01] Pool server started. GPU monitor running.")


@app.on_event("shutdown")
def shutdown():
    pool.stop_monitor()


@app.get("/health")
def health():
    return {"status": "ok", "timestamp": time.time()}


@app.get("/pool/status")
def get_pool_status():
    """Full pool status — what the dashboard polls."""
    status = pool.get_status()
    return {
        "total_vram_gb": status.total_vram_gb,
        "free_vram_gb": status.free_vram_gb,
        "used_vram_gb": status.used_vram_gb,
        "device_count": status.device_count,
        "healthy_device_count": status.healthy_device_count,
        "pool_mode": status.pool_mode,
        "split_ratios": status.split_ratios,
        "tensor_split_str": status.tensor_split_str,
        "cuda_ids_str": status.cuda_ids_str,
        "nvlink_pairs": status.nvlink_pairs,
    }


@app.get("/pool/devices")
def get_devices():
    """Device list with per-GPU VRAM and health."""
    status = pool.get_status()
    return {
        "devices": [asdict(d) for d in status.devices],
        "count": len(status.devices),
    }


@app.post("/pool/allocate")
def allocate_vram(vram_gb: float = Query(..., description="GB of VRAM needed")):
    """
    Request an allocation for a specific VRAM need.
    Returns which GPU(s) to use and the split config.
    """
    status = pool.get_status()

    if vram_gb > status.free_vram_gb:
        return {
            "success": False,
            "error": f"Requested {vram_gb}GB but only {status.free_vram_gb:.1f}GB available",
            "free_vram_gb": status.free_vram_gb,
        }

    # If fits on one GPU, return the GPU with most free VRAM
    best = max(status.devices, key=lambda d: d.vram_free_gb)
    if best.vram_free_gb >= vram_gb:
        return {
            "success": True,
            "strategy": "single-gpu",
            "gpu_id": best.id,
            "gpu_name": best.name,
            "vram_available_gb": best.vram_free_gb,
            "cuda_ids": str(best.id),
            "tensor_split": "100",
        }

    # Multi-GPU needed
    return {
        "success": True,
        "strategy": "multi-gpu-split",
        "gpu_ids": [d.id for d in status.devices],
        "total_free_gb": status.free_vram_gb,
        "cuda_ids": status.cuda_ids_str,
        "tensor_split": status.tensor_split_str,
        "pool_mode": status.pool_mode,
    }


@app.get("/pool/launch-cmd")
def get_launch_cmd(
    mode: str = Query("ik", description="ik | ik-server | llama | vllm | ollama"),
    model_path: str = Query("./models/model.gguf", description="Path to model GGUF"),
    context: int = Query(8192, description="Context window size"),
    port: int = Query(8080, description="HTTP port (for server modes)"),
):
    """Generate the correct multi-GPU launch command for the current GPU config."""
    cmd = pool.generate_launch_cmd(mode, model_path, context, port)
    status = pool.get_status()
    return {
        "mode": mode,
        "command": cmd,
        "tensor_split": status.tensor_split_str,
        "cuda_ids": status.cuda_ids_str,
        "total_vram_gb": status.total_vram_gb,
        "device_count": status.healthy_device_count,
    }


if __name__ == "__main__":
    print("[OZARK-01] Starting GPU Pool Server on http://0.0.0.0:7860")
    print("[OZARK-01] Dashboard: open pool_monitor.html in a browser")
    uvicorn.run(app, host="0.0.0.0", port=7860, log_level="info")
