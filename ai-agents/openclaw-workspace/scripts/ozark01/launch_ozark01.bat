@echo off
REM OZARK-01 Launch Script — Windows
REM Usage: launch_ozark01.bat [detect|server|ik|llama|vllm|dashboard|install]

SET MODE=%1
IF "%MODE%"=="" SET MODE=detect

IF "%MODE%"=="install" GOTO :install
IF "%MODE%"=="detect" GOTO :detect
IF "%MODE%"=="server" GOTO :server
IF "%MODE%"=="dashboard" GOTO :dashboard
IF "%MODE%"=="ik" GOTO :ik
IF "%MODE%"=="llama" GOTO :llama
IF "%MODE%"=="vllm" GOTO :vllm
IF "%MODE%"=="ollama" GOTO :ollama

echo Unknown mode: %MODE%
echo Usage: launch_ozark01.bat [detect^|server^|dashboard^|ik^|llama^|vllm^|ollama^|install]
goto :eof

:install
echo [OZARK-01] Installing dependencies...
pip install fastapi uvicorn pynvml
echo [OZARK-01] Done. Run: launch_ozark01.bat detect
goto :eof

:detect
echo [OZARK-01] Detecting GPU pool...
python vram_pool_manager.py
goto :eof

:server
echo [OZARK-01] Starting GPU Pool Server on port 7860...
echo [OZARK-01] Dashboard: open pool_monitor.html in browser
start "OZARK-01 Pool Server" python gpu_pool_server.py
echo Server started in background.
timeout /t 2 /nobreak >nul
start "" "pool_monitor.html"
goto :eof

:dashboard
echo [OZARK-01] Opening dashboard...
start "" "pool_monitor.html"
goto :eof

:ik
REM Get split config from pool manager
FOR /F "delims=" %%i IN ('python vram_pool_manager.py --json 2^>nul ^| node -e "const c=[];process.stdin.on(\"data\",d=>c.push(d));process.stdin.on(\"end\",()=>{const d=JSON.parse(Buffer.concat(c));process.stdout.write(d.cuda_ids_str+\"||\"+d.tensor_split_str);})"') DO SET GPUINFO=%%i

FOR /F "tokens=1 delims=||" %%a IN ("%GPUINFO%") DO SET CUDA_IDS=%%a
FOR /F "tokens=2 delims=||" %%b IN ("%GPUINFO%") DO SET TS=%%b

IF "%CUDA_IDS%"=="" SET CUDA_IDS=0
IF "%TS%"=="" SET TS=100

SET MODEL=%2
IF "%MODEL%"=="" SET MODEL=./models/model.gguf

echo [OZARK-01] Launching ik_llama.cpp graph-split...
echo CUDA_VISIBLE_DEVICES=%CUDA_IDS%
echo Tensor split: %TS%

SET CUDA_VISIBLE_DEVICES=%CUDA_IDS%
.\ik_llama.cpp\build\bin\llama-cli ^
  -m "%MODEL%" ^
  -ngl 999 ^
  -c 8192 ^
  -sm graph ^
  -ts %TS% ^
  --main-gpu 0 ^
  --interactive-first
goto :eof

:llama
FOR /F "delims=" %%i IN ('python vram_pool_manager.py --json 2^>nul ^| node -e "const c=[];process.stdin.on(\"data\",d=>c.push(d));process.stdin.on(\"end\",()=>{const d=JSON.parse(Buffer.concat(c));process.stdout.write(d.cuda_ids_str+\"||\"+d.tensor_split_str);})"') DO SET GPUINFO=%%i
FOR /F "tokens=1 delims=||" %%a IN ("%GPUINFO%") DO SET CUDA_IDS=%%a
FOR /F "tokens=2 delims=||" %%b IN ("%GPUINFO%") DO SET TS=%%b
IF "%CUDA_IDS%"=="" SET CUDA_IDS=0
IF "%TS%"=="" SET TS=100

SET MODEL=%2
IF "%MODEL%"=="" SET MODEL=./models/model.gguf

echo [OZARK-01] Launching llama.cpp row-split...
SET CUDA_VISIBLE_DEVICES=%CUDA_IDS%
.\llama.cpp\build\bin\llama-cli ^
  -m "%MODEL%" ^
  -ngl 999 ^
  -c 8192 ^
  -sm row ^
  -ts %TS% ^
  --main-gpu 0
goto :eof

:vllm
echo [OZARK-01] Launching vLLM tensor parallel...
FOR /F "tokens=*" %%i IN ('python -c "import json,subprocess; d=json.loads(subprocess.check_output([\"python\",\"vram_pool_manager.py\",\"--json\"])); print(d[\"cuda_ids_str\"]+\"||\" +str(d[\"healthy_device_count\"]))"') DO SET GPUINFO=%%i
FOR /F "tokens=1 delims=||" %%a IN ("%GPUINFO%") DO SET CUDA_IDS=%%a
FOR /F "tokens=2 delims=||" %%b IN ("%GPUINFO%") DO SET TP_SIZE=%%b
IF "%CUDA_IDS%"=="" SET CUDA_IDS=0
IF "%TP_SIZE%"=="" SET TP_SIZE=1

SET CUDA_VISIBLE_DEVICES=%CUDA_IDS%
python -m vllm.entrypoints.openai.api_server ^
  --model meta-llama/Llama-3.1-8B-Instruct ^
  --tensor-parallel-size %TP_SIZE% ^
  --port 8000 ^
  --dtype auto ^
  --max-model-len 8192 ^
  --gpu-memory-utilization 0.90
goto :eof

:ollama
echo [OZARK-01] Starting Ollama with multi-GPU support...
FOR /F "tokens=*" %%i IN ('python -c "import json,subprocess; d=json.loads(subprocess.check_output([\"python\",\"vram_pool_manager.py\",\"--json\"])); print(d[\"cuda_ids_str\"]+\"||\" +str(d[\"healthy_device_count\"]))"') DO SET GPUINFO=%%i
FOR /F "tokens=1 delims=||" %%a IN ("%GPUINFO%") DO SET CUDA_IDS=%%a
FOR /F "tokens=2 delims=||" %%b IN ("%GPUINFO%") DO SET N_GPU=%%b

SET CUDA_VISIBLE_DEVICES=%CUDA_IDS%
SET OLLAMA_NUM_GPU=%N_GPU%
SET OLLAMA_MAX_LOADED_MODELS=1
ollama serve
goto :eof
