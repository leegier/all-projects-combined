"""Prepared offline. Native read-only Material Attributes audit; root executes.
No map load, save, graph change, shader compilation or automatic eligibility.
"""
import datetime, hashlib, json, pathlib, traceback
import unreal as U

P = pathlib.Path('E:/GameDev/Staging/MyProject2_EnvCopy_Claude_20261009')
A = pathlib.Path('H:/NyghtshadeHollow_Development/2026-10-10/EnvironmentCleanup/PerformanceCandidates/WPO150m/20261010T162549657734Z/CANDIDATE_PREPARATION_RECEIPT.json')
O = A.parent / ('MaterialAttributes_' + datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ') + '.json')
L = U.MaterialEditingLibrary
R = {'status': 'STARTED_READ_ONLY', 'audit_source': str(A), 'changed_assets': [],
     'automatic_candidate_admission': False, 'material_graphs': {}, 'instances': [], 'warnings': []}

def need(v, s):
    if not v: raise RuntimeError(s)
    return v

def sha(p): return hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()
def path(x): return x.get_path_name() if x else None
def prop(x, name):
    try: return x.get_editor_property(name)
    except Exception as e:
        R['warnings'].append(path(x) + ' property ' + name + ': ' + str(e))
        return None

def graph(owner, is_function=False, depth=0):
    key = path(owner)
    if key in R['material_graphs']: return
    need(depth <= 16, 'Function recursion limit; manual graph review required.')
    nodes = L.get_material_function_expressions(owner) if is_function else L.get_material_expressions(owner)
    rec = {'kind': 'function' if is_function else 'base_material', 'nodes': []}
    R['material_graphs'][key] = rec
    if not is_function:
        rec['use_material_attributes'] = bool(prop(owner, 'use_material_attributes'))
        rec['always_evaluate_world_position_offset'] = bool(prop(owner, 'always_evaluate_world_position_offset'))
        rec['attributes_output_node'] = path(L.get_material_property_input_node(owner, U.MaterialProperty.MP_MATERIAL_ATTRIBUTES))
        rec['direct_wpo_output_node'] = path(L.get_material_property_input_node(owner, U.MaterialProperty.MP_WORLD_POSITION_OFFSET))
    for node in nodes:
        names = list(L.get_material_expression_input_names(node))
        inputs = list(L.get_inputs_for_material_function_expression(owner, node) if is_function else L.get_inputs_for_material_expression(owner, node))
        need(len(names) == len(inputs), 'Input names/connections not aligned: ' + path(node))
        row = {'path': path(node), 'class': node.get_class().get_name(),
               'inputs': [{'index': i, 'name': str(n), 'upstream': path(v)} for i, (n, v) in enumerate(zip(names, inputs))],
               'outputs': list(L.get_material_expression_output_names(node))}
        if 'Parameter' in row['class']:
            row['parameter_name'] = str(prop(node, 'parameter_name'))
        if row['class'] == 'MaterialExpressionMaterialFunctionCall':
            function = prop(node, 'material_function')
            row['function'] = path(function)
            if function:
                if isinstance(function, U.MaterialFunction): graph(function, True, depth + 1)
                else: R['warnings'].append('Function interface is not concrete MaterialFunction; manual review: ' + path(function))
        rec['nodes'].append(row)
    # These are connected WPO pin locations, not proof a switch selects them.
    rec['connected_wpo_pins'] = [
        {'node': n['path'], 'class': n['class'], 'input': i}
        for n in rec['nodes'] for i in n['inputs']
        if i['upstream'] and ('worldpositionoffset' in i['name'].lower().replace(' ', '') or i['name'].lower() == 'wpo')]

try:
    need(pathlib.Path(U.Paths.project_dir()).resolve() == P.resolve(), 'Exact EnvCopy guard.')
    a = json.loads(A.read_text(encoding='utf-8-sig'))
    need(a['status'] == 'AUDIT_COMPLETE_NO_ASSETS_CHANGED' and not a['changed_assets'], 'Expected unmodified native audit.')
    hashes = a['dependency_hashes_before']
    for p, expected in hashes.items(): need(sha(p) == expected, 'Audited dependency changed: ' + p)
    instances = sorted({m['instance'] for c in a['component_audit'] for m in c['material_audit']})
    for p in instances:
        instance = need(U.load_asset(p), 'Missing assigned material: ' + p)
        base = need(instance.get_base_material(), 'Missing base material.')
        graph(base)
        switches = [str(n) for n in L.get_static_switch_parameter_names(instance)]
        scalars = [str(n) for n in L.get_scalar_parameter_names(instance)]
        R['instances'].append({'path': p, 'base': path(base),
            'static_switches': {n: bool(L.get_material_instance_static_switch_parameter_value(instance, n)) for n in switches},
            'wind_related_scalars': {n: float(L.get_material_instance_scalar_parameter_value(instance, n)) for n in scalars
                                    if any(t in n.lower() for t in ('wind', 'wpo', 'sway', 'gust', 'flutter', 'bend'))}})
    for p, expected in hashes.items(): need(sha(p) == expected, 'Dependency hash changed during read-only audit: ' + p)
    R['dependency_hashes_verified_unchanged'] = True
    R['status'] = 'READ_ONLY_GRAPH_AUDIT_COMPLETE_REQUIRES_PATH_AND_SWITCH_REVIEW'
    R['interpretation'] = 'Follow the two masters attributes output through function outputs and reachable WPO inputs; reconcile assigned-instance switches/scalars before admitting a component. Disconnected nodes or inactive switch branches are not proof of active WPO.'
except Exception:
    R['status'] = 'AUDIT_BLOCKED_NO_CHANGES'
    R['error'] = traceback.format_exc()
finally:
    O.write_text(json.dumps(R, indent=2), encoding='utf-8')
    print('NH_FOREST_ATTRIBUTES_AUDIT', R['status'], str(O))
