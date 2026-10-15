"""Keep retired mine carts out of manual construction passes.

The user's 2026-10-05 removal covers placed carts, their Blueprints, and cart
parts. Source assets remain available to their asset packs. Match known mine
families, never the generic word "cart" (shopping and utility carts are unrelated).
This module performs no Unreal mutations and can be imported outside Unreal.
"""

import re


_MINE_CART_FAMILY = re.compile(
    r"(?:^|[/\\.:'\"\s])"
    r"(?:(?:sm_|mi_|t_)?ind_min_(?:vehicle_)?cart_"
    r"|sm_minecart_"
    r"|bp_minerailcart(?:_|[.:'\"/\\]|$))",
    re.IGNORECASE,
)


def is_mine_cart_asset(value: str) -> bool:
    """Recognize source carts/wheels, generated cart parts, and cart BPs."""
    return bool(value and _MINE_CART_FAMILY.search(str(value)))


def is_mine_cart_actor(actor) -> bool:
    """Recognize cart actors by class or mesh, independent of actor labels."""
    if actor is None:
        return False
    import unreal

    if is_mine_cart_asset(actor.get_class().get_path_name()):
        return True
    # ISM/HISM and spline mesh components inherit StaticMeshComponent.
    for component in actor.get_components_by_class(unreal.StaticMeshComponent):
        mesh = component.static_mesh
        if mesh and is_mine_cart_asset(mesh.get_path_name()):
            return True
    return False
