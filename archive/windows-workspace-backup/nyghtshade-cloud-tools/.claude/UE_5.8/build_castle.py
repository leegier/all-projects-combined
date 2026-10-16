import socket
import json
import time

RUN_ID = str(int(time.time()))[5:] # Use a short unique ID from timestamp

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

def spawn_mesh_actor(actor_base_name, mesh_path, location, rotation=[0.0, 0.0, 0.0], scale=[1.0, 1.0, 1.0]):
    actor_name = f"{actor_base_name}_{RUN_ID}"
    print(f"Spawning {actor_name} at {location}...")
    spawn_res = send_command("spawn_actor", {
        "type": "StaticMeshActor",
        "name": actor_name,
        "location": location,
        "rotation": rotation,
        "scale": scale
    })
    
    if spawn_res.get("status") == "success":
        actual_name = spawn_res.get("result", {}).get("name", actor_name)
        # Set mesh
        set_res = send_command("set_actor_property", {
            "name": actual_name,
            "property_name": "StaticMesh",
            "property_value": mesh_path
        })
        if set_res.get("status") == "success":
            print(f"  Successfully set mesh for {actual_name}")
            return actual_name
        else:
            print(f"  Error setting mesh for {actual_name}: {set_res.get('error')}")
            return None
    else:
        print(f"  Error spawning {actor_name}: {spawn_res.get('error')}")
        return None

def cleanup_existing_actors():
    print("Querying actors for cleanup...")
    res = send_command("get_actors_in_level")
    if res.get("status") == "success":
        actors = res.get("result", {}).get("actors", [])
        to_delete = [a.get("name") for a in actors if a.get("name") and ("Castle" in a.get("name") or "Tower" in a.get("name"))]
        
        for name in to_delete:
            print(f"Deleting existing actor: {name}...")
            del_res = send_command("delete_actor", {"name": name})
            if del_res.get("status") == "success":
                print(f"  Deleted {name}")
            else:
                print(f"  Error deleting {name}: {del_res.get('error')}")
            time.sleep(0.05)
    else:
        print("Failed to query actors for cleanup.")

