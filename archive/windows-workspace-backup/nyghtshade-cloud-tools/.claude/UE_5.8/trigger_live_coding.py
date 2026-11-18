import ctypes
import time

VK_CONTROL = 0x11
VK_MENU = 0x12
VK_F11 = 0x7A
KEYEVENTF_KEYUP = 0x0002

user32 = ctypes.windll.user32

print("Simulating Ctrl+Alt+F11...")
user32.keybd_event(VK_CONTROL, 0, 0, 0)
user32.keybd_event(VK_MENU, 0, 0, 0)
user32.keybd_event(VK_F11, 0, 0, 0)
time.sleep(0.1)
user32.keybd_event(VK_F11, 0, KEYEVENTF_KEYUP, 0)
user32.keybd_event(VK_MENU, 0, KEYEVENTF_KEYUP, 0)
user32.keybd_event(VK_CONTROL, 0, KEYEVENTF_KEYUP, 0)
print("Keys triggered successfully!")
