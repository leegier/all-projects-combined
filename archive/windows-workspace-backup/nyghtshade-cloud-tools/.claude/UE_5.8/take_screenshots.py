import socket
import json
import time
import ctypes

user32 = ctypes.windll.user32
found_hwnd = None

def enum_handler(hwnd, lParam):
    global found_hwnd
    if user32.IsWindowVisible(hwnd):
        length = user32.GetWindowTextLengthW(hwnd)
        buff = ctypes.create_unicode_buffer(length + 1)
        user32.GetWindowTextW(hwnd, buff, length + 1)
        title = buff.value
        if "freshstart" in title or "Unreal Editor" in title:
            found_hwnd = hwnd
            return False
    return True

def focus_editor_window():
    global found_hwnd
    found_hwnd = None
    EnumWindowsProc = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_int, ctypes.c_int)
    user32.EnumWindows(EnumWindowsProc(enum_handler), 0)
    
    if found_hwnd:
        user32.ShowWindow(found_hwnd, 9) # SW_RESTORE / SW_SHOWNORMAL
        user32.SetForegroundWindow(found_hwnd)
        print("Brought Unreal Editor to the foreground.")
        time.sleep(1.0) # Wait for GPU to render
    else:
        print("Unreal Editor window not found.")

def send_command(command, params=None):
    if params is None:
        params = {}
    payload = {
        "type": command,
        "params": params
    }
    
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(15.0)
        s.connect(("127.0.0.1", 55557))
        s.sendall((json.dumps(payload) + "\n").encode("utf-8"))
        
        buffer = ""
        while True:
            chunk = s.recv(4096).decode("utf-8")
            if not chunk:
                break
            buffer += chunk
            try:
                res = json.loads(buffer.strip())
                s.close()
                return res
            except json.JSONDecodeError:
                pass
        s.close()
        return {"status": "error", "error": "Incomplete JSON response received"}
    except Exception as e:
        return {"status": "error", "error": str(e)}

def capture_angle(angle_name, location, distance, orientation):
    print(f"\nPositioning camera for {angle_name}...")
    focus_res = send_command("focus_viewport", {
        "location": location,
        "distance": distance,
        "orientation": orientation
    })
    
    if focus_res.get("status") != "success":
        print(f"  Failed to focus: {focus_res.get('error')}")
        return
        
    # Ensure window is visible and active so the GPU renders it
    focus_editor_window()
    
    screenshot_path = f"C:/Users/Gierl/.gemini/antigravity-ide/brain/9b24a21e-b762-44f1-9992-3d6d8d9f343b/screenshot_{angle_name}.png"
    print(f"Taking screenshot: {screenshot_path}...")
    shot_res = send_command("take_screenshot", {
        "filepath": screenshot_path
    })
    
    if shot_res.get("status") == "success":
        print(f"  Screenshot saved successfully!")
    else:
        print(f"  Failed to take screenshot: {shot_res.get('error')}")

def take_all_screenshots():
    center = [2100.0, 0.0, 500.0]
    distance = 2200.0 # Slightly closer view
    
    # 4 distinct angles
    angles = {
        "front": [-20.0, 180.0, 0.0],
        "right": [-20.0, 90.0, 0.0],
        "left": [-20.0, -90.0, 0.0],
        "back": [-20.0, 0.0, 0.0]
    }
    
    for name, orient in angles.items():
        capture_angle(name, center, distance, orient)
        time.sleep(1.0)

if __name__ == "__main__":
    take_all_screenshots()