def build_castle():
    cleanup_existing_actors()
    
    print("Starting generation of the Grand White Castle Keep...")
    
    # Mesh Paths
    mesh_column = "/Game/WhiteCastle/Meshes/SM_Det_WCArchElemCollumn1_1"
    mesh_wall = "/Game/WhiteCastle/Meshes/SM_Det_WCArchElemWall_1"
    mesh_wall_window = "/Game/WhiteCastle/Meshes/SM_Det_WCArchElemWindow1_1"
    mesh_arch = "/Game/WhiteCastle/Meshes/SM_Gat_WCArchElemArch_1_Full"
    mesh_stair = "/Game/WhiteCastle/Meshes/SM_Gat_WCArchElemStair"
    mesh_bell = "/Game/WhiteCastle/Meshes/SM_Det_WCBell_1"
    mesh_flat = "/Game/WhiteCastle/Meshes/SM_Det_WCArchElemFlat_1"
    
    # Base layout parameters
    start_x = 1200
    start_y = -900
    grid_size = 4
    spacing = 600
    
    actor_count = 0
    
    # 1. Spawn a grid of columns
    for i in range(grid_size):
        x = start_x + (i * spacing)
        for j in range(grid_size):
            y = start_y + (j * spacing)
            
            # Skip the center column for room space
            if 0 < i < grid_size - 1 and 0 < j < grid_size - 1:
                continue
                
            actor_name = f"Castle_Column_{i}_{j}"
            spawn_mesh_actor(
                actor_name,
                mesh_column,
                location=[float(x), float(y), 100.0],
                scale=[1.2, 1.2, 1.2]
            )
            actor_count += 1
            time.sleep(0.1)

    # 2. Spawn walls between the outer columns
    # Spanning X walls (horizontal)
    for j in [0, grid_size - 1]:
        y = start_y + (j * spacing)
        for i in range(grid_size - 1):
            x = start_x + (i * spacing) + (spacing / 2)
            actor_name = f"Castle_Wall_X_{i}_{j}"
            mesh = mesh_wall_window if i % 2 == 0 else mesh_wall
            spawn_mesh_actor(
                actor_name,
                mesh,
                location=[float(x), float(y), 100.0],
                rotation=[0.0, 90.0, 0.0],
                scale=[1.0, 1.0, 1.0]
            )
            actor_count += 1
            time.sleep(0.1)
            
    # Spanning Y walls (vertical)
    for i in [0, grid_size - 1]:
        x = start_x + (i * spacing)
        for j in range(grid_size - 1):
            y = start_y + (j * spacing) + (spacing / 2)
            actor_name = f"Castle_Wall_Y_{i}_{j}"
            mesh = mesh_wall_window if j % 2 == 0 else mesh_wall
            spawn_mesh_actor(
                actor_name,
                mesh,
                location=[float(x), float(y), 100.0],
                rotation=[0.0, 0.0, 0.0],
                scale=[1.0, 1.0, 1.0]
            )
            actor_count += 1
            time.sleep(0.1)

    # 3. Spawn a flat foundation floor at Z=500
    for i in range(grid_size - 1):
        x = start_x + (i * spacing) + (spacing / 2)
        for j in range(grid_size - 1):
            y = start_y + (j * spacing) + (spacing / 2)
            actor_name = f"Castle_Floor_{i}_{j}"
            spawn_mesh_actor(
                actor_name,
                mesh_flat,
                location=[float(x), float(y), 500.0],
                scale=[2.5, 2.5, 1.0]
            )
            actor_count += 1
            time.sleep(0.1)

    # 4. Spawn grand stairs leading to the middle front
    spawn_mesh_actor(
        "Castle_Stairs_Main",
        mesh_stair,
        location=[800.0, 0.0, 100.0],
        rotation=[0.0, 0.0, 0.0],
        scale=[1.5, 1.5, 1.5]
    )
    actor_count += 1

    # 5. Build the upper keep tower
    tower_columns = [
        [start_x + spacing, start_y + spacing],
        [start_x + spacing * 2, start_y + spacing],
        [start_x + spacing, start_y + spacing * 2],
        [start_x + spacing * 2, start_y + spacing * 2]
    ]
    
    for idx, col_pos in enumerate(tower_columns):
        spawn_mesh_actor(
            f"Tower_Column_{idx}",
            mesh_column,
            location=[float(col_pos[0]), float(col_pos[1]), 500.0],
            scale=[1.0, 1.0, 1.0]
        )
        actor_count += 1
        time.sleep(0.1)

    # Arches connecting tower columns
    spawn_mesh_actor(
        "Tower_Arch_1",
        mesh_arch,
        location=[float(start_x + spacing + spacing/2), float(start_y + spacing), 850.0],
        rotation=[0.0, 90.0, 0.0],
        scale=[1.0, 1.0, 1.0]
    )
    spawn_mesh_actor(
        "Tower_Arch_2",
        mesh_arch,
        location=[float(start_x + spacing + spacing/2), float(start_y + spacing * 2), 850.0],
        rotation=[0.0, 90.0, 0.0],
        scale=[1.0, 1.0, 1.0]
    )
    actor_count += 2
    time.sleep(0.1)

    # 6. Spawn the Majestic Bell at the top of the tower
    center_x = start_x + (grid_size - 1) * spacing / 2
    center_y = start_y + (grid_size - 1) * spacing / 2
    
    spawn_mesh_actor(
        "Tower_Bell",
        mesh_bell,
        location=[float(center_x), float(center_y), 900.0],
        scale=[2.0, 2.0, 2.0]
    )
    actor_count += 1

    print(f"Castle generation complete! Successfully spawned/configured {actor_count} actors.")
    
    print("Focusing viewport on the newly built castle keep...")
    send_command("focus_viewport", {
        "location": [float(center_x), float(center_y), 500.0],
        "distance": 2500.0,
        "orientation": [-20.0, 180.0, 0.0]
    })

if __name__ == "__main__":
    build_castle()
