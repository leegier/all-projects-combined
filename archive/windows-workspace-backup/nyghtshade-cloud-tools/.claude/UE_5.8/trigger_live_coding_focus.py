import ctypes
import time

user32 = ctypes.windll.user32
kernel32 = ctypes.windll.kernel32

found_hwnd = None

def enum_handler(hwnd, lParam):
    global found_hwnd
    if user32.IsWindowVisible(hwnd):
        length = user32.GetWindowTextLengthW(hwnd)
        buff = ctypes.create_unicode_buffer(length + 1)
        user32.GetWindowTextW(hwnd, buff, length + 1)
        title = buff.value
        # Check if window title contains Unreal Editor project name
        if "freshstart" in title or "Unreal Editor" in title:
            print(f"Found Unreal Editor window: {title}")
            found_hwnd = hwnd
            return False
    return True

EnumWindowsProc = ctypes.WINFUNCTYPE(ctypes.c_bool, ctypes.c_int, ctypes.c_int)
user32.EnumWindows(EnumWindowsProc(enum_handler), 0)

if found_hwnd:
    # Bring window to foreground
    user32.ShowWindow(found_hwnd, 9) # SW_RESTORE / SW_SHOWNORMAL
    user32.SetForegroundWindow(found_hwnd)
    time.sleep(0.5)
    
    # Send Ctrl+Alt+F11
    VK_CONTROL = 0x11
    VK_MENU = 0x12
    VK_F11 = 0x7A
    KEYEVENTF_KEYUP = 0x0002
    
    print("Simulating Ctrl+Alt+F11...")
    user32.keybd_event(VK_CONTROL, 0, 0, 0)
    user32.keybd_event(VK_MENU, 0, 0, 0)
    user32.keybd_event(VK_F11, 0, 0, 0)
    time.sleep(0.1)
    user32.keybd_event(VK_F11, 0, KEYEVENTF_KEYUP, 0)
    user32.keybd_event(VK_MENU, 0, KEYEVENTF_KEYUP, 0)
    user32.keybd_event(VK_CONTROL, 0, KEYEVENTF_KEYUP, 0)
    print("Keys sent!")
else:
    print("Unreal Editor window not found.")
