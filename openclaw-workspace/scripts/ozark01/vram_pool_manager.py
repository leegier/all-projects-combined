#!/usr/bin/env python3
"""
OZARK-01 VRAM Pool Manager
Detects all GPUs, calculates proportional split ratios, manages allocation.
Works with: llama.cpp, ik_llama.cpp, vLLM, Ollama
"""

import subprocess
import json
import threading
import time
from dataclasses import dataclass, field, asdict
from typing import List, Optional, Tuple

# Optional CUDA — gracefully skips if not installed
try:
    import pynvml
    NVML_AVAILABLE = True
except ImportError:
    NVML_AVAILABLE = False

try:
    import pyopencl as cl
    OPENCL_AVAILABLE = True
except ImportError:
    OPENCL_AVAILABLE = False


@dataclass
class GPUDevice:
    id: int
    name: str
    vendor: str                 # NVIDIA, AMD, Intel
    vram_total_gb: float
    vram_free_gb: float
    vram_used_gb: float
    nvlink_capable: bool
    compute_capability: str    # e.g. "8.6"
    is_healthy: bool
    ratio: float = 0.0         # share of pool (0.0-1.0), calculated dynamically
    temperature_c: Optional[int] = None
    utilization_pct: Optional[int] = None


@dataclass
class PoolStatus:
    total_vram_gb: float
    free_vram_gb: float
    used_vram_gb: float
    device_count: int
    healthy_device_count: int
    pool_mode: str              # PROPORTIONAL, NVLINK, OPENCL
    split_ratios: List[float]
    tensor_split_str: str       # ready for --tensor-split flag
    cuda_ids_str: str           # ready for CUDA_VISIBLE_DEVICES
    nvlink_pairs: List[Tuple[int, int]]
    devices: List[GPUDevice]


