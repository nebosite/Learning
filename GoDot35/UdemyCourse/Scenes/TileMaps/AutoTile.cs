using Godot;
using System;


[Tool]
public class AutoTile : TileSet
{
    public override bool _IsTileBound(int drawnId, int neighborId)
    {
        // Check if the tile is bound to the neighbor
        return GetTilesIds().Contains(neighborId);
    }
}