class VRAMPoolManager:
    def __init__(self, poll_interval_sec: int = 15):
        self.devices: List[GPUDevice] = []
        self.poll_interval = poll_interval_sec
        self._lock = threading.Lock()
        self._monitor_thread: Optional[threading.Thread] = None
        self._running = False

    def detect_all(self) -> List[GPUDevice]:
        """Detect all GPUs using nvidia-smi + optional NVML + OpenCL fallback."""
        devices = []

        # --- NVIDIA via nvidia-smi (most reliable, no Python dependency) ---
        nvidia_devs = self._detect_nvidia_smi()
        devices.extend(nvidia_devs)

        # --- AMD/Intel via OpenCL (if pynvml missed anything) ---
        if OPENCL_AVAILABLE:
            opencl_devs = self._detect_opencl(skip_nvidia=len(nvidia_devs) > 0)
            devices.extend(opencl_devs)

        # Assign IDs sequentially
        for i, d in enumerate(devices):
            d.id = i

        self._calculate_ratios(devices)
        with self._lock:
            self.devices = devices
        return devices

    def _detect_nvidia_smi(self) -> List[GPUDevice]:
        """Use nvidia-smi XML output — works on any system with NVIDIA drivers."""
        devs = []
        try:
            result = subprocess.run(
                ["nvidia-smi",
                 "--query-gpu=name,memory.total,memory.free,memory.used,temperature.gpu,utilization.gpu",
                 "--format=csv,noheader,nounits"],
                capture_output=True, text=True, timeout=10
            )
            if result.returncode != 0:
                return devs

            # Check NVLink capability via nvlink query (fails gracefully on non-NVLink cards)
            nvlink_result = subprocess.run(
                ["nvidia-smi", "nvlink", "--status"],
                capture_output=True, text=True, timeout=5
            )
            has_nvlink_system = nvlink_result.returncode == 0 and "Link" in nvlink_result.stdout

            # Parse CC via deviceQuery if available, else mark as unknown
            for i, line in enumerate(result.stdout.strip().split('\n')):
                if not line.strip():
                    continue
                parts = [p.strip() for p in line.split(',')]
                if len(parts) < 4:
                    continue

                name = parts[0]
                total_mb = float(parts[1])
                free_mb = float(parts[2])
                used_mb = float(parts[3])
                temp = int(parts[4]) if len(parts) > 4 and parts[4].isdigit() else None
                util = int(parts[5]) if len(parts) > 5 and parts[5].isdigit() else None

                # NVLink: RTX 3090 and higher workstation cards support it
                nvlink = has_nvlink_system and any(
                    tag in name for tag in ['3090', 'A100', 'H100', 'A6000', 'RTX 6000']
                )

                devs.append(GPUDevice(
                    id=i,
                    name=name,
                    vendor='NVIDIA',
                    vram_total_gb=round(total_mb / 1024, 2),
                    vram_free_gb=round(free_mb / 1024, 2),
                    vram_used_gb=round(used_mb / 1024, 2),
                    nvlink_capable=nvlink,
                    compute_capability=self._get_compute_capability(i),
                    is_healthy=True,
                    temperature_c=temp,
                    utilization_pct=util,
                ))
        except (subprocess.TimeoutExpired, FileNotFoundError, Exception):
            pass
        return devs

    def _get_compute_capability(self, gpu_index: int) -> str:
        """Get CUDA compute capability via deviceQuery or NVML."""
        if NVML_AVAILABLE:
            try:
                pynvml.nvmlInit()
                handle = pynvml.nvmlDeviceGetHandleByIndex(gpu_index)
                major, minor = pynvml.nvmlDeviceGetCudaComputeCapability(handle)
                return f"{major}.{minor}"
            except Exception:
                pass
        return "unknown"

    def _detect_opencl(self, skip_nvidia: bool = False) -> List[GPUDevice]:
        """Detect AMD/Intel GPUs via OpenCL."""
        devs = []
        try:
            platforms = cl.get_platforms()
            dev_id = 100  # start high to avoid ID collision
            for platform in platforms:
                vendor = platform.vendor
                if skip_nvidia and 'NVIDIA' in vendor:
                    continue
                try:
                    cl_devs = platform.get_devices(device_type=cl.device_type.GPU)
                    for cl_dev in cl_devs:
                        total_mb = cl_dev.global_mem_size / (1024 ** 2)
                        devs.append(GPUDevice(
                            id=dev_id,
                            name=cl_dev.name.strip(),
                            vendor=vendor.strip(),
                            vram_total_gb=round(total_mb / 1024, 2),
                            vram_free_gb=round(total_mb / 1024 * 0.95, 2),  # estimate
                            vram_used_gb=round(total_mb / 1024 * 0.05, 2),
                            nvlink_capable=False,
                            compute_capability='N/A',
                            is_healthy=True,
                        ))
                        dev_id += 1
                except Exception:
                    pass
        except Exception:
            pass
        return devs

    def _calculate_ratios(self, devices: List[GPUDevice]) -> None:
        """Calculate each GPU's proportional share of the pool based on free VRAM."""
        healthy = [d for d in devices if d.is_healthy]
        total_free = sum(d.vram_free_gb for d in healthy)
        if total_free == 0:
            return
        for d in devices:
            d.ratio = round(d.vram_free_gb / total_free, 4) if d.is_healthy else 0.0

    def get_status(self) -> PoolStatus:
        """Return current pool status with all calculated values."""
        with self._lock:
            devices = list(self.devices)

        if not devices:
            devices = self.detect_all()

        healthy = [d for d in devices if d.is_healthy]
        nvidia_devs = [d for d in healthy if d.vendor == 'NVIDIA']
        nvlink_pairs = self._find_nvlink_pairs(nvidia_devs)

        total = sum(d.vram_total_gb for d in healthy)
        free = sum(d.vram_free_gb for d in healthy)
        used = sum(d.vram_used_gb for d in healthy)

        # Build split string: proportional percentages, summing to 100
        if len(healthy) > 1:
            ratios_pct = [round(d.ratio * 100) for d in healthy]
            # Fix rounding drift
            diff = 100 - sum(ratios_pct)
            if diff != 0:
                ratios_pct[0] += diff
            tensor_split = ','.join(str(r) for r in ratios_pct)
        else:
            tensor_split = '100'

        cuda_ids = ','.join(str(d.id) for d in nvidia_devs)

        mode = 'NVLINK' if nvlink_pairs else ('OPENCL' if any(d.vendor != 'NVIDIA' for d in healthy) else 'PROPORTIONAL')

        return PoolStatus(
            total_vram_gb=round(total, 2),
            free_vram_gb=round(free, 2),
            used_vram_gb=round(used, 2),
            device_count=len(devices),
            healthy_device_count=len(healthy),
            pool_mode=mode,
            split_ratios=[d.ratio for d in healthy],
            tensor_split_str=tensor_split,
            cuda_ids_str=cuda_ids,
            nvlink_pairs=nvlink_pairs,
            devices=healthy,
        )

    def _find_nvlink_pairs(self, nvidia_devs: List[GPUDevice]) -> List[Tuple[int, int]]:
        """Detect NVLink-connected pairs via nvidia-smi nvlink."""
        pairs = []
        if len(nvidia_devs) < 2:
            return pairs
        try:
            result = subprocess.run(
                ["nvidia-smi", "nvlink", "--status", "-i", "0"],
                capture_output=True, text=True, timeout=5
            )
            if result.returncode == 0 and "Active" in result.stdout:
                # At least one NVLink link is active on GPU 0
                for dev in nvidia_devs[1:]:
                    if dev.nvlink_capable:
                        pairs.append((nvidia_devs[0].id, dev.id))
        except Exception:
            pass
        return pairs

    def generate_launch_cmd(self, mode: str = 'ik', model_path: str = './models/model.gguf',
                            context: int = 8192, port: int = 8080) -> str:
        """Generate the correct multi-GPU launch command for the given mode."""
        status = self.get_status()
        ts = status.tensor_split_str
        cuda = status.cuda_ids_str or '0'
        n_gpu = status.healthy_device_count

        if mode == 'ik':
            return (
                f"CUDA_VISIBLE_DEVICES={cuda} \\\n"
                f"  ./ik_llama.cpp/build/bin/llama-cli \\\n"
                f"  -m {model_path} \\\n"
                f"  -ngl 999 -c {context} \\\n"
                f"  -sm graph \\\n"
                f"  -ts {ts} \\\n"
                f"  --main-gpu 0 \\\n"
                f"  --interactive-first"
            )
        elif mode == 'ik-server':
            return (
                f"CUDA_VISIBLE_DEVICES={cuda} \\\n"
                f"  ./ik_llama.cpp/build/bin/llama-server \\\n"
                f"  -m {model_path} \\\n"
                f"  -ngl 999 -c {context} \\\n"
                f"  -sm graph \\\n"
                f"  -ts {ts} \\\n"
                f"  --host 0.0.0.0 --port {port} \\\n"
                f"  --api-key ozark01 --parallel 4"
            )
        elif mode == 'llama':
            return (
                f"CUDA_VISIBLE_DEVICES={cuda} \\\n"
                f"  ./llama.cpp/build/bin/llama-cli \\\n"
                f"  -m {model_path} \\\n"
                f"  -ngl 999 -c {context} \\\n"
                f"  -sm row \\\n"
                f"  -ts {ts} \\\n"
                f"  --main-gpu 0"
            )
        elif mode == 'vllm':
            return (
                f"CUDA_VISIBLE_DEVICES={cuda} \\\n"
                f"  python3 -m vllm.entrypoints.openai.api_server \\\n"
                f"  --model meta-llama/Llama-3.1-8B-Instruct \\\n"
                f"  --tensor-parallel-size {n_gpu} \\\n"
                f"  --port 8000 --dtype auto \\\n"
                f"  --max-model-len {context} \\\n"
                f"  --gpu-memory-utilization 0.90"
            )
        elif mode == 'ollama':
            cuda_env = f"CUDA_VISIBLE_DEVICES={cuda}" if cuda else ""
            return (
                f"{cuda_env} \\\n"
                f"  OLLAMA_NUM_GPU={n_gpu} \\\n"
                f"  OLLAMA_MAX_LOADED_MODELS=1 \\\n"
                f"  ollama serve"
            )
        return "# Unknown mode"

    def start_monitor(self):
        """Start background thread that refreshes GPU stats every poll_interval seconds."""
        self._running = True
        self._monitor_thread = threading.Thread(target=self._monitor_loop, daemon=True)
        self._monitor_thread.start()

    def stop_monitor(self):
        self._running = False

    def _monitor_loop(self):
        while self._running:
            try:
                new_devices = self.detect_all()
                self._calculate_ratios(new_devices)
                with self._lock:
                    self.devices = new_devices
            except Exception as e:
                print(f"[Monitor] Error: {e}")
            time.sleep(self.poll_interval)


# ── CLI usage ─────────────────────────────────────────────────────────────────

if __name__ == '__main__':
    import sys
    pool = VRAMPoolManager()
    devices = pool.detect_all()
    status = pool.get_status()

    if '--json' in sys.argv:
        # Convert dataclasses to dict for JSON serialization
        output = {
            **{k: v for k, v in asdict(status).items() if k != 'devices'},
            'devices': [asdict(d) for d in status.devices]
        }
        print(json.dumps(output, indent=2))
        sys.exit(0)

    print(f"\n{'='*60}")
    print(f"  OZARK-01 VRAM POOL MANAGER")
    print(f"{'='*60}")
    print(f"  Total VRAM : {status.total_vram_gb:.1f} GB")
    print(f"  Free VRAM  : {status.free_vram_gb:.1f} GB")
    print(f"  Pool Mode  : {status.pool_mode}")
    print(f"  Devices    : {status.healthy_device_count}/{status.device_count} healthy")
    print(f"  Split Str  : {status.tensor_split_str}")
    print(f"  CUDA IDs   : {status.cuda_ids_str}")
    print(f"\n  GPUs:")
    for d in status.devices:
        bar_width = 20
        used_pct = 1 - (d.vram_free_gb / d.vram_total_gb) if d.vram_total_gb else 0
        filled = int(used_pct * bar_width)
        bar = '█' * filled + '░' * (bar_width - filled)
        print(f"    [{bar}] GPU{d.id} {d.name}")
        print(f"              {d.vram_free_gb:.1f}GB free / {d.vram_total_gb:.1f}GB  ({d.ratio*100:.0f}% of pool)")
        if d.nvlink_capable:
            print(f"              ↳ NVLink capable")

    print(f"\n  ik_llama.cpp command:")
    print(f"  {pool.generate_launch_cmd('ik')}")
    print(f"{'='*60}\n")
